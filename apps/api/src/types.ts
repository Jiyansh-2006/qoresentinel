export type ApplicationStatus = 'submitted' | 'reviewing' | 'approved' | 'rejected' | 'paid' | 'simulated';
export interface GrantApplication {
  id: string; applicantName: string; applicantEmail: string; walletAddress: string;
  projectTitle: string; category: string; requestedAmount: number; summary: string;
  evidenceUrl: string; evidenceHash: string; createdAt: string; status: ApplicationStatus;
  decision?: Decision; txHash?: string;
}
export interface Decision {
  approved: boolean; score: number; risk: 'low' | 'medium' | 'high'; reasons: string[];
  checks: { eligibility: boolean; evidence: boolean; duplicate: boolean; budget: boolean; wallet: boolean };
  agentSummary: string; decidedAt: string;
}
export interface Activity { id: string; at: string; type: string; title: string; detail: string; status: 'success' | 'warning' | 'info'; txHash?: string; }
