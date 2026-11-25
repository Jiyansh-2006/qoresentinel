import { Router, Request, Response } from "express";
import { PQCService } from "../services/pqcService.js";
import { AgentAuthenticatorManager } from "../blockchain/authenticatorManager.js";
import { db } from "../database/db.js";

export const securityRouter = Router();

securityRouter.get("/status", (req: Request, res: Response) => {
  const status = PQCService.getSecurityStatus();
  res.json(status);
});

securityRouter.get("/pqc", (req: Request, res: Response) => {
  const keyPair = PQCService.getActiveKeyPair();
  res.json({
    algorithm: "ML-DSA-87",
    fipsStandard: "NIST FIPS 204 (Level 5)",
    publicKeyFingerprint: keyPair.fingerprint,
    publicKeyLengthBytes: keyPair.publicKey.length,
    secretKeyProtected: true,
  });
});

securityRouter.post("/authorise", (req: Request, res: Response) => {
  const durationSeconds = Number(req.body.durationSeconds) || 7200;
  const updated = AgentAuthenticatorManager.openScopedAuthWindow(durationSeconds);

  db.recordAudit({
    action: "EVM_AUTH_WINDOW_OPENED",
    actor: "SecurityAdmin",
    details: `Scoped EVM Authorization Window opened for ${durationSeconds} seconds (expires at ${new Date(updated.scopedEvmAuthWindow.expiresAt * 1000).toISOString()})`,
  });

  res.json({
    success: true,
    message: "Scoped EVM authorization window active",
    authenticator: updated,
  });
});

securityRouter.post("/revoke", (req: Request, res: Response) => {
  const updated = AgentAuthenticatorManager.revokeAuthenticator();

  db.recordAudit({
    action: "AGENT_REVOKED",
    actor: "SecurityAdmin",
    details: "Agent authenticator session key revoked. All pending disbursements immediately blocked.",
  });

  res.json({
    success: true,
    message: "Agent authenticator revoked",
    authenticator: updated,
  });
});

securityRouter.post("/rotate-keys", (req: Request, res: Response) => {
  const reason = req.body.reason || "Scheduled security rotation";
  const secret = process.env.MLDSA_KEY_ENCRYPTION_SECRET;
  if (!secret || secret.length < 32) {
    return res.status(503).json({
      error: "Set MLDSA_KEY_ENCRYPTION_SECRET to a private value of at least 32 characters before rotating keys.",
    });
  }

  const rotation = PQCService.rotateKeys(secret, reason);

  db.recordAudit({
    action: "PQC_KEYS_ROTATED",
    actor: "SecurityAdmin",
    details: `ML-DSA-87 keypair rotated. Old fingerprint: ${rotation.oldFingerprint}, New fingerprint: ${rotation.newFingerprint}`,
  });

  res.json({
    success: true,
    message: "ML-DSA-87 post-quantum keypair rotated and encrypted",
    rotation,
  });
});

securityRouter.post("/update-limits", (req: Request, res: Response) => {
  const { maxPerTx, dailyCap } = req.body;
  if (!maxPerTx || !dailyCap) {
    return res.status(400).json({ error: "maxPerTx and dailyCap required" });
  }

  const updated = AgentAuthenticatorManager.updateSpendingLimits(maxPerTx, dailyCap);
  db.recordAudit({
    action: "SPENDING_LIMITS_UPDATED",
    actor: "SecurityAdmin",
    details: `Updated agent authenticator spending caps. MaxPerTx: ${maxPerTx}, DailyCap: ${dailyCap}`,
  });

  res.json({ success: true, authenticator: updated });
});
