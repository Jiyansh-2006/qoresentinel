import { z } from "zod";

// ============================================================================
// NETWORK CONSTANTS - QoreChain Diana Testnet
// ============================================================================
export const QORECHAIN_DIANA_CONFIG = {
  chainId: 9800,
  nativeChainId: "qorechain-diana",
  name: "QoreChain Diana Testnet",
  currencySymbol: "QOR",
  baseDenom: "uqor",
  decimals: 18,
  nativeDecimals: 6,
  rpcUrl: "https://rpc-testnet.qore.host",
  restUrl: "https://api-testnet.qore.host",
  evmRpcUrl: "https://evm-testnet.qore.host",
  svmRpcUrl: "https://svm-testnet.qore.host",
  explorerUrl: "https://explore.qore.network",
  faucetUrl: "https://dashboard.qorechain.io/faucet",
  pqcVerifyPrecompile: "0x0000000000000000000000000000000000000a01",
} as const;

// ============================================================================
// ENUMS & CONSTANT UNIONS
// ============================================================================
export type ApplicationStatus =
  | "PENDING"
  | "PROCESSING"
  | "NEEDS_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "EXECUTION_PENDING"
  | "PAID"
  | "FAILED";

export type AgentRole =
  | "INTAKE_AGENT"
  | "DOCUMENT_AGENT"
  | "ELIGIBILITY_AGENT"
  | "FRAUD_AGENT"
  | "FINANCIAL_AGENT"
  | "COORDINATOR_AGENT"
  | "TRANSACTION_AGENT";

export type ProjectCategory =
  | "POST_QUANTUM_CRYPTO"
  | "SMART_CONTRACT_SECURITY"
  | "AI_SAFETY_ORACLES"
  | "PRIVACY_ZERO_KNOWLEDGE"
  | "COMMUNITY_INFRASTRUCTURE"
  | "PUBLIC_GOODS";

export type MilestoneStatus =
  | "PENDING"
  | "SUBMITTED"
  | "VERIFIED"
  | "REJECTED"
  | "PAID";

// ============================================================================
// CANONICAL DECISION PAYLOAD (Signed with ML-DSA-87)
// ============================================================================
export interface CanonicalDecisionPayload {
  applicationId: string;
  poolId: string;
  beneficiary: string;
  category: ProjectCategory;
  requestedAmountBaseUnits: string; // in uqor or wei (string to preserve integer precision)
  approvedAmountBaseUnits: string;
  milestoneIndex: number;
  decisionStatus: "APPROVED" | "REJECTED";
  policyHash: string;
  evidenceRootHash: string;
  agentEvaluatorFingerprint: string;
  timestamp: number;
  nonce: string;
}

// ============================================================================
// PQC & SMART ACCOUNT TYPES
// ============================================================================
export interface PQCSignatureBundle {
  algorithm: "ML-DSA-87";
  publicKeyHex: string;
  publicKeyFingerprint: string;
  signatureHex: string;
  digestSha256Hex: string;
  signedAt: number;
}

export interface AgentAuthenticatorConfig {
  agentAddress: string;
  mldsaPublicKeyFingerprint: string;
  smartAccountAddress: string;
  maxSpendPerTransaction: string; // in base units
  dailySpendingLimit: string;
  currentDailySpent: string;
  validUntilTimestamp: number;
  permittedContractTargets: string[];
  isRevoked: boolean;
  scopedEvmAuthWindow: {
    isOpen: boolean;
    authorizedAt: number;
    expiresAt: number;
    remainingSeconds: number;
  };
}

export interface SecurityStatusReport {
  pqcRegistered: boolean;
  algorithm: "ML-DSA-87";
  fipsStandard: "FIPS 204 (Level 5)";
  publicKeyFingerprint: string;
  agentAuthenticatorLinked: boolean;
  authenticatorDetails: AgentAuthenticatorConfig;
  activeTargetVault: string;
  network: string;
  lastVerifiedSignature: {
    valid: boolean;
    timestamp: number;
    digest: string;
  } | null;
}

