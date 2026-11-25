import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { Router, type Request, type RequestHandler, type Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { QORECHAIN_DIANA_CONFIG } from "@qoresentinel/shared";
import { PQCService } from "../services/pqcService.js";
import {
  createAuthAccount,
  deleteAuthSession,
  getAuthAccountByEmail,
  pruneAuthSessions,
  saveAuthSession,
  type AuthAccount,
} from "../db/store.js";
import {
  AUTH_SESSION_COOKIE,
  hashSessionToken,
  optionalAuth,
  requireSameOrigin,
} from "../middleware/auth.js";

export const authRouter = Router();

const SESSION_HOURS = 8;
const REMEMBER_DAYS = 30;
const LOGIN_WINDOW_MS = 15 * 60_000;
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const dummyPasswordHash = bcrypt.hashSync(randomBytes(24).toString("hex"), 12);

function asyncRoute(handler: (request: Request, response: Response) => Promise<void>): RequestHandler {
  return (request, response, next) => {
    void handler(request, response).catch(next);
  };
}

const passwordSchema = z.string()
  .min(12, "Password must be at least 12 characters.")
  .max(72, "Password cannot exceed 72 characters.")
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password is too long.");

const studentRegistrationSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  college: z.string().trim().min(2).max(160),
  studentId: z.string().trim().min(1).max(80),
  department: z.string().trim().min(1).max(120),
  course: z.string().trim().min(1).max(120),
  academicYear: z.string().trim().min(1).max(32),
  phone: z.string().trim().min(7).max(32),
  password: passwordSchema,
  confirmPassword: z.string(),
}).superRefine((data, context) => {
  if (data.password !== data.confirmPassword) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["confirmPassword"], message: "Passwords do not match." });
  }
});

const adminRegistrationSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  organisation: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  phone: z.string().trim().min(7).max(32),
  organisationDetails: z.string().trim().min(10).max(2000),
  invitationCode: z.string().min(1).max(256),
  password: passwordSchema,
  confirmPassword: z.string(),
}).superRefine((data, context) => {
  if (data.password !== data.confirmPassword) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["confirmPassword"], message: "Passwords do not match." });
  }
});

const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(256),
  rememberMe: z.boolean().optional().default(false),
});

function rateLimit(request: Request, response: Response, maxRequests: number): boolean {
  const now = Date.now();
  for (const [key, entry] of rateLimits) {
    if (entry.resetAt <= now) rateLimits.delete(key);
  }

  const key = `${request.ip || request.socket.remoteAddress || "unknown"}:${request.path}`;
  const entry = rateLimits.get(key);
  if (entry && entry.count >= maxRequests) {
    response.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
    response.status(429).json({ error: "Too many authentication attempts. Try again later." });
    return false;
  }

  rateLimits.set(key, entry
    ? { count: entry.count + 1, resetAt: entry.resetAt }
    : { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  return true;
}

function serializeUser(account: AuthAccount) {
  return {
    id: account.id,
    email: account.email,
    fullName: account.fullName,
    role: account.role,
    profile: account.profile,
    createdAt: account.createdAt,
  };
}

function setSessionCookie(response: Response, token: string, maxAgeSeconds: number): void {
  const secure = process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true";
  response.setHeader(
    "Set-Cookie",
    `${AUTH_SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}${secure ? "; Secure" : ""}`
  );
}

function clearSessionCookie(response: Response): void {
  const secure = process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true";
  response.setHeader(
    "Set-Cookie",
    `${AUTH_SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure ? "; Secure" : ""}`
  );
}

function invitationCodeMatches(candidate: string, expected: string): boolean {
  const candidateBytes = Buffer.from(candidate);
  const expectedBytes = Buffer.from(expected);
  return candidateBytes.length === expectedBytes.length && timingSafeEqual(candidateBytes, expectedBytes);
}

async function createAccountAndSession(
  response: Response,
  details: {
    email: string;
    fullName: string;
    password: string;
    role: AuthAccount["role"];
    profile: Record<string, string>;
  },
  rememberMe = false
): Promise<void> {
  const account: AuthAccount = {
    id: randomUUID(),
    email: details.email,
    fullName: details.fullName,
    passwordHash: await bcrypt.hash(details.password, 12),
    role: details.role,
    profile: details.profile,
    createdAt: new Date().toISOString(),
  };

  try {
    createAuthAccount(account);
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed: auth_users\.email/.test(error.message)) {
      response.status(409).json({ error: "An account with this email already exists." });
      return;
    }
    throw error;
  }

  const token = randomBytes(32).toString("base64url");
  const maxAgeSeconds = rememberMe
    ? REMEMBER_DAYS * 24 * 60 * 60
    : SESSION_HOURS * 60 * 60;
  const expiresAt = Date.now() + maxAgeSeconds * 1000;
  pruneAuthSessions(Date.now());
  saveAuthSession(hashSessionToken(token), account.id, expiresAt, new Date().toISOString());
  setSessionCookie(response, token, maxAgeSeconds);
  response.status(201).json({ user: serializeUser(account) });
}

authRouter.post("/register/student", requireSameOrigin, asyncRoute(async (request: Request, response: Response) => {
  if (!rateLimit(request, response, 5)) return;
  const parsed = studentRegistrationSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Please correct the registration fields.", details: parsed.error.flatten() });
    return;
  }

  const data = parsed.data;
  await createAccountAndSession(response, {
    email: data.email,
    fullName: data.fullName,
    password: data.password,
    role: "STUDENT",
    profile: {
      college: data.college,
      studentId: data.studentId,
      department: data.department,
      course: data.course,
      academicYear: data.academicYear,
      phone: data.phone,
    },
  });
}));

