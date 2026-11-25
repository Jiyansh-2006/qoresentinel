import { EventEmitter } from "node:events";
import { DemoDataService } from "../services/demoDataService.js";
import { PastApplicationRecord } from "../agents/fraudAgent.js";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import {
  createGrantPaymentIntent,
  createPoolFundingIntent,
  deletePlatformApplication,
  getPlatformApplications,
  getPlatformAuditLogs,
  getPlatformDecisions,
  getPlatformPools,
  getGrantLedgerTransactions,
  getAgentExecutions,
  getOpenGrantPaymentIntents,
  getGrantPaymentIntent,
  getPoolFundingIntent,
  getPoolFundingTransactions,
  saveGrantLedgerTransaction,
  saveAgentExecution,
  saveGrantPaymentState,
  saveGrantPaymentIntent,
  savePoolFundingState,
  savePlatformApplication,
  savePlatformAuditLog,
  savePlatformDecision,
  savePlatformPool,
  type GrantLedgerTransaction,
  type GrantPaymentIntent,
  type PoolFundingIntent,
  type PoolFundingTransaction,
} from "../db/store.js";

export interface AuditRecord {
  id: string;
  applicationId?: string;
  action: string;
  actor: string;
  details: string;
  recordHash: string;
  createdAt: string;
}

export interface StoredTransaction {
  id: string;
  paymentIntentId?: string;
  applicationId: string;
  poolId?: string;
  ownerUserId?: string;
  ownerEmail?: string;
  transactionType?: "GRANT_PAYMENT" | "POOL_FUNDING" | "WALLET_TRANSFER";
  txHash: string;
  blockNumber: number;
  fromAddress: string;
  toAddress: string;
  amount: string;
  amountDecimals?: number;
  amountDenom?: string;
  network: string;
  chainId?: number;
  milestoneIndex?: number;
  isSimulated: boolean;
  status: string;
  gasUsed: string;
  explorerUrl: string;
  createdAt: string;
  confirmedAt?: string;
}

export interface AgentExecutionEvent {
  executionId: string;
  applicationId: string;
  agentRole: string;
  agentName: string;
  stepIndex: number;
  totalSteps: number;
  status: "START" | "COMPLETE" | "ERROR";
  executionMs: number;
  data: unknown;
  timestamp: number;
}

export interface AgentExecutionRecord {
  id: string;
  applicationId: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  finalDecision?: string;
  transactionResult?: unknown;
  error?: string;
  events: AgentExecutionEvent[];
  reports: Array<{
    agentRole: string;
    agentName: string;
    stepIndex: number;
    status: string;
    executionMs: number;
    output: unknown;
    createdAt: string;
  }>;
}

export class MemoryDatabase {
  private static instance: MemoryDatabase;
  public pools: any[] = [];
  public applications: any[] = [];
  public decisions: Map<string, any> = new Map();
  public transactions: StoredTransaction[] = [];
  public auditLogs: AuditRecord[] = [];
  public agentExecutions: AgentExecutionRecord[] = [];
  public sseEmitter = new EventEmitter();

  private constructor() {
    this.seedDefaults();
    this.agentExecutions = getAgentExecutions<AgentExecutionRecord>();
    this.transactions.push(...getGrantLedgerTransactions());
    this.transactions.push(...getPoolFundingTransactions());
    this.transactions.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  }

  public static getInstance(): MemoryDatabase {
    if (!MemoryDatabase.instance) {
      MemoryDatabase.instance = new MemoryDatabase();
    }
    return MemoryDatabase.instance;
  }

  private seedDefaults(): void {
    this.auditLogs = getPlatformAuditLogs<AuditRecord>();
    this.decisions = new Map(getPlatformDecisions<any>());
    const savedPools = getPlatformPools<any>();
    this.pools = savedPools.length
      ? savedPools
      : JSON.parse(JSON.stringify(DemoDataService.DEMO_POOLS)).map((pool: any) => ({
          ...pool,
          isSimulated: true,
        }));
    for (const pool of this.pools) savePlatformPool(pool);

    const savedApplications = getPlatformApplications<any>();
    if (savedApplications.length) {
      this.applications = savedApplications;
    } else {
      const validSeed = DemoDataService.DEMO_APPLICATIONS[0];
      this.applications.push({
        ...validSeed,
        status: "APPROVED",
        approvedAmountBaseUnits: "3500000000000000000000",
        createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
        updatedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      });
    }
    for (const application of this.applications) savePlatformApplication(application);

    const validSeed = DemoDataService.DEMO_APPLICATIONS[0];
    const initTxHash = "0x4a9d77e1c8b2f90a120054321fedcba9876543210123456789abcdef01234567";
    this.transactions.push({
      id: "tx_init_001",
      applicationId: validSeed.id,
      txHash: initTxHash,
      blockNumber: 141950,
      fromAddress: "0x91F56B77a284F49c1220a2B0Fe29B6f98EAfDE58",
      toAddress: validSeed.beneficiaryWalletAddress,
      amount: "1400000000000000000000", // Milestone 0 (40% of 3500 QOR)
      network: "QoreChain Diana Testnet",
      isSimulated: true,
      status: "CONFIRMED",
      gasUsed: "68200",
      explorerUrl: `https://explore.qore.network/tx/${initTxHash}`,
      createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    });

    if (this.auditLogs.length === 0) {
      this.recordAudit({
        applicationId: validSeed.id,
        action: "PLATFORM_INITIALIZED",
        actor: "SystemInitialization",
        details: "QoreSentinel deployed on QoreChain Diana Testnet with FIPS 204 ML-DSA-87 Authenticator",
      });
    }
  }

