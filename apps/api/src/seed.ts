import { randomUUID } from 'node:crypto';
import { getApplications, saveApplication } from './db/store.js';
import { hashEvidence } from './crypto/pqc.js';
import { runReview } from './agents/orchestrator.js';
import type { GrantApplication } from './types.js';

export async function seedDemoData() {
  if (getApplications().length) return;
  const now = Date.now();
  const examples = [
    { applicantName:'Aarav Mehta', applicantEmail:'aarav.demo@example.org', walletAddress:'0x1111111111111111111111111111111111111111', projectTitle:'Community STEM Lab', category:'education', requestedAmount:0.45, summary:'A weekend STEM learning lab providing reusable electronics kits, mentor-led workshops, and accessible learning materials for students from underserved neighbourhood schools. The grant funds shared kits and transport for volunteer mentors.', evidenceUrl:'https://example.org/evidence/stem-lab' },
    { applicantName:'Mira Sen', applicantEmail:'mira.demo@example.org', walletAddress:'0x2222222222222222222222222222222222222222', projectTitle:'Neighbourhood Solar Mapping', category:'climate', requestedAmount:1.4, summary:'A community-led open dataset mapping rooftop solar suitability and public-building energy usage. The team will publish the dataset and run a workshop explaining how residents can use the findings to plan local clean-energy projects.', evidenceUrl:'https://example.org/evidence/solar-map' },
    { applicantName:'Kabir Das', applicantEmail:'kabir.demo@example.org', walletAddress:'0x1111111111111111111111111111111111111111', projectTitle:'Community STEM Lab', category:'education', requestedAmount:0.4, summary:'A duplicate sample entry intentionally reuses the first applicant wallet and project title so the duplicate-detection agent can demonstrate a safe rejection. This record is synthetic and does not represent a real person or application.', evidenceUrl:'https://example.org/evidence/stem-lab-copy' }
  ];
  for (const [i,raw] of examples.entries()) {
    const app: GrantApplication = { ...raw, category: raw.category, id: randomUUID(), evidenceHash: hashEvidence(raw.evidenceUrl), createdAt: new Date(now - (2-i)*3600_000).toISOString(), status:'reviewing' } as GrantApplication;
    const review = await runReview(app, getApplications()); app.decision=review.decision; app.status=review.decision.approved?'approved':'rejected'; saveApplication(app);
  }
}
