import { getApplication, getApplications, saveApplication } from '../db/store.js';
import { signAgentCommand, verifyAgentCommand } from '../crypto/pqc.js';
import { executeGrantOnChain } from '../chain/qorechain.js';
import { logActivity } from './activity.js';

export async function executeApprovedApplication(id: string) {
  const app = getApplication(id);
  if (!app) throw new Error('Application not found.');
  if (!app.decision?.approved) throw new Error('Policy gate rejected this application.');
  if (app.status === 'paid' || app.status === 'simulated') throw new Error('This application has already been executed or simulated.');
  const command = { action: 'PAY_GRANT', applicationId: app.id, walletAddress: app.walletAddress, amountQor: app.requestedAmount, evidenceHash: app.evidenceHash, issuedAt: new Date().toISOString() };
  const signature = signAgentCommand(command);
  if (!verifyAgentCommand(command, signature)) throw new Error('Agent ML-DSA command authentication failed.');
  const result = await executeGrantOnChain({ applicationId: app.id, walletAddress: app.walletAddress, amountQor: app.requestedAmount, evidenceHash: app.evidenceHash });
  app.status = result.simulated ? 'simulated' : 'paid'; app.txHash = result.txHash; saveApplication(app);
  logActivity('PAYOUT', result.simulated ? 'Grant payout simulated' : 'Grant paid on QoreChain', `${app.projectTitle} · ${app.requestedAmount} QOR · ML-DSA command verified`, 'success', result.txHash);
  return { app, result, commandSignature: signature };
}
