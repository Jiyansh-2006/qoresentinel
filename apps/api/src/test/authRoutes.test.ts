import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { toBech32 } from "@cosmjs/encoding";

process.env.NODE_ENV = "test";
const databaseDirectory = mkdtempSync(path.join(tmpdir(), "qoresentinel-auth-"));
process.env.DATABASE_PATH = path.join(databaseDirectory, "auth.sqlite");
process.env.ADMIN_INVITATION_CODE = "test-invitation-code";

const express = (await import("express")).default;
const { authRouter } = await import("../routes/authRoutes.js");
const { applicationRouter } = await import("../routes/applicationRoutes.js");
const { transactionRouter } = await import("../routes/transactionRoutes.js");
const { requireAuth, requireRole } = await import("../middleware/auth.js");
const { closeDatabase } = await import("../db/store.js");
const { db } = await import("../database/db.js");
const { DemoDataService } = await import("../services/demoDataService.js");
const originalApplications = [...db.applications];
const originalTransactions = [...db.transactions];

const app = express();
app.use(express.json());
app.use("/api/auth", authRouter);
app.use("/api/applications", applicationRouter);
app.use("/api/transactions", transactionRouter);
app.get("/protected", requireAuth, (request, response) => response.json({ user: request.authUser }));
app.get("/admin-only", requireAuth, requireRole("ADMIN"), (_request, response) => response.json({ allowed: true }));

let server: ReturnType<typeof app.listen>;
let baseUrl: string;

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  db.applications.splice(0, db.applications.length, ...originalApplications);
  db.transactions.splice(0, db.transactions.length, ...originalTransactions);
  closeDatabase();
  rmSync(databaseDirectory, { recursive: true, force: true });
});

function cookieFrom(response: Response): string {
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie, "expected the response to set an auth cookie");
  return cookie;
}