authRouter.post("/register/admin", requireSameOrigin, asyncRoute(async (request: Request, response: Response) => {
  if (!rateLimit(request, response, 5)) return;
  const parsed = adminRegistrationSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Please correct the registration fields.", details: parsed.error.flatten() });
    return;
  }

  const expectedCode = process.env.ADMIN_INVITATION_CODE;
  if (!expectedCode) {
    response.status(503).json({ error: "Administrator registration is disabled until an invitation code is configured." });
    return;
  }
  if (!invitationCodeMatches(parsed.data.invitationCode, expectedCode)) {
    response.status(403).json({ error: "The administrator invitation code is invalid." });
    return;
  }

  const data = parsed.data;
  await createAccountAndSession(response, {
    email: data.email,
    fullName: data.fullName,
    password: data.password,
    role: "ADMIN",
    profile: {
      organisation: data.organisation,
      phone: data.phone,
      organisationDetails: data.organisationDetails,
    },
  });
}));

authRouter.post("/login", requireSameOrigin, asyncRoute(async (request: Request, response: Response) => {
  if (!rateLimit(request, response, 10)) return;
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Email and password are required.", details: parsed.error.flatten() });
    return;
  }

  const account = getAuthAccountByEmail(parsed.data.email);
  const passwordMatches = account
    ? await bcrypt.compare(parsed.data.password, account.passwordHash)
    : await bcrypt.compare(parsed.data.password, dummyPasswordHash);
  if (!account || !passwordMatches) {
    response.status(401).json({ error: "Email or password is incorrect." });
    return;
  }

  const token = randomBytes(32).toString("base64url");
  const maxAgeSeconds = parsed.data.rememberMe
    ? REMEMBER_DAYS * 24 * 60 * 60
    : SESSION_HOURS * 60 * 60;
  pruneAuthSessions(Date.now());
  saveAuthSession(hashSessionToken(token), account.id, Date.now() + maxAgeSeconds * 1000, new Date().toISOString());
  setSessionCookie(response, token, maxAgeSeconds);
  response.json({ user: serializeUser(account) });
}));

authRouter.post("/logout", requireSameOrigin, (request: Request, response: Response) => {
  const token = request.headers.cookie
    ?.split(";")
    .map((pair) => pair.trim())
    .find((pair) => pair.startsWith(`${AUTH_SESSION_COOKIE}=`))
    ?.slice(AUTH_SESSION_COOKIE.length + 1);
  if (token) deleteAuthSession(hashSessionToken(token));
  clearSessionCookie(response);
  response.json({ success: true });
});

authRouter.get("/session", optionalAuth, (request: Request, response: Response) => {
  const secStatus = PQCService.getSecurityStatus();
  response.json({
    isAuthenticated: Boolean(request.authUser),
    user: request.authUser || null,
    network: QORECHAIN_DIANA_CONFIG.name,
    pqcStatus: secStatus,
  });
});

authRouter.post("/connect", (request: Request, response: Response) => {
  const { address, walletType } = request.body || {};
  const targetAddress = address || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const secStatus = PQCService.getSecurityStatus();

  response.json({
    connected: true,
    address: targetAddress,
    walletType: walletType || "QoreX Wallet / MetaMask",
    network: {
      name: QORECHAIN_DIANA_CONFIG.name,
      chainId: QORECHAIN_DIANA_CONFIG.chainId,
      currency: QORECHAIN_DIANA_CONFIG.currencySymbol,
    },
    pqcRegistered: secStatus.pqcRegistered,
    pqcAlgorithm: "ML-DSA-87",
    fingerprint: secStatus.publicKeyFingerprint,
    timestamp: Date.now(),
  });
});
