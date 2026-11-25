import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getApplications, getApplication, saveApplication, getActivity } from '../db/store.js';
import type { GrantApplication } from '../types.js';
import { hashEvidence, getAgentPqcPublicKey } from '../crypto/pqc.js';
import { runReview } from '../agents/orchestrator.js';
import { logActivity } from '../services/activity.js';
import { executeApprovedApplication } from '../services/execution.js';
import { networkHealth, getWindowStatus, openAgentWindow, configureSessionSpendingRule } from '../chain/qorechain.js';

export const api = Router();
const applicationSchema = z.object({
  applicantName: z.string().min(2).max(80), applicantEmail: z.string().email().max(160),
  walletAddress: z.string().min(10).max(64), projectTitle: z.string().min(4).max(100),
  category: z.enum(['education','community','climate','accessibility','open-source']),
  requestedAmount: z.number().positive().max(100), summary: z.string().min(80).max(1200),
  evidenceUrl: z.string().url().max(500)
});

api.get('/health', (_req,res) => res.json({ ok: true, service: 'qoresentinel-api', time: new Date().toISOString() }));
api.get('/overview', (_req,res) => {
  const apps = getApplications();
  const paid = apps.filter(a=>a.status==='paid');
  const approved = apps.filter(a=>a.decision?.approved);
  const rejected = apps.filter(a=>a.decision && !a.decision.approved);
  res.json({ metrics: { applications: apps.length, approved: approved.length, rejected: rejected.length, paid: paid.length, paidQor: paid.reduce((s,a)=>s+a.requestedAmount,0), pending: apps.filter(a=>a.status==='submitted'||a.status==='reviewing').length }, applications: apps.slice(0,8), activity: getActivity(8), policy: { maxGrantQor: Number(process.env.MAX_GRANT_QOR || 1), programmeCapQor: Number(process.env.PROGRAMME_CAP_QOR || 10), autoExecute: process.env.AUTO_EXECUTE === 'true', demoMode: process.env.DEMO_MODE !== 'false' } });
});
api.get('/applications', (_req,res) => res.json(getApplications()));
api.get('/applications/:id', (req,res) => { const app=getApplication(req.params.id); if(!app) return res.status(404).json({error:'Application not found'}); res.json(app); });
api.post('/applications', async (req,res) => {
  const parsed = applicationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid application', details: parsed.error.flatten() });
  const app: GrantApplication = { ...parsed.data, id: randomUUID(), evidenceHash: hashEvidence(parsed.data.evidenceUrl), createdAt: new Date().toISOString(), status: 'reviewing' };
  const before = getApplications(); saveApplication(app);
  const review = await runReview(app, before);
  app.decision = review.decision; app.status = review.decision.approved ? 'approved' : 'rejected'; saveApplication(app);
  logActivity('REVIEW', review.decision.approved ? 'Application passed policy review' : 'Application blocked by policy', `${app.projectTitle} · score ${review.decision.score}/100`, review.decision.approved ? 'success' : 'warning');
  let execution = null;
  if (review.decision.approved && process.env.AUTO_EXECUTE === 'true') {
    try { execution = await executeApprovedApplication(app.id); }
    catch (error) { logActivity('EXECUTION_BLOCKED', 'Autonomous payout stopped', error instanceof Error ? error.message : 'Unknown execution error', 'warning'); }
  }
  res.status(201).json({ application: app, review, execution, agentPublicKey: getAgentPqcPublicKey() });
});
api.post('/applications/:id/execute', async (req,res) => {
  try { const result = await executeApprovedApplication(req.params.id); res.json(result); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Execution failed' }); }
});
api.get('/activity', (_req,res) => res.json(getActivity(50)));
api.get('/crypto/agent', (_req,res) => res.json({ algorithm: 'ML-DSA-87 / FIPS 204', publicKey: getAgentPqcPublicKey(), keyPersistence: 'process-local demo key; configure a protected signer before production' }));
api.get('/chain/status', async (_req,res) => { try { res.json(await networkHealth()); } catch(e) { res.status(503).json({ error: String(e) }); } });
api.get('/chain/window/:address', async (req,res) => { try { res.json(await getWindowStatus(req.params.address)); } catch(e) { res.status(503).json({ error: e instanceof Error ? e.message : 'Unable to read window' }); } });
api.post('/chain/window/open', async (_req,res) => { try { res.json(await openAgentWindow()); } catch(e) { res.status(400).json({ error: e instanceof Error ? e.message : 'Unable to open window' }); } });

api.post('/chain/spending-rules/configure', async (_req,res) => { try { res.json(await configureSessionSpendingRule()); } catch(e) { res.status(400).json({ error: e instanceof Error ? e.message : 'Unable to configure spending rule' }); } });