test("registration, login, session cookies, logout, and role authorization work", async () => {
  const studentData = {
    fullName: "Test Student",
    email: "student@example.test",
    college: "Example College",
    studentId: "STU-001",
    department: "Engineering",
    course: "Computer Science",
    academicYear: "2025",
    phone: "+1-555-0100",
    password: "a-strong-test-password",
    confirmPassword: "a-strong-test-password",
  };
  const headers = { "Content-Type": "application/json", Origin: "http://localhost:5173" };
  const registration = await fetch(`${baseUrl}/api/auth/register/student`, {
    method: "POST",
    headers,
    body: JSON.stringify(studentData),
  });
  assert.equal(registration.status, 201);
  const studentCookie = cookieFrom(registration);
  const created = await registration.json() as { user: Record<string, unknown> };
  assert.equal(created.user.role, "STUDENT");
  assert.equal("passwordHash" in created.user, false);

  const duplicate = await fetch(`${baseUrl}/api/auth/register/student`, {
    method: "POST",
    headers,
    body: JSON.stringify(studentData),
  });
  assert.equal(duplicate.status, 409);

  const protectedResponse = await fetch(`${baseUrl}/protected`, { headers: { Cookie: studentCookie } });
  assert.equal(protectedResponse.status, 200);
  const protectedBody = await protectedResponse.json() as { user: { email: string } };
  assert.equal(protectedBody.user.email, studentData.email);

  const deniedAdminPage = await fetch(`${baseUrl}/admin-only`, { headers: { Cookie: studentCookie } });
  assert.equal(deniedAdminPage.status, 403);

  const submittedApplication = await fetch(`${baseUrl}/api/applications`, {
    method: "POST",
    headers: { ...headers, Cookie: studentCookie },
    body: JSON.stringify({
      ...DemoDataService.DEMO_APPLICATIONS[0],
      applicantName: "Spoofed Name",
      applicantEmail: "someone-else@example.test",
    }),
  });
  assert.equal(submittedApplication.status, 201);
  const createdApplication = await submittedApplication.json() as { id: string; applicantName: string; applicantEmail: string };
  assert.equal(createdApplication.applicantName, "Test Student");
  assert.equal(createdApplication.applicantEmail, studentData.email);

  db.applications.push({
    ...DemoDataService.DEMO_APPLICATIONS[1],
    id: "another-student-private-application",
    applicantEmail: "another-student@example.test",
    status: "PENDING",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const ownApplicationsResponse = await fetch(`${baseUrl}/api/applications`, { headers: { Cookie: studentCookie } });
  const ownApplications = await ownApplicationsResponse.json() as Array<{ id: string }>;
  assert.deepEqual(ownApplications.map((application) => application.id), [createdApplication.id]);
  const privateApplication = await fetch(`${baseUrl}/api/applications/another-student-private-application`, {
    headers: { Cookie: studentCookie },
  });
  assert.equal(privateApplication.status, 404);

  const transferHash = "a".repeat(64);
  const fromAddress = toBech32("qor", new Uint8Array(20).fill(1));
  const toAddress = toBech32("qor", new Uint8Array(20).fill(2));
  const transferResponse = await fetch(`${baseUrl}/api/transactions/wallet-transfer`, {
    method: "POST",
    headers: { ...headers, Cookie: studentCookie },
    body: JSON.stringify({
      txHash: transferHash,
      blockNumber: 42,
      fromAddress,
      toAddress,
      amountBaseUnits: "1000000",
      amountDecimals: 6,
      amountDenom: "uqor",
      chainId: 9800,
    }),
  });
  assert.equal(transferResponse.status, 201);

  db.transactions.push({
      id: "another-student-wallet-transfer",
      applicationId: "wallet_transfer",
      ownerUserId: "another-student-user-id",
      txHash: "0xother",
      blockNumber: 2,
      fromAddress: "qor1other",
      toAddress: "qor1recipient",
      amount: "2000000",
      amountDecimals: 6,
      network: "QoreChain Diana Testnet",
      isSimulated: false,
      status: "CONFIRMED",
      gasUsed: "0",
      explorerUrl: "https://explore.qore.network/tx/0xother",
      createdAt: new Date().toISOString(),
  });
  const ownTransactionsResponse = await fetch(`${baseUrl}/api/transactions`, { headers: { Cookie: studentCookie } });
  const ownTransactions = await ownTransactionsResponse.json() as Array<{ txHash: string; status: string }>;
  assert.ok(ownTransactions.some((transaction) => transaction.txHash === transferHash));
  assert.equal(ownTransactions.some((transaction) => transaction.txHash === "0xother"), false);
  assert.equal(ownTransactions.find((transaction) => transaction.txHash === transferHash)?.status, "REPORTED");

  const wrongOrigin = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { ...headers, Origin: "https://attacker.example" },
    body: JSON.stringify({ email: studentData.email, password: studentData.password }),
  });
  assert.equal(wrongOrigin.status, 403);

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email: studentData.email, password: studentData.password, rememberMe: true }),
  });
  assert.equal(login.status, 200);
  const loginCookie = cookieFrom(login);
  const session = await fetch(`${baseUrl}/api/auth/session`, { headers: { Cookie: loginCookie } });
  assert.equal((await session.json() as { isAuthenticated: boolean }).isAuthenticated, true);

  const logout = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: { Origin: "http://localhost:5173", Cookie: loginCookie },
  });
  assert.equal(logout.status, 200);
  const sessionAfterLogout = await fetch(`${baseUrl}/api/auth/session`, { headers: { Cookie: loginCookie } });
  assert.equal((await sessionAfterLogout.json() as { isAuthenticated: boolean }).isAuthenticated, false);

  const invalidSession = await fetch(`${baseUrl}/protected`, { headers: { Cookie: "qore_session=invalid-token" } });
  assert.equal(invalidSession.status, 401);
});

test("administrator registration requires a valid invitation code", async () => {
  const adminData = {
    fullName: "Test Administrator",
    organisation: "Example Foundation",
    email: "admin@example.test",
    phone: "+1-555-0101",
    organisationDetails: "A test organisation that administers grants.",
    invitationCode: "incorrect-code",
    password: "another-strong-test-password",
    confirmPassword: "another-strong-test-password",
  };
  const headers = { "Content-Type": "application/json", Origin: "http://localhost:5173" };
  const rejected = await fetch(`${baseUrl}/api/auth/register/admin`, {
    method: "POST",
    headers,
    body: JSON.stringify(adminData),
  });
  assert.equal(rejected.status, 403);

  const accepted = await fetch(`${baseUrl}/api/auth/register/admin`, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...adminData, invitationCode: process.env.ADMIN_INVITATION_CODE }),
  });
  assert.equal(accepted.status, 201);
  const adminCookie = cookieFrom(accepted);

  const allowedAdminPage = await fetch(`${baseUrl}/admin-only`, { headers: { Cookie: adminCookie } });
  assert.equal(allowedAdminPage.status, 200);
  const adminApplicationsResponse = await fetch(`${baseUrl}/api/applications`, { headers: { Cookie: adminCookie } });
  const adminApplications = await adminApplicationsResponse.json() as Array<{ id: string }>;
  assert.ok(adminApplications.some((application) => application.id === "another-student-private-application"));
  const allTransactionsResponse = await fetch(`${baseUrl}/api/transactions`, { headers: { Cookie: adminCookie } });
  const allTransactions = await allTransactionsResponse.json() as Array<{ id: string }>;
  assert.ok(allTransactions.some((transaction) => transaction.id === "another-student-wallet-transfer"));
});
