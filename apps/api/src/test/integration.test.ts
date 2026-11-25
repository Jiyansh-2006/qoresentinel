import test from "node:test";
import assert from "node:assert/strict";
import { MultiAgentAllocationPipeline } from "../agents/pipeline.js";
import { AutonomousTransactionAgent } from "../agents/transactionAgent.js";
import { DemoDataService } from "../services/demoDataService.js";
import { PQCService } from "../services/pqcService.js";
import { AgentAuthenticatorManager } from "../blockchain/authenticatorManager.js";
import { qorToBaseUnits, CanonicalDecisionPayload, PQCSignatureBundle } from "@qoresentinel/shared";
import { verifyCanonicalDecisionSignature, generateMLDSA87KeyPair, signCanonicalDecisionPayload } from "@qoresentinel/crypto";
import { ApplicationIntakeAgent } from "../agents/intakeAgent.js";

const pool = DemoDataService.DEMO_POOLS[0];
const validApp = DemoDataService.DEMO_APPLICATIONS[0];
const duplicateApp = DemoDataService.DEMO_APPLICATIONS[1];
const overbudgetApp = DemoDataService.DEMO_APPLICATIONS[2];

test("Application intake preserves stable persisted application IDs", async () => {
  const result = await ApplicationIntakeAgent.process(validApp);
  assert.equal(result.valid, true);
  assert.equal(result.applicationId, validApp.id);
});

test("1. End-to-End Pipeline: Valid Application -> Approved -> ML-DSA-87 Signed -> Disbursed", async () => {
  const signerKeys = PQCService.getActiveKeyPair();
  const authenticator = AgentAuthenticatorManager.getAuthenticatorConfig();

  const result = await MultiAgentAllocationPipeline.runPipeline({
    rawApplication: validApp,
    poolData: {
      id: pool.id,
      category: pool.category,
      remainingBudgetBaseUnits: pool.remainingBudget,
      maxGrantLimitBaseUnits: pool.maxGrantPerApplicant,
      dailyCapBaseUnits: pool.dailyCap,
      dailySpentBaseUnits: pool.dailySpent,
      permittedCategories: [pool.category],
      eligibilityCriteria: pool.eligibilityCriteria,
    },
    historicalApplications: [],
    existingDocumentHashes: new Set(),
    signerKeys: {
      secretKey: signerKeys.secretKey,
      publicKey: signerKeys.publicKey,
      fingerprint: signerKeys.fingerprint,
    },
    agentAuthenticator: authenticator,
    contractAddress: "0x91F56B77a284F49c1220a2B0Fe29B6f98EAfDE58",
    blockchainSignerOrProvider: null,
    isDemoMode: true,
  });

  assert.equal(result.decision.finalDecision, "APPROVED");
  assert.equal(result.decision.canonicalPayload.decisionStatus, "APPROVED");
  assert.ok(result.decision.pqcSignatureBundle, "Must have an ML-DSA-87 signature bundle");
  assert.equal(result.decision.pqcSignatureBundle?.algorithm, "ML-DSA-87");

  // Verify the signature on the canonical decision payload
  const verification = verifyCanonicalDecisionSignature(
    signerKeys.publicKey,
    result.decision.canonicalPayload,
    result.decision.pqcSignatureBundle!
  );
  if (!verification.valid) {
    console.log("DEBUG VERIFICATION:", verification);
  }
  assert.equal(verification.valid, true, `Signature must be cryptographically valid: ${verification.error}`);

  // Verify transaction execution
  assert.ok(result.transactionResult, "Transaction result must exist");
  assert.equal(result.transactionResult?.success, true);
  assert.match(result.transactionResult?.txHash || "", /^0x[0-9a-f]{64}$/);
});

