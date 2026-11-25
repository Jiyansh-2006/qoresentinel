import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";

process.env.NODE_ENV = "test";
process.env.MLDSA_KEY_ENCRYPTION_SECRET = "";
const databaseDirectory = mkdtempSync(path.join(tmpdir(), "qoresentinel-security-"));
process.env.DATABASE_PATH = path.join(databaseDirectory, "security.sqlite");

const express = (await import("express")).default;
const { securityRouter } = await import("../routes/securityRoutes.js");
const { closeDatabase } = await import("../db/store.js");
const { PQCService } = await import("../services/pqcService.js");

const app = express();
app.use(express.json());
app.use("/api/security", securityRouter);

let server: ReturnType<typeof app.listen>;
let baseUrl: string;

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve())
    );
  }
  closeDatabase();
  rmSync(databaseDirectory, { recursive: true, force: true });
});

test("key rotation is disabled until a private encryption secret is configured", async () => {
  const fingerprintBefore = PQCService.getActiveKeyPair().fingerprint;
  const response = await fetch(`${baseUrl}/api/security/rotate-keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: "test" }),
  });

  assert.equal(response.status, 503);
  assert.equal(PQCService.getActiveKeyPair().fingerprint, fingerprintBefore);
  assert.match((await response.json() as { error: string }).error, /MLDSA_KEY_ENCRYPTION_SECRET/);
});
