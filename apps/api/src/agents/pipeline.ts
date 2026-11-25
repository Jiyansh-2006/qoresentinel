import { ApplicationIntakeAgent } from "./intakeAgent.js";
import { DocumentVerificationAgent } from "./documentAgent.js";
import { EligibilityAgent, PoolEligibilityCriteria } from "./eligibilityAgent.js";
import { FraudDetectionAgent, PastApplicationRecord } from "./fraudAgent.js";
import { FinancialPolicyAgent } from "./financialAgent.js";
import { DecisionCoordinatorAgent } from "./coordinatorAgent.js";
import { AutonomousTransactionAgent } from "./transactionAgent.js";
import {
  CanonicalDecisionPayload,
  CoordinatorDecisionOutput,
  TransactionExecutionResult,
  AgentAuthenticatorConfig,
  qorToBaseUnits,
} from "@qoresentinel/shared";
import { ethers } from "ethers";

export type AgentPipelineEventCallback = (event: {
  agentRole: string;
  agentName: string;
  stepIndex: number;
  totalSteps: number;
  status: "START" | "COMPLETE" | "ERROR";
  executionMs: number;
  data: any;
  timestamp: number;
}) => void;

export class MultiAgentAllocationPipeline {
  /**
   * Executes the end-to-end multi-agent evaluation and allocation pipeline.
   */
  public static async runPipeline(params: {
    rawApplication: any;
    poolData: {
      id: string;
      category: any;
      remainingBudgetBaseUnits: string;
      maxGrantLimitBaseUnits: string;
      dailyCapBaseUnits: string;
      dailySpentBaseUnits: string;
      permittedCategories: any[];
      eligibilityCriteria: string[];
    };
    historicalApplications: PastApplicationRecord[];
    existingDocumentHashes: Set<string>;
    signerKeys: {
      secretKey: Uint8Array | string;
      publicKey: Uint8Array | string;
      fingerprint: string;
    };
    agentAuthenticator: AgentAuthenticatorConfig;
    contractAddress: string;
    blockchainSignerOrProvider: ethers.Signer | ethers.Provider | null;
    isDemoMode: boolean;
    onProgress?: AgentPipelineEventCallback;
  }): Promise<{
    applicationId: string;
    decision: CoordinatorDecisionOutput;
    transactionResult?: TransactionExecutionResult;
    executionTimeline: Array<{
      agent: string;
      executionMs: number;
      status: string;
    }>;
  }> {
    const {
      rawApplication,
      poolData,
      historicalApplications,
      existingDocumentHashes,
      signerKeys,
      agentAuthenticator,
      contractAddress,
      blockchainSignerOrProvider,
      isDemoMode,
      onProgress,
    } = params;

    const timeline: Array<{ agent: string; executionMs: number; status: string }> = [];

    const notify = (
      role: string,
      name: string,
      step: number,
      status: "START" | "COMPLETE" | "ERROR",
      ms: number,
      data: any
    ) => {
      if (onProgress) {
        onProgress({
          agentRole: role,
          agentName: name,
          stepIndex: step,
          totalSteps: 7,
          status,
          executionMs: ms,
          data,
          timestamp: Date.now(),
        });
      }
    };

    // --- STEP 1: Application Intake ---
    let t0 = Date.now();
    notify(ApplicationIntakeAgent.role, ApplicationIntakeAgent.name, 1, "START", 0, null);
    const intakeResult = await ApplicationIntakeAgent.process(rawApplication);
    let ms1 = Date.now() - t0;
    timeline.push({ agent: ApplicationIntakeAgent.name, executionMs: ms1, status: intakeResult.valid ? "SUCCESS" : "FAILED" });
    notify(ApplicationIntakeAgent.role, ApplicationIntakeAgent.name, 1, intakeResult.valid ? "COMPLETE" : "ERROR", ms1, intakeResult);

    if (!intakeResult.valid) {
      throw new Error(`Application Intake Rejected: ${intakeResult.errors.join("; ")}`);
    }

    const appId = intakeResult.applicationId;

    // --- STEP 2: Document Verification ---
    t0 = Date.now();
    notify(DocumentVerificationAgent.role, DocumentVerificationAgent.name, 2, "START", 0, null);
    const docResult = await DocumentVerificationAgent.process(
      rawApplication.supportingDocuments || [],
      existingDocumentHashes
    );
    let ms2 = Date.now() - t0;
    timeline.push({ agent: DocumentVerificationAgent.name, executionMs: ms2, status: "SUCCESS" });
    notify(DocumentVerificationAgent.role, DocumentVerificationAgent.name, 2, "COMPLETE", ms2, docResult);

    // --- STEP 3: Eligibility Agent ---
    t0 = Date.now();
    notify(EligibilityAgent.role, EligibilityAgent.name, 3, "START", 0, null);
    const poolCriteria: PoolEligibilityCriteria = {
      poolCategory: poolData.category,
      maxGrantQOR: Number(BigInt(poolData.maxGrantLimitBaseUnits) / 10n ** 18n),
      permittedCategories: poolData.permittedCategories,
      eligibilityCriteria: poolData.eligibilityCriteria,
    };
    const eligibilityResult = await EligibilityAgent.process(
      {
        category: rawApplication.category,
        requestedAmountQOR: rawApplication.requestedAmountQOR,
        projectTitle: rawApplication.projectTitle,
        projectDescription: rawApplication.projectDescription,
        milestones: rawApplication.milestones,
      },
      poolCriteria
    );
    let ms3 = Date.now() - t0;
    timeline.push({ agent: EligibilityAgent.name, executionMs: ms3, status: eligibilityResult.eligible ? "SUCCESS" : "REJECTED" });
    notify(EligibilityAgent.role, EligibilityAgent.name, 3, "COMPLETE", ms3, eligibilityResult);

    // --- STEP 4: Fraud and Duplicate Detection ---
    t0 = Date.now();
    notify(FraudDetectionAgent.role, FraudDetectionAgent.name, 4, "START", 0, null);
    const fraudResult = await FraudDetectionAgent.process(
      {
        id: appId,
        applicantEmail: rawApplication.applicantEmail,
        projectTitle: rawApplication.projectTitle,
        beneficiaryWallet: rawApplication.beneficiaryWalletAddress,
        requestedAmountQOR: rawApplication.requestedAmountQOR,
        budgetBreakdown: rawApplication.budgetBreakdown,
        documentHashes: docResult.documents.map((d) => d.sha256Hash),
      },
      historicalApplications
    );
    let ms4 = Date.now() - t0;
    timeline.push({ agent: FraudDetectionAgent.name, executionMs: ms4, status: fraudResult.passed ? "SUCCESS" : "FAILED" });
    notify(FraudDetectionAgent.role, FraudDetectionAgent.name, 4, "COMPLETE", ms4, fraudResult);

    // --- STEP 5: Financial Policy Agent ---
    t0 = Date.now();
    notify(FinancialPolicyAgent.role, FinancialPolicyAgent.name, 5, "START", 0, null);
    const financialResult = await FinancialPolicyAgent.process(
      {
        requestedAmountQOR: rawApplication.requestedAmountQOR,
        milestones: rawApplication.milestones,
      },
      poolData
    );
    let ms5 = Date.now() - t0;
    timeline.push({ agent: FinancialPolicyAgent.name, executionMs: ms5, status: financialResult.approved ? "SUCCESS" : "FAILED" });
    notify(FinancialPolicyAgent.role, FinancialPolicyAgent.name, 5, "COMPLETE", ms5, financialResult);

    // --- STEP 6: Decision Coordinator Agent ---
    t0 = Date.now();
    notify(DecisionCoordinatorAgent.role, DecisionCoordinatorAgent.name, 6, "START", 0, null);
    const requestedBaseUnits = qorToBaseUnits(rawApplication.requestedAmountQOR, true);

    const coordinatorDecision = await DecisionCoordinatorAgent.evaluateAndSign(
      {
        applicationId: appId,
        poolId: poolData.id,
        beneficiary: rawApplication.beneficiaryWalletAddress,
        category: rawApplication.category,
        requestedAmountBaseUnits: requestedBaseUnits,
      },
      {
        intake: intakeResult,
        documents: docResult,
        eligibility: eligibilityResult,
        fraud: fraudResult,
        financial: financialResult,
      },
      signerKeys
    );
    let ms6 = Date.now() - t0;
    timeline.push({ agent: DecisionCoordinatorAgent.name, executionMs: ms6, status: coordinatorDecision.finalDecision });
    notify(DecisionCoordinatorAgent.role, DecisionCoordinatorAgent.name, 6, "COMPLETE", ms6, coordinatorDecision);

    // --- STEP 7: Autonomous Transaction Agent (if approved) ---
    let txResult: TransactionExecutionResult | undefined;
    if (coordinatorDecision.finalDecision === "APPROVED" && coordinatorDecision.pqcSignatureBundle) {
      t0 = Date.now();
      notify(AutonomousTransactionAgent.role, AutonomousTransactionAgent.name, 7, "START", 0, null);

      txResult = await AutonomousTransactionAgent.executeDisbursement({
        canonicalPayload: coordinatorDecision.canonicalPayload,
        signatureBundle: coordinatorDecision.pqcSignatureBundle,
        agentAuthenticator,
        contractAddress,
        signerOrProvider: blockchainSignerOrProvider,
        isDemoMode,
      });

      let ms7 = Date.now() - t0;
      timeline.push({ agent: AutonomousTransactionAgent.name, executionMs: ms7, status: txResult.success ? "CONFIRMED" : "FAILED" });
      notify(AutonomousTransactionAgent.role, AutonomousTransactionAgent.name, 7, txResult.success ? "COMPLETE" : "ERROR", ms7, txResult);
    }

    return {
      applicationId: appId,
      decision: coordinatorDecision,
      transactionResult: txResult,
      executionTimeline: timeline,
    };
  }
}
