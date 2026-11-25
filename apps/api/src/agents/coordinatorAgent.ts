import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import {
  CanonicalDecisionPayload,
  CoordinatorDecisionOutput,
  IntakeAgentOutput,
  DocumentVerificationOutput,
  EligibilityAgentOutput,
  FraudAssessmentOutput,
  FinancialPolicyOutput,
  PQCSignatureBundle,
  ProjectCategory,
} from "@qoresentinel/shared";
import { signCanonicalDecisionPayload, verifyCanonicalDecisionSignature } from "@qoresentinel/crypto";

export class DecisionCoordinatorAgent {
  public static readonly role = "COORDINATOR_AGENT";
  public static readonly name = "Decision Coordinator Agent";

  /**
   * Deterministically synthesizes inputs from specialized agents and renders
   * an authoritative, cryptographically signed allocation decision.
   */
  public static async evaluateAndSign(
    applicationData: {
      applicationId: string;
      poolId: string;
      beneficiary: string;
      category: ProjectCategory;
      requestedAmountBaseUnits: string;
    },
    agentOutputs: {
      intake: IntakeAgentOutput;
      documents: DocumentVerificationOutput;
      eligibility: EligibilityAgentOutput;
      fraud: FraudAssessmentOutput;
      financial: FinancialPolicyOutput;
    },
    signerKeys: {
      secretKey: Uint8Array | string;
      publicKey: Uint8Array | string;
      fingerprint: string;
    }
  ): Promise<CoordinatorDecisionOutput> {
    const reasons: string[] = [];

    const intakePassed = agentOutputs.intake.valid;
    const docsPassed = !agentOutputs.documents.duplicateDetected && agentOutputs.documents.documents.every((d) => d.syntheticEvidenceValid);
    const eligibilityPassed = agentOutputs.eligibility.eligible;
    const fraudPassed = agentOutputs.fraud.passed;
    const financialPassed = agentOutputs.financial.approved;

    const allPassed = intakePassed && docsPassed && eligibilityPassed && fraudPassed && financialPassed;

    if (!intakePassed) {
      reasons.push(`Intake validation failure: ${agentOutputs.intake.errors.join(", ")}`);
    }
    if (!docsPassed) {
      reasons.push(`Document verification failure: ${agentOutputs.documents.notes.join("; ")}`);
    }
    if (!eligibilityPassed) {
      reasons.push(`Eligibility requirements unmet: ${agentOutputs.eligibility.missingRequirements.join("; ")}`);
    }
    if (!fraudPassed) {
      reasons.push(`Fraud risk threshold exceeded: ${agentOutputs.fraud.details}`);
    }
    if (!financialPassed) {
      reasons.push(`Financial policy non-compliance: ${agentOutputs.financial.failureReason || "Cap exceeded"}`);
    }

    if (allPassed) {
      reasons.push(
        "Proposal successfully satisfied all eligibility thresholds, treasury constraints, and fraud resistance standards."
      );
    }

    const decisionStatus = allPassed ? "APPROVED" : "REJECTED";
    const status = allPassed ? "EXECUTION_PENDING" : "REJECTED";

    // Generate deterministic policy hash
    const policyRules = "QORE_SENTINEL_POLICY_FIPS204_DIANA_v1.0";
    const policyHash = `0x${bytesToHex(sha256(new TextEncoder().encode(policyRules)))}`;

    // Build canonical decision payload for cryptographic post-quantum signing
    const canonicalPayload: CanonicalDecisionPayload = {
      applicationId: applicationData.applicationId,
      poolId: applicationData.poolId,
      beneficiary: applicationData.beneficiary,
      category: applicationData.category,
      requestedAmountBaseUnits: applicationData.requestedAmountBaseUnits,
      approvedAmountBaseUnits: allPassed ? applicationData.requestedAmountBaseUnits : "0",
      milestoneIndex: 0,
      decisionStatus,
      policyHash,
      evidenceRootHash: agentOutputs.documents.evidenceRootHash || "0x0000000000000000000000000000000000000000000000000000000000000000",
      agentEvaluatorFingerprint: signerKeys.fingerprint,
      timestamp: Math.floor(Date.now() / 1000),
      nonce: `qor_nonce_${bytesToHex(sha256(new TextEncoder().encode(`${applicationData.applicationId}:${Date.now()}`))).slice(0, 16)}`,
    };

    // Sign with NIST FIPS 204 ML-DSA-87
    let pqcSignatureBundle: PQCSignatureBundle | undefined;
    if (allPassed) {
      pqcSignatureBundle = signCanonicalDecisionPayload(
        signerKeys.secretKey,
        signerKeys.publicKey,
        canonicalPayload
      );

      // Verify the signature immediately to guarantee integrity before dispatching
      const verification = verifyCanonicalDecisionSignature(
        signerKeys.publicKey,
        canonicalPayload,
        pqcSignatureBundle
      );

      if (!verification.valid) {
        throw new Error(`Self-verification of ML-DSA-87 signature failed: ${verification.error}`);
      }
    }

    return {
      finalDecision: decisionStatus,
      status,
      reasons,
      agentSummaries: {
        intake: intakePassed,
        documentVerification: docsPassed,
        eligibility: eligibilityPassed,
        fraudCheck: fraudPassed,
        financialPolicy: financialPassed,
      },
      canonicalPayload,
      pqcSignatureBundle,
    };
  }
}
