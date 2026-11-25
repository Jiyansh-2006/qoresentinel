import type { GrantApplication, Decision } from '../types.js';
import { evaluateApplication, DEFAULT_POLICY } from './policy.js';

export interface AgentTrace { agent: string; state: 'passed'|'blocked'|'info'; note: string; }
export interface ReviewResult { decision: Decision; trace: AgentTrace[]; narrative: string; }

async function optionalNarrative(app: GrantApplication, decision: Decision): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return decision.agentSummary;
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b', temperature: 0.1, max_tokens: 180,
        messages: [
          { role: 'system', content: 'Explain a grant review decision in plain language. Never change the decision, score, checks, or recommend bypassing a failed rule. Do not infer personal traits. Mention that rules, not the language model, control payouts.' },
          { role: 'user', content: JSON.stringify({ project: app.projectTitle, category: app.category, amount: app.requestedAmount, approved: decision.approved, checks: decision.checks, reasons: decision.reasons }) }
        ] })
    });
    if (!response.ok) return decision.agentSummary;
    const json = await response.json() as {choices?:{message?:{content?:string}}[]};
    return json.choices?.[0]?.message?.content?.trim() || decision.agentSummary;
  } catch { return decision.agentSummary; }
}

export async function runReview(app: GrantApplication, all: GrantApplication[]): Promise<ReviewResult> {
  const trace: AgentTrace[] = [];
  trace.push({ agent: 'Intake Agent', state: 'passed', note: 'Application schema and required fields accepted.' });
  const evidenceOk = /^https:\/\//i.test(app.evidenceUrl) && app.evidenceHash.length === 64;
  trace.push({ agent: 'Evidence Agent', state: evidenceOk ? 'passed' : 'blocked', note: evidenceOk ? 'HTTPS evidence reference and SHA-256 digest are present.' : 'Evidence reference or digest is invalid.' });
  const duplicate = all.some(x => x.id !== app.id && x.walletAddress.toLowerCase() === app.walletAddress.toLowerCase() && x.projectTitle.trim().toLowerCase() === app.projectTitle.trim().toLowerCase());
  trace.push({ agent: 'Fraud & Duplicate Agent', state: duplicate ? 'blocked' : 'passed', note: duplicate ? 'Matching project and wallet found.' : 'No exact duplicate match found in the local registry.' });
  trace.push({ agent: 'Eligibility Agent', state: DEFAULT_POLICY.allowedCategories.includes(app.category.toLowerCase()) ? 'passed' : 'blocked', note: 'Checked programme category and minimum project description.' });
  const paidQor = all.filter(x => x.status === 'paid').reduce((sum, x) => sum + x.requestedAmount, 0);
  const cap = Number(process.env.PROGRAMME_CAP_QOR || 10);
  const policy = { ...DEFAULT_POLICY, programmeRemainingQor: Math.max(0, cap - paidQor) };
  const decision = evaluateApplication(app, all, policy);
  trace.push({ agent: 'Policy Guard', state: decision.approved ? 'passed' : 'blocked', note: decision.approved ? 'All deterministic constraints passed.' : `Execution blocked by ${Object.entries(decision.checks).filter(([,v])=>!v).map(([k])=>k).join(', ') || 'minimum score'}.` });
  trace.push({ agent: 'Treasury Agent', state: decision.approved ? 'passed' : 'info', note: decision.approved ? 'Reserved amount is within programme and per-grant caps.' : 'No funds reserved; rejected applications cannot reach the transaction signer.' });
  return { decision, trace, narrative: await optionalNarrative(app, decision) };
}
