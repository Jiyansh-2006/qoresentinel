import type { GrantApplication, Decision } from '../types.js';

export interface PolicyConfig { maxGrantQor: number; programmeRemainingQor: number; minScore: number; allowedCategories: string[]; }
export const DEFAULT_POLICY: PolicyConfig = {
  maxGrantQor: Number(process.env.MAX_GRANT_QOR || 1),
  programmeRemainingQor: Number(process.env.PROGRAMME_REMAINING_QOR || 10),
  minScore: 70,
  allowedCategories: ['education', 'community', 'climate', 'accessibility', 'open-source']
};

const validWallet = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value);
const safeEvidenceUrl = (value: string) => /^https:\/\//i.test(value) && !/(localhost|127\.0\.0\.1|\.local)/i.test(value);

export function evaluateApplication(app: GrantApplication, all: GrantApplication[], policy = DEFAULT_POLICY): Decision {
  const duplicate = all.some(other => other.id !== app.id && other.walletAddress.toLowerCase() === app.walletAddress.toLowerCase() && other.projectTitle.trim().toLowerCase() === app.projectTitle.trim().toLowerCase());
  const categoryOk = policy.allowedCategories.includes(app.category.toLowerCase());
  const amountOk = Number.isFinite(app.requestedAmount) && app.requestedAmount > 0 && app.requestedAmount <= policy.maxGrantQor && app.requestedAmount <= policy.programmeRemainingQor;
  const walletOk = validWallet(app.walletAddress);
  const evidenceOk = safeEvidenceUrl(app.evidenceUrl) && app.evidenceHash.length === 64;
  const summaryOk = app.summary.trim().length >= 80;
  const eligibility = categoryOk && summaryOk;
  const checks = { eligibility, evidence: evidenceOk, duplicate: !duplicate, budget: amountOk, wallet: walletOk };
  let score = 0;
  if (categoryOk) score += 20;
  if (summaryOk) score += 15;
  if (evidenceOk) score += 25;
  if (!duplicate) score += 20;
  if (amountOk) score += 10;
  if (walletOk) score += 10;
  const failed = Object.entries(checks).filter(([,ok]) => !ok).map(([name]) => name);
  const highRisk = duplicate || !walletOk || !evidenceOk;
  const approved = failed.length === 0 && score >= policy.minScore;
  const reasons: string[] = [];
  if (!categoryOk) reasons.push('Category is outside the active programme mandate.');
  if (!summaryOk) reasons.push('Project summary must contain at least 80 characters.');
  if (!evidenceOk) reasons.push('Evidence must use HTTPS and include a 64-character SHA-256 digest.');
  if (duplicate) reasons.push('A matching project and applicant wallet already exist.');
  if (!amountOk) reasons.push(`Requested amount exceeds the current per-grant or remaining programme budget (${policy.maxGrantQor} QOR per grant).`);
  if (!walletOk) reasons.push('Beneficiary wallet format is not recognised.');
  if (approved) reasons.push('All deterministic programme rules passed.');
  return {
    approved, score, risk: highRisk ? 'high' : failed.length ? 'medium' : 'low', checks, reasons,
    agentSummary: approved
      ? 'The review agents found the application eligible. The deterministic policy gate passed; payout remains subject to the configured on-chain vault limits.'
      : 'The review agents stopped this request before execution. The failed checks below are the reason; an LLM cannot override these policy results.',
    decidedAt: new Date().toISOString()
  };
}