test("2. End-to-End Pipeline: Duplicate Proposal Rejection", async () => {
  const signerKeys = PQCService.getActiveKeyPair();
  const authenticator = AgentAuthenticatorManager.getAuthenticatorConfig();

  // Create an existing history record that has the identical title and applicant email
  const historical = [
    {
      id: "historical_app_001",
      applicantEmail: validApp.applicantEmail,
      projectTitle: validApp.projectTitle,
      beneficiaryWallet: validApp.beneficiaryWalletAddress,
      documentHashes: ["0x1111"],
    },
  ];

  const result = await MultiAgentAllocationPipeline.runPipeline({
    rawApplication: duplicateApp, // Clone proposal
    poolData: {
      id: pool.id,
      category: pool.category,
      remainingBudgetBaseUnits: pool.remainingBudget,
      maxGrantLimitBaseUnits: pool.maxGrantPerApplicant,
      dailyCapBaseUnits: pool.dailyCap,
      dailySpentBaseUnits: pool.dailySpent,
      permittedCategories: [pool.category],
      eligibilityCriteria: pool.eligibilityCriteria,
    },
    historicalApplications: historical,
    existingDocumentHashes: new Set(["synthetic_valid_pqc_whitepaper_latticeguard_2026"]),
    signerKeys: {
      secretKey: signerKeys.secretKey,
      publicKey: signerKeys.publicKey,
      fingerprint: signerKeys.fingerprint,
    },
    agentAuthenticator: authenticator,
    contractAddress: "0x91F56B77a284F49c1220a2B0Fe29B6f98EAfDE58",
    blockchainSignerOrProvider: null,
    isDemoMode: true,
  });

  assert.equal(result.decision.finalDecision, "REJECTED");
  assert.equal(result.decision.agentSummaries.fraudCheck, false);
  assert.equal(result.transactionResult, undefined, "No transaction should be executed for rejected proposals");
});

test("3. End-to-End Pipeline: Overbudget Proposal Rejection", async () => {
  const signerKeys = PQCService.getActiveKeyPair();
  const authenticator = AgentAuthenticatorManager.getAuthenticatorConfig();

  const result = await MultiAgentAllocationPipeline.runPipeline({
    rawApplication: overbudgetApp, // Requests 12,000 QOR, max is 5,000 QOR
    poolData: {
      id: pool.id,
      category: pool.category,
      remainingBudgetBaseUnits: pool.remainingBudget,
      maxGrantLimitBaseUnits: pool.maxGrantPerApplicant,
      dailyCapBaseUnits: pool.dailyCap,
      dailySpentBaseUnits: pool.dailySpent,
      permittedCategories: [pool.category],
      eligibilityCriteria: pool.eligibilityCriteria,
    },
    historicalApplications: [],
    existingDocumentHashes: new Set(),
    signerKeys: {
      secretKey: signerKeys.secretKey,
      publicKey: signerKeys.publicKey,
      fingerprint: signerKeys.fingerprint,
    },
    agentAuthenticator: authenticator,
    contractAddress: "0x91F56B77a284F49c1220a2B0Fe29B6f98EAfDE58",
    blockchainSignerOrProvider: null,
    isDemoMode: true,
  });

  assert.equal(result.decision.finalDecision, "REJECTED");
  assert.equal(result.decision.agentSummaries.financialPolicy, false);
  assert.equal(result.decision.agentSummaries.eligibility, false);
});

test("4. Transaction Agent: Signature Tampering Rejection", async () => {
  const keys = generateMLDSA87KeyPair();
  const authenticator = AgentAuthenticatorManager.getAuthenticatorConfig();

  const payload: CanonicalDecisionPayload = {
    applicationId: "app_test_tamper",
    poolId: pool.id,
    beneficiary: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    category: "POST_QUANTUM_CRYPTO",
    requestedAmountBaseUnits: "1000000000000000000000",
    approvedAmountBaseUnits: "1000000000000000000000",
    milestoneIndex: 0,
    decisionStatus: "APPROVED",
    policyHash: "0xpolicy",
    evidenceRootHash: "0xevidence",
    agentEvaluatorFingerprint: keys.fingerprint,
    timestamp: Math.floor(Date.now() / 1000),
    nonce: "tamper_nonce",
  };

  const sigBundle = signCanonicalDecisionPayload(keys.secretKey, keys.publicKey, payload);

  // Adversary alters beneficiary in the payload
  const tamperedPayload = {
    ...payload,
    beneficiary: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  };

  const txResult = await AutonomousTransactionAgent.executeDisbursement({
    canonicalPayload: tamperedPayload,
    signatureBundle: sigBundle,
    agentAuthenticator: authenticator,
    contractAddress: "0x91F56B77a284F49c1220a2B0Fe29B6f98EAfDE58",
    signerOrProvider: null,
    isDemoMode: true,
  });

  assert.equal(txResult.success, false);
  assert.match(txResult.errorMessage || "", /Post-quantum signature verification failed/);
});

