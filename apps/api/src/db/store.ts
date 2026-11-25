import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import type { GrantApplication, Activity } from '../types.js';

export interface AuthAccount {
  id: string;
  email: string;
  fullName: string;
  passwordHash: string;
  role: 'ADMIN' | 'STUDENT';
  profile: Record<string, string>;
  createdAt: string;
}

export interface GrantPaymentIntent {
  id: string;
  applicationId: string;
  poolId: string;
  onChainPoolId: string;
  ownerEmail: string;
  fromAddress: string;
  toAddress: string;
  contractAddress: string;
  amountBaseUnits: string;
  milestoneIndex: number;
  chainId: number;
  status: 'AWAITING_SUBMISSION' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED' | 'RECONCILIATION_REQUIRED';
  txHash?: string;
  createdAt: string;
}

export interface GrantLedgerTransaction {
  id: string;
  paymentIntentId: string;
  applicationId: string;
  poolId: string;
  ownerEmail: string;
  transactionType: "GRANT_PAYMENT";
  txHash: string;
  blockNumber: number;
  fromAddress: string;
  toAddress: string;
  amount: string;
  amountDecimals: number;
  amountDenom: string;
  network: string;
  chainId: number;
  milestoneIndex: number;
  logIndex?: number;
  isSimulated: boolean;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'RECONCILIATION_REQUIRED';
  gasUsed: string;
  explorerUrl: string;
  createdAt: string;
  confirmedAt?: string;
}

export interface PoolFundingIntent {
  id: string;
  poolId: string;
  onChainPoolId: string;
  operation: "CREATE" | "DEPOSIT";
  fromAddress: string;
  amountBaseUnits: string;
  poolName?: string;
  category?: string;
  maxGrantBaseUnits?: string;
  status: "AWAITING_SUBMISSION" | "SUBMITTED" | "CONFIRMED" | "FAILED" | "RECONCILIATION_REQUIRED";
  txHash?: string;
  createdAt: string;
}

export interface PoolFundingTransaction {
  id: string;
  paymentIntentId: string;
  applicationId: "pool_funding";
  poolId: string;
  transactionType: "POOL_FUNDING";
  txHash: string;
  blockNumber: number;
  fromAddress: string;
  toAddress: string;
  amount: string;
  amountDecimals: number;
  amountDenom: string;
  network: string;
  chainId: number;
  isSimulated: false;
  status: "PENDING" | "CONFIRMED" | "FAILED" | "RECONCILIATION_REQUIRED";
  gasUsed: string;
  explorerUrl: string;
  createdAt: string;
  confirmedAt?: string;
}

const dbPath = process.env.DATABASE_PATH || './data/qoresentinel.sqlite';
fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS applications (id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS activity (id TEXT PRIMARY KEY, payload TEXT NOT NULL, at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS auth_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'STUDENT')),
  profile_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_sessions_expires_at ON auth_sessions(expires_at);