// ============================================================================
// AGENT OUTPUTS
// ============================================================================
export interface IntakeAgentOutput {
  valid: boolean;
  applicationId: string;
  sanitizedApplicant: string;
  sanitizedBeneficiary: string;
  sanitizedAmount: string;
  errors: string[];
}

export interface DocumentVerificationOutput {
  documentCount: number;
  documents: {
    id: string;
    filename: string;
    sha256Hash: string;
    ocrExtractedKeywords: string[];
    syntheticEvidenceValid: boolean;
    mimeType: string;
  }[];
  duplicateDetected: boolean;
  missingMandatoryDocuments: boolean;
  evidenceRootHash: string;
  confidence: number;
  notes: string[];
}

export interface EligibilityAgentOutput {
  eligible: boolean;
  reasons: string[];
  missingRequirements: string[];
  confidence: number;
  evidenceReferences: string[];
  categoryMatches: boolean;
}

export interface FraudAssessmentOutput {
  passed: boolean;
  riskScore: number; // 0 to 100
  duplicateApplicationDetected: boolean;
  duplicateDocumentHashDetected: boolean;
  suspiciousWalletReuse: boolean;
  inconsistentBudgetDetected: boolean;
  deterministicViolations: string[];
  details: string;
}

export interface FinancialPolicyOutput {
  approved: boolean;
  poolId: string;
  requestedAmountBaseUnits: string;
  poolBalanceBaseUnits: string;
  maxGrantLimitBaseUnits: string;
  exceedsPoolBalance: boolean;
  exceedsMaxGrantLimit: boolean;
  milestoneAllocationValid: boolean;
  milestoneDistribution: {
    milestoneIndex: number;
    percentage: number;
    amountBaseUnits: string;
  }[];
  deterministicChecksPassed: boolean;
  failureReason?: string;
}

export interface CoordinatorDecisionOutput {
  finalDecision: "APPROVED" | "REJECTED";
  status: ApplicationStatus;
  reasons: string[];
  agentSummaries: {
    intake: boolean;
    documentVerification: boolean;
    eligibility: boolean;
    fraudCheck: boolean;
    financialPolicy: boolean;
  };
  canonicalPayload: CanonicalDecisionPayload;
  pqcSignatureBundle?: PQCSignatureBundle;
}

export interface TransactionExecutionResult {
  success: boolean;
  txHash: string;
  blockNumber: number;
  network: string;
  contractAddress: string;
  beneficiary: string;
  amountBaseUnits: string;
  explorerUrl: string;
  isSimulated: boolean;
  gasUsed: string;
  timestamp: number;
  errorMessage?: string;
}

// ============================================================================
// VALIDATION SCHEMAS (ZOD)
// ============================================================================
export const CreatePoolSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(100),
  description: z.string().min(10, "Description must be at least 10 characters").max(2000),
  category: z.enum([
    "POST_QUANTUM_CRYPTO",
    "SMART_CONTRACT_SECURITY",
    "AI_SAFETY_ORACLES",
    "PRIVACY_ZERO_KNOWLEDGE",
    "COMMUNITY_INFRASTRUCTURE",
    "PUBLIC_GOODS",
  ]),
  totalBudgetQOR: z.number().positive("Total budget must be positive"),
  maxGrantQOR: z.number().positive("Max grant must be positive"),
  dailyCapQOR: z.number().positive("Daily cap must be positive"),
  eligibilityCriteria: z.array(z.string()).min(1, "At least one eligibility criterion is required"),
  requiredDocuments: z.array(z.string()).min(1, "At least one document requirement is required"),
});

export const BudgetBreakdownItemSchema = z.object({
  item: z.string().min(1),
  percentage: z.number().min(1).max(100),
  amountQOR: z.number().positive(),
  description: z.string().optional(),
});

export const MilestoneItemSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(5),
  percentage: z.number().min(1).max(100),
  expectedDeliveryWeeks: z.number().int().positive(),
});

