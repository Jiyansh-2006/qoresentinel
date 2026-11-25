import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import {
  getAuthSessionAccount,
  type AuthAccount,
} from "../db/store.js";

export const AUTH_SESSION_COOKIE = "qore_session";

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: AuthAccount["role"];
  profile: Record<string, string>;
  createdAt: string;
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser;
    }
  }
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function readCookie(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return undefined;
  for (const pair of cookieHeader.split(";")) {
    const [key, ...valueParts] = pair.trim().split("=");
    if (key === name) return valueParts.join("=");
  }
  return undefined;
}

function toAuthenticatedUser(account: AuthAccount): AuthenticatedUser {
  return {
    id: account.id,
    email: account.email,
    fullName: account.fullName,
    role: account.role,
    profile: account.profile,
    createdAt: account.createdAt,
  };
}

export function optionalAuth(request: Request, _response: Response, next: NextFunction): void {
  const token = readCookie(request, AUTH_SESSION_COOKIE);
  if (token) {
    const account = getAuthSessionAccount(hashSessionToken(token), Date.now());
    if (account) request.authUser = toAuthenticatedUser(account);
  }
  next();
}

export function requireAuth(request: Request, response: Response, next: NextFunction): void {
  optionalAuth(request, response, () => {
    if (!request.authUser) {
      response.status(401).json({ error: "Authentication required." });
      return;
    }
    next();
  });
}

export function requireRole(...roles: AuthenticatedUser["role"][]) {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (!request.authUser) {
      response.status(401).json({ error: "Authentication required." });
      return;
    }
    if (!roles.includes(request.authUser.role)) {
      response.status(403).json({ error: "You do not have permission to access this resource." });
      return;
    }
    next();
  };
}

export function requireSameOrigin(request: Request, response: Response, next: NextFunction): void {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    next();
    return;
  }

  const origin = request.get("origin");
  if (!origin) {
    next();
    return;
  }

  const allowedOrigins = (process.env.APP_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (allowedOrigins.includes(origin)) {
    next();
    return;
  }

  response.status(403).json({ error: "Request origin is not allowed." });
}