  public recordAudit(item: { applicationId?: string; action: string; actor: string; details: string }): AuditRecord {
    const raw = `${item.action}:${item.actor}:${item.details}:${Date.now()}`;
    const recordHash = `0x${bytesToHex(sha256(new TextEncoder().encode(raw)))}`;

    const log: AuditRecord = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      applicationId: item.applicationId,
      action: item.action,
      actor: item.actor,
      details: item.details,
      recordHash,
      createdAt: new Date().toISOString(),
    };

    this.auditLogs.unshift(log);
    savePlatformAuditLog(log);
    this.sseEmitter.emit("audit", log);
    return log;
  }

  public savePool(pool: { id: string }): void {
    savePlatformPool(pool);
  }

  public saveApplication(application: { id: string }): void {
    savePlatformApplication(application);
  }

  public persistAgentExecution(execution: AgentExecutionRecord): void {
    saveAgentExecution(execution);
  }

  public saveDecision(applicationId: string, decision: unknown): void {
    this.decisions.set(applicationId, decision);
    savePlatformDecision(applicationId, decision);
  }

  public deleteApplicationRecord(applicationId: string): void {
    deletePlatformApplication(applicationId);
    this.decisions.delete(applicationId);
    this.applications = this.applications.filter((application) => application.id !== applicationId);
    this.auditLogs = this.auditLogs.filter((log) => log.applicationId !== applicationId);
  }

  public createGrantPaymentIntent(intent: GrantPaymentIntent): void {
    createGrantPaymentIntent(intent);
  }

  public getGrantPaymentIntent(id: string): GrantPaymentIntent | undefined {
    return getGrantPaymentIntent(id);
  }

  public getOpenGrantPaymentIntents(poolId: string): GrantPaymentIntent[] {
    return getOpenGrantPaymentIntents(poolId);
  }

  public saveGrantPaymentIntent(intent: GrantPaymentIntent): void {
    saveGrantPaymentIntent(intent);
  }

  public createPoolFundingIntent(intent: PoolFundingIntent): void {
    createPoolFundingIntent(intent);
  }

  public getPoolFundingIntent(id: string): PoolFundingIntent | undefined {
    return getPoolFundingIntent(id);
  }

  public savePoolFundingState(
    transaction: PoolFundingTransaction,
    intent: PoolFundingIntent,
    pool?: { id: string }
  ): void {
    savePoolFundingState(transaction, intent, pool);
    const storedTransaction: StoredTransaction = transaction;
    const existingIndex = this.transactions.findIndex((item) => item.id === transaction.id);
    if (existingIndex >= 0) this.transactions[existingIndex] = storedTransaction;
    else this.transactions.unshift(storedTransaction);
  }

  public saveGrantTransaction(transaction: GrantLedgerTransaction): void {
    saveGrantLedgerTransaction(transaction);
    const storedTransaction: StoredTransaction = transaction;
    const existingIndex = this.transactions.findIndex((item) => item.id === transaction.id);
    if (existingIndex >= 0) {
      this.transactions[existingIndex] = storedTransaction;
    } else {
      this.transactions.unshift(storedTransaction);
    }
  }

  public saveGrantPaymentState(
    transaction: GrantLedgerTransaction,
    intent: GrantPaymentIntent,
    application?: { id: string },
    pool?: { id: string }
  ): void {
    saveGrantPaymentState(transaction, intent, application, pool);
    const storedTransaction: StoredTransaction = transaction;
    const existingIndex = this.transactions.findIndex((item) => item.id === transaction.id);
    if (existingIndex >= 0) {
      this.transactions[existingIndex] = storedTransaction;
    } else {
      this.transactions.unshift(storedTransaction);
    }
  }

  public getHistoricalApplications(): PastApplicationRecord[] {
    return this.applications
      .filter((app) => app.status === "PAID" || app.status === "APPROVED")
      .map((app) => ({
      id: app.id,
      applicantEmail: app.applicantEmail,
      projectTitle: app.projectTitle,
      beneficiaryWallet: app.beneficiaryWalletAddress,
      documentHashes: (app.supportingDocuments || []).map((doc: any) =>
        `0x${bytesToHex(sha256(new TextEncoder().encode(doc.contentBase64 || doc.filename)))}`
      ),
      }));
  }

  public getExistingDocumentHashes(excludeApplicationId?: string): Set<string> {
    const set = new Set<string>();
    for (const app of this.applications) {
      if (excludeApplicationId && app.id === excludeApplicationId) continue;
      if (app.status === "PAID" || app.status === "APPROVED") {
        for (const doc of app.supportingDocuments || []) {
          const h = bytesToHex(sha256(new TextEncoder().encode(doc.contentBase64 || doc.filename)));
          set.add(h);
          set.add(`0x${h}`);
        }
      }
    }
    return set;
  }
}

export const db = MemoryDatabase.getInstance();
