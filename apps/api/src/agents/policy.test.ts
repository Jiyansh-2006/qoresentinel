import { describe, expect, it } from 'vitest';
import { evaluateApplication } from './policy.js';
import type { GrantApplication } from '../types.js';
const base: GrantApplication = {
  id:'app-1', applicantName:'Demo Applicant', applicantEmail:'demo@example.org', walletAddress:'0x1111111111111111111111111111111111111111',
  projectTitle:'Accessible science workshops', category:'education', requestedAmount:0.4,
  summary:'This project provides accessible science workshops with shared equipment and volunteer mentors. It will publish lesson plans and run a series of hands-on sessions for local students.',
  evidenceUrl:'https://example.org/evidence', evidenceHash:'a'.repeat(64), createdAt:new Date().toISOString(), status:'reviewing'
};
describe('deterministic grant policy',()=>{
  it('approves an application that satisfies all hard checks',()=>{
    const result=evaluateApplication(base,[]);
    expect(result.approved).toBe(true); expect(result.score).toBe(100);
  });
  it('blocks an amount above the per-grant cap',()=>{
    const result=evaluateApplication({...base,requestedAmount:2},[]);
    expect(result.approved).toBe(false); expect(result.checks.budget).toBe(false);
  });
  it('blocks an exact wallet + project duplicate',()=>{
    const duplicate={...base,id:'app-2'};
    const result=evaluateApplication(duplicate,[base]);
    expect(result.approved).toBe(false); expect(result.checks.duplicate).toBe(false);
  });
  it('blocks non-EVM recipient addresses',()=>{
    const result=evaluateApplication({...base,walletAddress:'qor1not-an-evm-address'},[]);
    expect(result.approved).toBe(false); expect(result.checks.wallet).toBe(false);
  });
});
