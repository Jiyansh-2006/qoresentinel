export interface GrantPool {
  id: string;
  onChainPoolId: string;
  title: string;
  description: string;
  category: string;
  totalBudget: string;
  remainingBudget: string;
  maxGrantPerApplicant: string;
  dailyCap: string;
  dailySpent: string;
  tokenAddress: string;
  eligibilityCriteria: string[];
  requiredDocuments: string[];
  isActive: boolean;
  isSimulated?: boolean;
  creationStatus?: string;
  fundingIntentId?: string;
  pendingInitialBudget?: string;
  totalDeposited?: string;
  totalAllocated?: string;
  totalDistributed?: string;
  reservedAmount?: string;
  remainingBalance?: string;
  numberOfApplications?: number;
  numberOfApprovedApplications?: number;
  numberOfFundedApplications?: number;
  fundingUtilizationPercent?: number;
  createdAt: string;
}

export interface GrantApplication {
  id: string;
  poolId: string;
  applicantName: string;
  applicantEmail: string;
  projectTitle: string;
  projectDescription: string;
  category: string;
  requestedAmountQOR: number;
  approvedAmountBaseUnits?: string;
  beneficiaryWalletAddress: string;
  budgetBreakdown: Array<{ item: string; percentage: number; amountQOR: number; description?: string }>;
  milestones: Array<{ title: string; description: string; percentage: number; expectedDeliveryWeeks: number }>;
  supportingDocuments: Array<{ filename: string; mimeType: string; syntheticType?: string }>;
  status: "PENDING" | "PROCESSING" | "NEEDS_REVIEW" | "APPROVED" | "REJECTED" | "EXECUTION_PENDING" | "PAID" | "FAILED";
  rejectionReason?: string;
  scenarioType?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SecurityStatus {
  pqcRegistered: boolean;
  algorithm: string;
  fipsStandard: string;
  publicKeyFingerprint: string;
  agentAuthenticatorLinked: boolean;
  activeTargetVault: string;
  network: string;
  authenticatorDetails: {
    agentAddress: string;
    mldsaPublicKeyFingerprint: string;
    smartAccountAddress: string;
    maxSpendPerTransaction: string;
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
  };
  lastVerifiedSignature: {
    valid: boolean;
    timestamp: number;
    digest: string;
  } | null;
}

export interface DashboardStats {
  totalPools: number;
  activeFundingPools: number;
  poolsRequiringReconciliation: number;
  totalFundingAcrossPoolsQOR: number;
  totalFundsDepositedQOR: number;
  remainingFundsQOR: number;
  totalAllocatedQOR: number;
  totalDisbursedQOR: number;
  pendingApplications: number;
  approvedApplications: number;
  rejectedApplications: number;
  completedDisbursements: number;
  pendingDisbursements: number;
  totalApplications: number;
  fundedApplications: number;
  failedTransactions: number;
  totalRequestedQOR: number;
  totalApprovedQOR: number;
  totalReceivedQOR: number;
  applicationsUnderReview: number;
  activeAgentsCount: number;
  recentTransactions: any[];
  recentAuditLogs: any[];
}

export interface NativeWalletBalance {
  address: string;
  chainId: number;
  network: string;
  denom: string;
  decimals: number;
  amountBaseUnits: string;
}

export interface AssistantChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentOverview {
  totalAgents: number;
  activeAgents: number;
  idleAgents: number;
  agentsRequiringAttention: number;
  totalApplicationsProcessed: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageProcessingMs: number;
  demoData: boolean;
}

export interface AgentExecutionSummary {
  id: string;
  applicationId: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  finalDecision?: string;
  error?: string;
  transactionResult?: {
    success?: boolean;
    txHash?: string;
    network?: string;
    isSimulated?: boolean;
  } | null;
}

export interface AgentExecutionReport {
  agentRole: string;
  agentName: string;
  stepIndex: number;
  status: string;
  executionMs: number;
  output: unknown;
  createdAt: string;
}

export interface AgentExecutionDetail extends AgentExecutionSummary {
  events: Array<{
    agentRole: string;
    agentName: string;
    stepIndex: number;
    totalSteps: number;
    status: "START" | "COMPLETE" | "ERROR";
    executionMs: number;
    timestamp: number;
  }>;
  reports: AgentExecutionReport[];
}
