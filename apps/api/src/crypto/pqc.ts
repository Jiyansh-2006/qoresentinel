import { mldsa } from '@qorechain/pqc';
import { createHash } from 'node:crypto';

const fromHex = (hex: string) => new Uint8Array(Buffer.from(hex.replace(/^0x/, ''), 'hex'));
const toHex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');
let pair: { publicKey: Uint8Array; secretKey: Uint8Array };
// The hackathon demo generates a fresh process-local key. Production deployments must
// replace this provider with a persistent HSM/KMS-backed ML-DSA-87 signer.
pair = mldsa.keygen();

export function hashEvidence(value: string): string { return createHash('sha256').update(value).digest('hex'); }
export function getAgentPqcPublicKey(): string { return toHex(pair.publicKey); }
export function signAgentCommand(command: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(command));
  return toHex(mldsa.sign(pair.secretKey, bytes));
}
export function verifyAgentCommand(command: unknown, signatureHex: string): boolean {
  try { return mldsa.verify(pair.publicKey, new TextEncoder().encode(JSON.stringify(command)), fromHex(signatureHex)); }
  catch { return false; }
}
export function verifyPqcMessage(publicKeyHex: string, message: string, signatureHex: string): boolean {
  try { return mldsa.verify(fromHex(publicKeyHex), new TextEncoder().encode(message), fromHex(signatureHex)); }
  catch { return false; }
}
