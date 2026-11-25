import test from "node:test";
import assert from "node:assert/strict";
import {
  generateMLDSA87KeyPair,
  signCanonicalDecisionPayload,
  verifyCanonicalDecisionSignature,
  computeMLDSA87Fingerprint,
} from "./mldsa87.js";
import { PQCKeystoreManager } from "./keystore.js";
import { CanonicalDecisionPayload } from "@qoresentinel/shared";

test("ML-DSA-87 Key Generation and Fingerprinting", () => {
  const keyPair = generateMLDSA87KeyPair();
  assert.equal(keyPair.publicKey.length, 2592, "ML-DSA-87 public key must be 2592 bytes (FIPS 204)");
  assert.equal(keyPair.secretKey.length, 4896, "ML-DSA-87 secret key must be 4896 bytes (FIPS 204)");
  assert.match(keyPair.fingerprint, /^qor-pqc:dsa87:[0-9a-f]{32}$/, "Fingerprint must follow standard format");
});

test("ML-DSA-87 Signing and Verification on Canonical Decision Payload", () => {
  const keyPair = generateMLDSA87KeyPair();

  const payload: CanonicalDecisionPayload = {
    applicationId: "app_demo_001",
    poolId: "pool_pqc_research",
    beneficiary: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    category: "POST_QUANTUM_CRYPTO",
    requestedAmountBaseUnits: "5000000000000000000000", // 5000 QOR
    approvedAmountBaseUnits: "5000000000000000000000",
    milestoneIndex: 0,
    decisionStatus: "APPROVED",
    policyHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    evidenceRootHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    agentEvaluatorFingerprint: keyPair.fingerprint,
    timestamp: 1774390000,
    nonce: "nonce_secure_991823",
  };

  const signatureBundle = signCanonicalDecisionPayload(
    keyPair.secretKey,
    keyPair.publicKey,
    payload
  );

  assert.equal(signatureBundle.algorithm, "ML-DSA-87");
  assert.equal(signatureBundle.publicKeyFingerprint, keyPair.fingerprint);
  assert.ok(signatureBundle.signatureHex.length > 0);

  // Verification
  const verification = verifyCanonicalDecisionSignature(
    keyPair.publicKey,
    payload,
    signatureBundle
  );

  assert.equal(verification.valid, true, "Signature verification must succeed on untampered payload");
  assert.equal(verification.fingerprintMatches, true);
  assert.equal(verification.error, undefined);
});

test("ML-DSA-87 Tampered Payload Rejection", () => {
  const keyPair = generateMLDSA87KeyPair();

  const payload: CanonicalDecisionPayload = {
    applicationId: "app_demo_002",
    poolId: "pool_pqc_research",
    beneficiary: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    category: "POST_QUANTUM_CRYPTO",
    requestedAmountBaseUnits: "2000000000000000000000",
    approvedAmountBaseUnits: "2000000000000000000000",
    milestoneIndex: 0,
    decisionStatus: "APPROVED",
    policyHash: "0xhash1",
    evidenceRootHash: "0xhash2",
    agentEvaluatorFingerprint: keyPair.fingerprint,
    timestamp: 1774390000,
    nonce: "nonce_tamper_test",
  };

  const signatureBundle = signCanonicalDecisionPayload(
    keyPair.secretKey,
    keyPair.publicKey,
    payload
  );

  // Adversary tampers with the beneficiary address to steal grant funds
  const tamperedPayload: CanonicalDecisionPayload = {
    ...payload,
    beneficiary: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", // Attacker's address
  };

  const tamperedVerification = verifyCanonicalDecisionSignature(
    keyPair.publicKey,
    tamperedPayload,
    signatureBundle
  );

  assert.equal(tamperedVerification.valid, false, "Must reject tampered payload");
  assert.match(tamperedVerification.error || "", /Payload digest mismatch/);
});

test("ML-DSA-87 Tampered Signature Rejection", () => {
  const keyPair = generateMLDSA87KeyPair();

  const payload: CanonicalDecisionPayload = {
    applicationId: "app_demo_003",
    poolId: "pool_pqc_research",
    beneficiary: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    category: "SMART_CONTRACT_SECURITY",
    requestedAmountBaseUnits: "1000000000000000000000",
    approvedAmountBaseUnits: "1000000000000000000000",
    milestoneIndex: 0,
    decisionStatus: "APPROVED",
    policyHash: "0xpolicy",
    evidenceRootHash: "0xevidence",
    agentEvaluatorFingerprint: keyPair.fingerprint,
    timestamp: 1774390000,
    nonce: "nonce_sig_tamper",
  };

  const signatureBundle = signCanonicalDecisionPayload(
    keyPair.secretKey,
    keyPair.publicKey,
    payload
  );

  // Corrupt the signature hex
  const corruptedSignature =
    (signatureBundle.signatureHex[0] === "a" ? "b" : "a") +
    signatureBundle.signatureHex.slice(1);

  const corruptedBundle = {
    ...signatureBundle,
    signatureHex: corruptedSignature,
  };

  const verification = verifyCanonicalDecisionSignature(
    keyPair.publicKey,
    payload,
    corruptedBundle
  );

  assert.equal(verification.valid, false, "Must reject invalid cryptographic signature");
});

test("PQC Encrypted Keystore and Rotation", () => {
  const keyPair = generateMLDSA87KeyPair();
  const secret = "test_passphrase_secret_qorechain_2026";

  // Encrypt
  const encryptedKeystore = PQCKeystoreManager.encryptKeyPair(keyPair, secret);
  assert.equal(encryptedKeystore.algorithm, "ML-DSA-87");
  assert.equal(encryptedKeystore.crypto.cipher, "aes-256-gcm");
  assert.equal(encryptedKeystore.metadata.isActive, true);

  // Decrypt
  const decrypted = PQCKeystoreManager.decryptKeystore(encryptedKeystore, secret);
  assert.equal(decrypted.publicKeyHex, keyPair.publicKeyHex);
  assert.equal(decrypted.secretKeyHex, keyPair.secretKeyHex);
  assert.equal(decrypted.fingerprint, keyPair.fingerprint);

  // Rotate
  const rotation = PQCKeystoreManager.rotateKey(encryptedKeystore, secret, "Compromise mitigation drill");
  assert.equal(rotation.oldKeystoreArchived.metadata.isActive, false);
  assert.ok(rotation.oldKeystoreArchived.metadata.rotatedAt);
  assert.equal(rotation.newKeystore.metadata.isActive, true);
  assert.notEqual(rotation.newKeystore.fingerprint, encryptedKeystore.fingerprint);
});