export const SubmitApplicationSchema = z.object({
  poolId: z.string().min(1, "Pool ID is required"),
  applicantName: z.string().min(2, "Applicant name required"),
  applicantEmail: z.string().email("Valid email required"),
  projectTitle: z.string().min(3, "Project title required"),
  projectDescription: z.string().min(20, "Project description must be at least 20 characters"),
  category: z.enum([
    "POST_QUANTUM_CRYPTO",
    "SMART_CONTRACT_SECURITY",
    "AI_SAFETY_ORACLES",
    "PRIVACY_ZERO_KNOWLEDGE",
    "COMMUNITY_INFRASTRUCTURE",
    "PUBLIC_GOODS",
  ]),
  requestedAmountQOR: z.number().positive("Requested amount must be positive"),
  beneficiaryWalletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid EVM wallet address"),
  budgetBreakdown: z.array(BudgetBreakdownItemSchema).min(1, "At least one budget line item required"),
  milestones: z.array(MilestoneItemSchema).length(3, "Exactly 3 phased milestones required (e.g. 40/30/30)"),
  supportingDocuments: z.array(
    z.object({
      filename: z.string(),
      mimeType: z.string(),
      contentBase64: z.string().optional(),
      syntheticType: z.enum(["TECHNICAL_SPEC", "BUDGET_SHEET", "TEAM_CREDENTIALS", "MILESTONE_ROADMAP"]).optional(),
    })
  ).min(1, "At least one supporting document required"),
});

// ============================================================================
// CANONICAL SERIALIZATION HELPER (Deterministic JSON)
// ============================================================================
/**
 * Recursively canonicalizes an object according to RFC 8785 JSON Canonicalization Scheme (JCS).
 * Keys are sorted lexicographically, floats/ints are normalized, no extraneous whitespace.
 * Crucial for ML-DSA-87 signatures so that verifying parties calculate the exact same digest!
 */
export function canonicalizeJson(obj: any): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return `[${obj.map((item) => canonicalizeJson(item)).join(",")}]`;
  }

  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map((key) => {
    const val = obj[key];
    return `${JSON.stringify(key)}:${canonicalizeJson(val)}`;
  });

  return `{${pairs.join(",")}}`;
}

/**
 * Converts display QOR token amount into integer base units (1 QOR = 10^18 EVM wei or 10^6 native uqor)
 */
export function qorToBaseUnits(amountQor: number, isEvm: boolean = true): string {
  const decimals = isEvm ? 18 : 6;
  const factor = BigInt(10) ** BigInt(decimals);
  // Avoid floating point inaccuracies by splitting integer and fractional parts
  const [intPart, decPart = ""] = amountQor.toString().split(".");
  const paddedDec = decPart.padEnd(decimals, "0").slice(0, decimals);
  const bigInt = BigInt(intPart) * factor + BigInt(paddedDec);
  return bigInt.toString();
}

export function baseUnitsToQor(baseUnits: string, isEvm: boolean = true): number {
  const decimals = isEvm ? 18 : 6;
  const divisor = 10 ** decimals;
  return Number(BigInt(baseUnits)) / divisor;
}

export const QORECHAIN_NETWORKS = {
  9800: {
    evmChainId: 9800,
    chainId: "qorechain-diana",
    name: "QoreChain Diana Testnet",
    restUrl: "https://api-testnet.qore.host",
    nativeDenom: "uqor",
    nativeDecimals: 6,
  },
  9801: {
    evmChainId: 9801,
    chainId: "qorechain-vladi",
    name: "QoreChain Mainnet",
    restUrl: "https://api.qore.host",
    nativeDenom: "uqor",
    nativeDecimals: 6,
  },
} as const;

export type QoreChainNetwork =
  (typeof QORECHAIN_NETWORKS)[keyof typeof QORECHAIN_NETWORKS];

export function getQoreChainNetwork(
  evmChainId: number
): QoreChainNetwork | undefined {
  return QORECHAIN_NETWORKS[
    evmChainId as keyof typeof QORECHAIN_NETWORKS
  ];
}