CREATE TABLE IF NOT EXISTS grant_payment_intents (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS grant_ledger_transactions (
  id TEXT PRIMARY KEY,
  payment_intent_id TEXT NOT NULL UNIQUE REFERENCES grant_payment_intents(id),
  tx_hash TEXT NOT NULL UNIQUE,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS grant_application_milestone_unique
ON grant_ledger_transactions(json_extract(payload, '$.applicationId'), json_extract(payload, '$.milestoneIndex'));
CREATE TABLE IF NOT EXISTS pool_funding_intents (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pool_funding_transactions (
  id TEXT PRIMARY KEY,
  payment_intent_id TEXT NOT NULL UNIQUE REFERENCES pool_funding_intents(id),
  tx_hash TEXT NOT NULL UNIQUE,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS platform_grant_pools (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS platform_grant_applications (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS platform_grant_decisions (
  application_id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS platform_audit_logs (
  id TEXT PRIMARY KEY,
  application_id TEXT,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`);

export function createGrantPaymentIntent(intent: GrantPaymentIntent): void {
  db.prepare(`
    INSERT INTO grant_payment_intents(id,payload,created_at)
    VALUES(?,?,?)
  `).run(intent.id, JSON.stringify(intent), intent.createdAt);
}

export function getGrantPaymentIntent(id: string): GrantPaymentIntent | undefined {
  const row = db.prepare('SELECT payload FROM grant_payment_intents WHERE id=?').get(id) as
    { payload: string } | undefined;
  return row ? JSON.parse(row.payload) as GrantPaymentIntent : undefined;
}

export function getOpenGrantPaymentIntents(poolId: string): GrantPaymentIntent[] {
  return (db.prepare(`
    SELECT payload FROM grant_payment_intents
    WHERE json_extract(payload, '$.poolId') = ?
      AND json_extract(payload, '$.status') IN ('AWAITING_SUBMISSION', 'SUBMITTED', 'RECONCILIATION_REQUIRED')
  `).all(poolId) as { payload: string }[])
    .map((row) => JSON.parse(row.payload) as GrantPaymentIntent);
}

export function saveGrantPaymentIntent(intent: GrantPaymentIntent): void {
  db.prepare(`
    INSERT INTO grant_payment_intents(id,payload,created_at)
    VALUES(?,?,?)
    ON CONFLICT(id) DO UPDATE SET payload=excluded.payload
  `).run(intent.id, JSON.stringify(intent), intent.createdAt);
}

export function saveGrantLedgerTransaction(transaction: GrantLedgerTransaction): void {
  const save = db.transaction(() => writeGrantLedgerTransaction(transaction));
  save();
}

function writeGrantLedgerTransaction(transaction: GrantLedgerTransaction): void {
  const existingHash = db.prepare(
    'SELECT id FROM grant_ledger_transactions WHERE tx_hash=?'
  ).get(transaction.txHash) as { id: string } | undefined;
  if (existingHash && existingHash.id !== transaction.id) {
    throw new Error('Transaction hash is already associated with another grant payment.');
  }

  const existingIntent = db.prepare(
    'SELECT id FROM grant_ledger_transactions WHERE payment_intent_id=?'
  ).get(transaction.paymentIntentId) as { id: string } | undefined;
  if (existingIntent && existingIntent.id !== transaction.id) {
    throw new Error('Payment intent already has a different transaction record.');
  }

  db.prepare(`
    INSERT INTO grant_ledger_transactions(id,payment_intent_id,tx_hash,payload,created_at)
    VALUES(@id,@paymentIntentId,@txHash,@payload,@createdAt)
    ON CONFLICT(id) DO UPDATE SET
      tx_hash=excluded.tx_hash,
      payload=excluded.payload
  `).run({
    id: transaction.id,
    paymentIntentId: transaction.paymentIntentId,
    txHash: transaction.txHash,
    payload: JSON.stringify(transaction),
    createdAt: transaction.createdAt,
  });
}

export function saveGrantPaymentState(
  transaction: GrantLedgerTransaction,
  intent: GrantPaymentIntent,
  application?: { id: string },
  pool?: { id: string }
): void {
  const save = db.transaction(() => {
    db.prepare(`
      INSERT INTO grant_payment_intents(id,payload,created_at)
      VALUES(?,?,?)
      ON CONFLICT(id) DO UPDATE SET payload=excluded.payload
    `).run(intent.id, JSON.stringify(intent), intent.createdAt);
    writeGrantLedgerTransaction(transaction);
    if (application) {
      savePlatformRecord('platform_grant_applications', 'id', application.id, application);
    }
    if (pool) savePlatformRecord('platform_grant_pools', 'id', pool.id, pool);
  });
  save();
}

export function getGrantLedgerTransactions(): GrantLedgerTransaction[] {
  return (db.prepare(
    'SELECT payload FROM grant_ledger_transactions ORDER BY created_at DESC'
  ).all() as { payload: string }[]).map((row) => JSON.parse(row.payload) as GrantLedgerTransaction);
}

export function createPoolFundingIntent(intent: PoolFundingIntent): void {
  db.prepare('INSERT INTO pool_funding_intents(id,payload,created_at) VALUES(?,?,?)')
    .run(intent.id, JSON.stringify(intent), intent.createdAt);
}

export function getPoolFundingIntent(id: string): PoolFundingIntent | undefined {
  const row = db.prepare('SELECT payload FROM pool_funding_intents WHERE id=?').get(id) as
    { payload: string } | undefined;
  return row ? JSON.parse(row.payload) as PoolFundingIntent : undefined;
}

export function savePoolFundingState(
  transaction: PoolFundingTransaction,
  intent: PoolFundingIntent,
  pool?: { id: string }
): void {
  const save = db.transaction(() => {
    const existingHash = db.prepare(
      'SELECT id FROM pool_funding_transactions WHERE tx_hash=?'
    ).get(transaction.txHash) as { id: string } | undefined;
    if (existingHash && existingHash.id !== transaction.id) {
      throw new Error('Transaction hash is already associated with another pool funding record.');
    }

    db.prepare(`
      INSERT INTO pool_funding_intents(id,payload,created_at)
      VALUES(?,?,?)
      ON CONFLICT(id) DO UPDATE SET payload=excluded.payload
    `).run(intent.id, JSON.stringify(intent), intent.createdAt);
    db.prepare(`
      INSERT INTO pool_funding_transactions(id,payment_intent_id,tx_hash,payload,created_at)
      VALUES(@id,@paymentIntentId,@txHash,@payload,@createdAt)
      ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,tx_hash=excluded.tx_hash
    `).run({
      id: transaction.id,
      paymentIntentId: transaction.paymentIntentId,
      txHash: transaction.txHash,
      payload: JSON.stringify(transaction),
      createdAt: transaction.createdAt,
    });
    if (pool) savePlatformRecord('platform_grant_pools', 'id', pool.id, pool);
  });
  save();
}

export function getPoolFundingTransactions(): PoolFundingTransaction[] {
  return (db.prepare(
    'SELECT payload FROM pool_funding_transactions ORDER BY created_at DESC'
  ).all() as { payload: string }[]).map((row) => JSON.parse(row.payload) as PoolFundingTransaction);
}

function savePlatformRecord(table: string, idColumn: string, id: string, payload: unknown): void {
  db.prepare(`
    INSERT INTO ${table}(${idColumn},payload,updated_at)
    VALUES(?,?,?)
    ON CONFLICT(${idColumn}) DO UPDATE SET
      payload=excluded.payload,
      updated_at=excluded.updated_at
  `).run(id, JSON.stringify(payload), new Date().toISOString());
}

function getPlatformRecords<T>(table: string): T[] {
  return (db.prepare(`SELECT payload FROM ${table} ORDER BY updated_at DESC`).all() as { payload: string }[])
    .map((row) => JSON.parse(row.payload) as T);
}

export function savePlatformPool(pool: { id: string }): void {
  savePlatformRecord('platform_grant_pools', 'id', pool.id, pool);
}

export function getPlatformPools<T>(): T[] {
  return getPlatformRecords<T>('platform_grant_pools');
}

export function savePlatformApplication(application: { id: string }): void {
  savePlatformRecord('platform_grant_applications', 'id', application.id, application);
}

export function getPlatformApplications<T>(): T[] {
  return getPlatformRecords<T>('platform_grant_applications');
}

export function savePlatformDecision(applicationId: string, decision: unknown): void {
  savePlatformRecord('platform_grant_decisions', 'application_id', applicationId, decision);
}

export function getPlatformDecisions<T>(): Array<[string, T]> {
  const rows = db.prepare(
    'SELECT application_id,payload FROM platform_grant_decisions ORDER BY updated_at DESC'
  ).all() as Array<{ application_id: string; payload: string }>;
  return rows.map((row) => [row.application_id, JSON.parse(row.payload) as T]);
}

export function savePlatformAuditLog(log: { id: string; createdAt: string }): void {
  const applicationId = 'applicationId' in log ? String(log.applicationId || '') : '';
  db.prepare(`
    INSERT INTO platform_audit_logs(id,application_id,payload,updated_at)
    VALUES(?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      application_id=excluded.application_id,
      payload=excluded.payload,
      updated_at=excluded.updated_at
  `).run(log.id, applicationId || null, JSON.stringify(log), log.createdAt);
}

export function getPlatformAuditLogs<T>(): T[] {
  return (db.prepare(
    'SELECT payload FROM platform_audit_logs ORDER BY updated_at DESC'
  ).all() as { payload: string }[]).map((row) => JSON.parse(row.payload) as T);
}

export function deletePlatformApplication(applicationId: string): void {
  const remove = db.transaction(() => {
    db.prepare('DELETE FROM platform_grant_applications WHERE id=?').run(applicationId);
    db.prepare('DELETE FROM platform_grant_decisions WHERE application_id=?').run(applicationId);
    db.prepare('DELETE FROM platform_audit_logs WHERE application_id=?').run(applicationId);
  });
  remove();
}

export function saveApplication(app: GrantApplication) {
  db.prepare('INSERT INTO applications(id,payload,created_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload')
    .run(app.id, JSON.stringify(app), app.createdAt);
}
export function getApplications(): GrantApplication[] {
  return (db.prepare('SELECT payload FROM applications ORDER BY created_at DESC').all() as {payload:string}[]).map(r => JSON.parse(r.payload));
}
export function getApplication(id: string): GrantApplication | undefined {
  const row = db.prepare('SELECT payload FROM applications WHERE id=?').get(id) as {payload:string}|undefined;
  return row ? JSON.parse(row.payload) : undefined;
}
export function saveActivity(item: Activity) {
  db.prepare('INSERT INTO activity(id,payload,at) VALUES(?,?,?)').run(item.id, JSON.stringify(item), item.at);
}
export function getActivity(limit = 30): Activity[] {
  return (db.prepare('SELECT payload FROM activity ORDER BY at DESC LIMIT ?').all(limit) as {payload:string}[]).map(r => JSON.parse(r.payload));
}
export function getSetting(key: string) { return (db.prepare('SELECT value FROM settings WHERE key=?').get(key) as {value:string}|undefined)?.value; }
export function setSetting(key: string, value: string) { db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,value); }

function mapAuthAccount(row: {
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
  role: AuthAccount['role'];
  profile_json: string;
  created_at: string;
}): AuthAccount {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    passwordHash: row.password_hash,
    role: row.role,
    profile: JSON.parse(row.profile_json) as Record<string, string>,
    createdAt: row.created_at,
  };
}

export function createAuthAccount(account: AuthAccount): void {
  db.prepare(`
    INSERT INTO auth_users(id,email,full_name,password_hash,role,profile_json,created_at)
    VALUES(@id,@email,@fullName,@passwordHash,@role,@profileJson,@createdAt)
  `).run({
    id: account.id,
    email: account.email,
    fullName: account.fullName,
    passwordHash: account.passwordHash,
    role: account.role,
    profileJson: JSON.stringify(account.profile),
    createdAt: account.createdAt,
  });
}

export function getAuthAccountByEmail(email: string): AuthAccount | undefined {
  const row = db.prepare('SELECT * FROM auth_users WHERE email = ? COLLATE NOCASE').get(email) as {
    id: string;
    email: string;
    full_name: string;
    password_hash: string;
    role: AuthAccount['role'];
    profile_json: string;
    created_at: string;
  } | undefined;
  return row ? mapAuthAccount(row) : undefined;
}

export function getAuthAccountById(id: string): AuthAccount | undefined {
  const row = db.prepare('SELECT * FROM auth_users WHERE id = ?').get(id) as {
    id: string;
    email: string;
    full_name: string;
    password_hash: string;
    role: AuthAccount['role'];
    profile_json: string;
    created_at: string;
  } | undefined;
  return row ? mapAuthAccount(row) : undefined;
}

export function saveAuthSession(tokenHash: string, userId: string, expiresAt: number, createdAt: string): void {
  db.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)')
    .run(tokenHash, userId, expiresAt, createdAt);
}

export function getAuthSessionAccount(tokenHash: string, now: number): AuthAccount | undefined {
  const row = db.prepare(`
    SELECT u.* FROM auth_sessions s
    JOIN auth_users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).get(tokenHash, now) as {
    id: string;
    email: string;
    full_name: string;
    password_hash: string;
    role: AuthAccount['role'];
    profile_json: string;
    created_at: string;
  } | undefined;
  return row ? mapAuthAccount(row) : undefined;
}

export function deleteAuthSession(tokenHash: string): void {
  db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(tokenHash);
}

export function pruneAuthSessions(now: number): void {
  db.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').run(now);
}

export function closeDatabase(): void {
  db.close();
}
