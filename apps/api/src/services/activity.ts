import { randomUUID } from 'node:crypto';
import { saveActivity } from '../db/store.js';
import type { Activity } from '../types.js';
export function logActivity(type: string, title: string, detail: string, status: Activity['status'] = 'info', txHash?: string) {
  const item: Activity = { id: randomUUID(), at: new Date().toISOString(), type, title, detail, status, txHash };
  saveActivity(item); return item;
}