test("5. Transaction Agent: Expired EVM Authorization Window Blocks Execution", async () => {
  const keys = generateMLDSA87KeyPair();
  const authenticator = {
    ...AgentAuthenticatorManager.getAuthenticatorConfig(),
    scopedEvmAuthWindow: {
      isOpen: false, // Window closed/expired
      authorizedAt: Math.floor(Date.now() / 1000) - 8000,
      expiresAt: Math.floor(Date.now() / 1000) - 800,
      remainingSeconds: 0,
    },
  };

  const payload: CanonicalDecisionPayload = {
    applicationId: "app_test_expired_window",
    poolId: pool.id,
    beneficiary: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    category: "POST_QUANTUM_CRYPTO",
    requestedAmountBaseUnits: "500000000000000000000",
    approvedAmountBaseUnits: "500000000000000000000",
    milestoneIndex: 0,
    decisionStatus: "APPROVED",
    policyHash: "0xpolicy",
    evidenceRootHash: "0xevidence",
    agentEvaluatorFingerprint: keys.fingerprint,
    timestamp: Math.floor(Date.now() / 1000),
    nonce: "expired_nonce",
  };

  const sigBundle = signCanonicalDecisionPayload(keys.secretKey, keys.publicKey, payload);

  const txResult = await AutonomousTransactionAgent.executeDisbursement({
    canonicalPayload: payload,
    signatureBundle: sigBundle,
    agentAuthenticator: authenticator,
    contractAddress: "0x91F56B77a284F49c1220a2B0Fe29B6f98EAfDE58",
    signerOrProvider: null,
    isDemoMode: true,
  });

  assert.equal(txResult.success, false);
  assert.match(txResult.errorMessage || "", /EVM Authorization Window has expired/);
});

test("6. Transaction Agent: Revoked Authenticator Blocks Execution", async () => {
  const keys = generateMLDSA87KeyPair();
  const authenticator = {
    ...AgentAuthenticatorManager.getAuthenticatorConfig(),
    isRevoked: true, // Administrator revoked!
  };

  const payload: CanonicalDecisionPayload = {
    applicationId: "app_test_revoked_agent",
    poolId: pool.id,
    beneficiary: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    category: "POST_QUANTUM_CRYPTO",
    requestedAmountBaseUnits: "500000000000000000000",
    approvedAmountBaseUnits: "500000000000000000000",
    milestoneIndex: 0,
    decisionStatus: "APPROVED",
    policyHash: "0xpolicy",
    evidenceRootHash: "0xevidence",
    agentEvaluatorFingerprint: keys.fingerprint,
    timestamp: Math.floor(Date.now() / 1000),
    nonce: "revoked_nonce",
  };

  const sigBundle = signCanonicalDecisionPayload(keys.secretKey, keys.publicKey, payload);

  const txResult = await AutonomousTransactionAgent.executeDisbursement({
    canonicalPayload: payload,
    signatureBundle: sigBundle,
    agentAuthenticator: authenticator,
    contractAddress: "0x91F56B77a284F49c1220a2B0Fe29B6f98EAfDE58",
    signerOrProvider: null,
    isDemoMode: true,
  });

  assert.equal(txResult.success, false);
  assert.match(txResult.errorMessage || "", /Agent authenticator permissions have been revoked/);
});

test("7. Transaction Agent: Spending Cap Exceeded Blocks Execution", async () => {
  const keys = generateMLDSA87KeyPair();
  const authenticator = {
    ...AgentAuthenticatorManager.getAuthenticatorConfig(),
    maxSpendPerTransaction: "100000000000000000000", // 100 QOR max
  };

  const payload: CanonicalDecisionPayload = {
    applicationId: "app_test_cap_exceeded",
    poolId: pool.id,
    beneficiary: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    category: "POST_QUANTUM_CRYPTO",
    requestedAmountBaseUnits: "500000000000000000000", // 500 QOR > 100 QOR cap!
    approvedAmountBaseUnits: "500000000000000000000",
    milestoneIndex: 0,
    decisionStatus: "APPROVED",
    policyHash: "0xpolicy",
    evidenceRootHash: "0xevidence",
    agentEvaluatorFingerprint: keys.fingerprint,
    timestamp: Math.floor(Date.now() / 1000),
    nonce: "cap_nonce",
  };

  const sigBundle = signCanonicalDecisionPayload(keys.secretKey, keys.publicKey, payload);

  const txResult = await AutonomousTransactionAgent.executeDisbursement({
    canonicalPayload: payload,
    signatureBundle: sigBundle,
    agentAuthenticator: authenticator,
    contractAddress: "0x91F56B77a284F49c1220a2B0Fe29B6f98EAfDE58",
    signerOrProvider: null,
    isDemoMode: true,
  });

  assert.equal(txResult.success, false);
  assert.match(txResult.errorMessage || "", /exceeds restricted agent max spend per transaction/);
});
