import { Router, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { ethers } from "ethers";
import { db, type AgentExecutionRecord } from "../database/db.js";
import { MultiAgentAllocationPipeline } from "../agents/pipeline.js";
import { PQCService } from "../services/pqcService.js";
import { AgentAuthenticatorManager } from "../blockchain/authenticatorManager.js";
import { DemoDataService } from "../services/demoDataService.js";
import { SubmitApplicationSchema, qorToBaseUnits } from "@qoresentinel/shared";
import { generateAdvisoryNarrative } from "../agents/advisoryNarrative.js";
import { requireAuth, requireRole, requireSameOrigin } from "../middleware/auth.js";
import {
  createGrantReceiptProvider,
  verifyGrantReleaseReceipt,
} from "../services/grantReceiptVerifier.js";
import type { GrantLedgerTransaction, GrantPaymentIntent } from "../db/store.js";

export const applicationRouter = Router();
applicationRouter.use(requireAuth);
applicationRouter.use(requireSameOrigin);

applicationRouter.get("/", (req: Request, res: Response) => {
  const applications = req.authUser?.role === "ADMIN"
    ? db.applications
    : db.applications.filter((application) => application.applicantEmail?.toLowerCase() === req.authUser?.email);
  res.json(applications);
});

applicationRouter.get("/:id", (req: Request, res: Response) => {
  const app = db.applications.find((a) => a.id === req.params.id);
  if (!app) {
    return res.status(404).json({ error: "Application not found" });
  }
  if (req.authUser?.role === "STUDENT" && app.applicantEmail?.toLowerCase() !== req.authUser.email) {
    return res.status(404).json({ error: "Application not found" });
  }

  const decision = db.decisions.get(app.id) || null;
  const transactions = db.transactions.filter((t) => t.applicationId === app.id);
  const auditLogs = db.auditLogs.filter((l) => l.applicationId === app.id);

  res.json({
    application: app,
    decision,
    transactions,
    auditLogs,
  });
});

applicationRouter.post("/seed-demo", requireRole("ADMIN"), (req: Request, res: Response) => {
  for (const demoApp of DemoDataService.DEMO_APPLICATIONS) {
    const existingIdx = db.applications.findIndex((a) => a.id === demoApp.id);
    const newRecord = {
      ...demoApp,
      status: "PENDING",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      db.applications[existingIdx] = newRecord;
    } else {
      db.applications.push(newRecord);
    }
    db.saveApplication(newRecord);
  }

  res.json({ success: true, message: "Demo applications loaded", count: db.applications.length });
});

applicationRouter.post("/", requireRole("STUDENT"), async (req: Request, res: Response) => {
  const parseResult = SubmitApplicationSchema.safeParse({
    ...req.body,
    applicantName: req.authUser?.fullName,
    applicantEmail: req.authUser?.email,
  });
  if (!parseResult.success) {
    return res.status(400).json({ error: "Validation failed", details: parseResult.error.issues });
  }

  const appData = parseResult.data;
  const pool = db.pools.find((p) => p.id === appData.poolId && p.isActive);
  if (!pool) {
    return res.status(404).json({ error: "Target active funding pool does not exist" });
  }
  if (appData.category !== pool.category) {
    return res.status(400).json({ error: "Application category must match the selected funding pool." });
  }

  const id = `app_${randomUUID()}`;
  const newApp = {
    ...appData,
    id,
    status: "PENDING",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.applications.unshift(newApp);
  db.saveApplication(newApp);
  db.recordAudit({
    applicationId: id,
    action: "APPLICATION_SUBMITTED",
    actor: "Applicant",
    details: `Application submitted for project '${newApp.projectTitle}' (${newApp.requestedAmountQOR} QOR)`,
  });

  res.status(201).json(newApp);
});

const createWalletExecutionIntent = (req: Request, res: Response) => {
  const app = db.applications.find((a) => a.id === req.params.id);
  if (!app) {
    return res.status(404).json({ error: "Application not found" });
  }

  if (app.status !== "APPROVED" && app.status !== "EXECUTION_PENDING") {
    return res.status(409).json({ error: "Only an approved application can be paid." });
  }
  const { walletAddress } = req.body || {};
  if (typeof walletAddress !== "string" || !ethers.isAddress(walletAddress)) {
    return res.status(400).json({ error: "A valid connected QoreX EVM wallet address is required." });
  }

  const pool = db.pools.find((item) => item.id === app.poolId);
  const contractAddress = process.env.QORECHAIN_CONTRACT_ADDRESS;
  const approvedAmount = app.approvedAmountBaseUnits;
  const milestoneIndex = app.milestones?.findIndex((milestone: any) => milestone.status !== "PAID") ?? -1;
  const nextMilestone = milestoneIndex >= 0 ? app.milestones[milestoneIndex] : undefined;
  if (!pool || !pool.isActive || pool.isSimulated) {
    return res.status(409).json({ error: "Live grant payments require an active, verified funding pool." });
  }
  if (typeof contractAddress !== "string" || !/^0x[0-9a-f]{40}$/i.test(contractAddress)) {
    return res.status(503).json({ error: "Grant pool or QoreChain GrantVault configuration is unavailable." });
  }
  if (!nextMilestone) {
    return res.status(409).json({ error: "All approved grant milestones have already been paid." });
  }
  if (
    !approvedAmount ||
    !/^[1-9]\d*$/.test(approvedAmount) ||
    !Number.isInteger(nextMilestone.percentage) ||
    nextMilestone.percentage <= 0 ||
    nextMilestone.percentage > 100
  ) {
    return res.status(409).json({ error: "The next approved grant milestone is invalid." });
  }
  const amountBaseUnits = (
    BigInt(approvedAmount) * BigInt(nextMilestone.percentage) / 100n
  ).toString();
  if (amountBaseUnits === "0") {
    return res.status(409).json({ error: "The next approved milestone amount is below the minimum payable unit." });
  }
  const openIntents = db.getOpenGrantPaymentIntents(pool.id);
  const existingOpenIntent = openIntents.find((item) =>
    item.applicationId === app.id && item.milestoneIndex === milestoneIndex
  );
  const normalizedWalletAddress = ethers.getAddress(walletAddress);
  if (existingOpenIntent) {
    if (existingOpenIntent.fromAddress !== normalizedWalletAddress) {
      return res.status(409).json({ error: "This milestone already has a payment intent for a different wallet." });
    }
    return res.json({ intentId: existingOpenIntent.id, intent: existingOpenIntent });
  }
  const existingMilestonePayment = db.transactions.find((transaction) =>
    transaction.applicationId === app.id &&
    transaction.milestoneIndex === milestoneIndex &&
    ["PENDING", "CONFIRMED", "RECONCILIATION_REQUIRED"].includes(transaction.status)
  );
  if (existingMilestonePayment) {
    return res.status(409).json({
      error: `Milestone ${milestoneIndex} already has a ${existingMilestonePayment.status.toLowerCase()} transaction.`,
      transaction: existingMilestonePayment,
    });
  }
  const reservedBaseUnits = openIntents.reduce(
    (total, openIntent) => total + BigInt(openIntent.amountBaseUnits),
    0n
  );
  if (reservedBaseUnits + BigInt(amountBaseUnits) > BigInt(pool.remainingBudget || "0")) {
    return res.status(409).json({ error: "The pool does not have enough verified available QOR for this payment." });
  }

  const intent: GrantPaymentIntent = {
    id: randomUUID(),
    applicationId: app.id,
    poolId: pool.id,
    onChainPoolId: pool.onChainPoolId,
    ownerEmail: app.applicantEmail,
    fromAddress: normalizedWalletAddress,
    toAddress: app.beneficiaryWalletAddress,
    contractAddress: ethers.getAddress(contractAddress),
    amountBaseUnits,
    milestoneIndex,
    chainId: 9800,
    status: "AWAITING_SUBMISSION",
    createdAt: new Date().toISOString(),
  };
  db.createGrantPaymentIntent(intent);

  return res.status(201).json({ intentId: intent.id, intent });
};

applicationRouter.post("/:id/wallet-execution-intent", requireRole("ADMIN"), createWalletExecutionIntent);
applicationRouter.post("/:id/fund", requireRole("ADMIN"), createWalletExecutionIntent);

applicationRouter.post("/:id/wallet-execute", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const app = db.applications.find((a) => a.id === req.params.id);
  if (!app) {
    return res.status(404).json({ error: "Application not found" });
  }
  const pool = db.pools.find((item) => item.id === app.poolId);
  if (!pool) {
    return res.status(409).json({ error: "The application funding pool is unavailable for settlement." });
  }

  const { intentId, txHash } = req.body || {};
  if (typeof intentId !== "string" || typeof txHash !== "string" || !/^0x[0-9a-f]{64}$/i.test(txHash)) {
    return res.status(400).json({ error: "A payment intent ID and valid transaction hash are required." });
  }
  const intent = db.getGrantPaymentIntent(intentId);
  if (!intent || intent.applicationId !== app.id) {
    return res.status(404).json({ error: "Grant payment intent not found." });
  }

  const normalizedHash = txHash.toLowerCase();
  const existingByHash = db.transactions.find((transaction) => transaction.txHash.toLowerCase() === normalizedHash);
  if (existingByHash && existingByHash.paymentIntentId !== intent.id) {
    return res.status(409).json({ error: "Transaction hash is already associated with another record." });
  }

  intent.status = "SUBMITTED";
  intent.txHash = normalizedHash;
  db.saveGrantPaymentIntent(intent);

  const existing = db.transactions.find((transaction) => transaction.paymentIntentId === intent.id);
  if (existing && existing.txHash.toLowerCase() !== normalizedHash) {
    return res.status(409).json({ error: "This payment intent was submitted with a different transaction hash." });
  }
  if (existing?.status === "CONFIRMED") {
    return res.json({ success: true, status: "CONFIRMED", transaction: existing, application: app });
  }
  if (existing?.status === "FAILED") {
    return res.status(422).json({ status: "FAILED", transaction: existing, error: "The QoreChain transaction already reverted." });
  }
  const pendingTransaction: GrantLedgerTransaction = {
    id: `grant_tx_${intent.id}`,
    paymentIntentId: intent.id,
    applicationId: app.id,
    poolId: intent.poolId,
    ownerEmail: intent.ownerEmail,
    transactionType: "GRANT_PAYMENT",
    txHash: normalizedHash,
    blockNumber: existing?.blockNumber || 0,
    fromAddress: intent.fromAddress,
    toAddress: intent.toAddress,
    amount: intent.amountBaseUnits,
    amountDecimals: 18,
    amountDenom: "QOR",
    network: "QoreChain Diana Testnet",
    chainId: intent.chainId,
    milestoneIndex: intent.milestoneIndex,
    isSimulated: false,
    status: "PENDING",
    gasUsed: existing?.gasUsed || "0",
    explorerUrl: `https://explore.qore.network/tx/${normalizedHash}`,
    createdAt: intent.createdAt,
  };
  db.saveGrantTransaction(pendingTransaction);

  let verification;
  try {
    verification = await verifyGrantReleaseReceipt(createGrantReceiptProvider(), {
      txHash: normalizedHash,
      chainId: intent.chainId,
      contractAddress: intent.contractAddress,
      applicationId: app.id,
      poolId: intent.onChainPoolId,
      sender: intent.fromAddress,
      beneficiary: intent.toAddress,
      amountBaseUnits: intent.amountBaseUnits,
      milestoneIndex: intent.milestoneIndex,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "QoreChain receipt verification failed.";
    return res.status(503).json({
      error: message,
      status: "PENDING",
      transaction: pendingTransaction,
    });
  }

  if (verification.status === "PENDING") {
    return res.status(202).json({ status: "PENDING", transaction: pendingTransaction, application: app });
  }
  if (verification.status === "FAILED") {
    const failedTransaction = { ...pendingTransaction, status: "FAILED" as const, blockNumber: verification.blockNumber, gasUsed: verification.gasUsed };
    intent.status = "FAILED";
    db.saveGrantPaymentState(failedTransaction, intent);
    return res.status(422).json({ status: "FAILED", transaction: failedTransaction, error: "The QoreChain transaction reverted." });
  }
  if (verification.status === "RECONCILIATION_REQUIRED") {
    const unverifiedTransaction = { ...pendingTransaction, status: "RECONCILIATION_REQUIRED" as const };
    intent.status = "RECONCILIATION_REQUIRED";
    db.saveGrantPaymentState(unverifiedTransaction, intent);
    return res.status(409).json({
      status: "RECONCILIATION_REQUIRED",
      transaction: unverifiedTransaction,
      error: verification.reason,
    });
  }

  const confirmedAt = new Date().toISOString();
  const confirmedTransaction: GrantLedgerTransaction = {
    ...pendingTransaction,
    status: "CONFIRMED",
    blockNumber: verification.blockNumber,
    fromAddress: verification.fromAddress,
    logIndex: verification.logIndex,
    gasUsed: verification.gasUsed,
    confirmedAt,
  };
  intent.status = "CONFIRMED";

  const paidAmount = db.transactions
    .filter((transaction) =>
      transaction.applicationId === app.id &&
      transaction.status === "CONFIRMED" &&
      !transaction.isSimulated
    )
    .reduce((total, transaction) => total + BigInt(transaction.amount), BigInt(confirmedTransaction.amount));
  const totalApproved = BigInt(app.approvedAmountBaseUnits || "0");
  const updatedApplication = {
    ...app,
    status: paidAmount >= totalApproved ? "PAID" : "EXECUTION_PENDING",
    milestones: app.milestones?.map((milestone: any, index: number) =>
      index === intent.milestoneIndex
        ? { ...milestone, status: "PAID", paidAt: confirmedAt }
        : milestone
    ),
    updatedAt: confirmedAt,
  };
  const updatedPool = { ...pool };
  const remainingPoolBalance = BigInt(updatedPool.remainingBudget || "0");
  if (remainingPoolBalance < BigInt(confirmedTransaction.amount)) {
    updatedPool.remainingBudget = "0";
    updatedPool.accountingStatus = "RECONCILIATION_REQUIRED";
  } else {
    updatedPool.remainingBudget = (remainingPoolBalance - BigInt(confirmedTransaction.amount)).toString();
  }
  updatedPool.updatedAt = confirmedAt;
  db.saveGrantPaymentState(confirmedTransaction, intent, updatedApplication, updatedPool);
  Object.assign(app, updatedApplication);
  Object.assign(pool, updatedPool);

  db.recordAudit({
    applicationId: app.id,
    action: updatedPool.accountingStatus === "RECONCILIATION_REQUIRED"
      ? "WALLET_DISBURSEMENT_REQUIRES_RECONCILIATION"
      : "WALLET_DISBURSEMENT_CONFIRMED",
    actor: "QoreX Wallet",
    details: `GrantVault receipt verified on Diana Testnet. Milestone ${intent.milestoneIndex}; transaction ${normalizedHash}.`,
  });

  return res.json({ success: true, status: "CONFIRMED", transaction: confirmedTransaction, application: app });
});

applicationRouter.post("/:id/analyse", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const app = db.applications.find((a) => a.id === req.params.id);
  if (!app) {
    return res.status(404).json({ error: "Application not found" });
  }
  if (app.status !== "PENDING") {
    return res.status(409).json({ error: "Only pending applications can be reviewed. Completed reviews cannot be replayed." });
  }

  const pool = db.pools.find((p) => p.id === app.poolId);
  if (!pool) {
    return res.status(404).json({ error: "Target pool not found" });
  }
  const isDemoMode = req.body?.demoMode !== false && process.env.DEMO_MODE !== "false";
  if (!isDemoMode && (!pool.isActive || pool.isSimulated)) {
    return res.status(409).json({ error: "Live grant execution requires an active pool with verified QoreChain funding." });
  }

  app.status = "PROCESSING";
  db.saveApplication(app);
  const execution: AgentExecutionRecord = {
    id: randomUUID(),
    applicationId: app.id,
    status: "RUNNING",
    startedAt: new Date().toISOString(),
    events: [],
    reports: [],
  };
  db.agentExecutions.unshift(execution);
  db.agentExecutions.splice(100);
  db.sseEmitter.emit("execution_event", {
    executionId: execution.id,
    applicationId: app.id,
    status: execution.status,
    timestamp: Date.now(),
  });

  db.recordAudit({
    applicationId: app.id,
    action: "ANALYSIS_STARTED",
    actor: "AutonomousPipeline",
    details: "Initiated multi-agent evaluation pipeline",
  });

  try {
    const signerKeys = PQCService.getActiveKeyPair();
    const authenticator = AgentAuthenticatorManager.getAuthenticatorConfig();
    const historical = db.getHistoricalApplications();
    const existingDocHashes = db.getExistingDocumentHashes(app.id);

    const contractAddress = process.env.QORECHAIN_CONTRACT_ADDRESS || "0x91F56B77a284F49c1220a2B0Fe29B6f98EAfDE58";

    // Run the complete 7-agent pipeline
    const result = await MultiAgentAllocationPipeline.runPipeline({
      rawApplication: app,
      poolData: {
        id: pool.id,
        category: pool.category,
        remainingBudgetBaseUnits: pool.remainingBudget,
        maxGrantLimitBaseUnits: pool.maxGrantPerApplicant,
        dailyCapBaseUnits: pool.dailyCap,
        dailySpentBaseUnits: pool.dailySpent,
        permittedCategories: [pool.category],
        eligibilityCriteria: pool.eligibilityCriteria,
      },
      historicalApplications: historical,
      existingDocumentHashes: existingDocHashes,
      signerKeys: {
        secretKey: signerKeys.secretKey,
        publicKey: signerKeys.publicKey,
        fingerprint: signerKeys.fingerprint,
      },
      agentAuthenticator: authenticator,
      contractAddress,
      blockchainSignerOrProvider: null,
      isDemoMode,
      onProgress: (evt) => {
        const event = { executionId: execution.id, applicationId: app.id, ...evt };
        execution.events.push(event);
        if (evt.status !== "START") {
          execution.reports.push({
            agentRole: evt.agentRole,
            agentName: evt.agentName,
            stepIndex: evt.stepIndex,
            status: evt.status,
            executionMs: evt.executionMs,
            output: evt.data,
            createdAt: new Date(evt.timestamp).toISOString(),
          });
        }
        db.sseEmitter.emit("agent_event", event);
      },
    });

    execution.status = "COMPLETED";
    execution.endedAt = new Date().toISOString();
    execution.durationMs = Date.parse(execution.endedAt) - Date.parse(execution.startedAt);
    execution.finalDecision = result.decision.finalDecision;
    execution.transactionResult = result.transactionResult;
    db.sseEmitter.emit("execution_event", {
      executionId: execution.id,
      applicationId: app.id,
      status: execution.status,
      finalDecision: execution.finalDecision,
      durationMs: execution.durationMs,
      timestamp: Date.now(),
    });

    // Save decision
    db.saveDecision(app.id, result.decision);

    // Update application state
    if (result.decision.finalDecision === "APPROVED") {
      app.status = "APPROVED";
      app.approvedAmountBaseUnits = result.decision.canonicalPayload.approvedAmountBaseUnits;

      // Reserve the approved amount locally; only verified GrantReleased events count as paid.
      const approvedAmount = BigInt(result.decision.canonicalPayload.approvedAmountBaseUnits);
      const remaining = BigInt(pool.remainingBudget);
      pool.remainingBudget = (remaining >= approvedAmount ? remaining - approvedAmount : 0n).toString();
      db.savePool(pool);

      if (result.transactionResult?.isSimulated) {
        db.recordAudit({
          applicationId: app.id,
          action: "DISBURSEMENT_SIMULATED",
          actor: "TransactionAgent",
          details: "Demo transaction simulation completed. No funds were transferred and the grant remains unpaid.",
        });
      }
    } else {
      app.status = "REJECTED";
      app.rejectionReason = result.decision.reasons.join("; ");

      db.recordAudit({
        applicationId: app.id,
        action: "PROPOSAL_REJECTED",
        actor: "CoordinatorAgent",
        details: `Proposal rejected by policy engine. Reason: ${app.rejectionReason}`,
      });
    }

    const aiNarrative = await generateAdvisoryNarrative({
      projectTitle: app.projectTitle,
      category: app.category,
      projectDescription: app.projectDescription,
      requestedAmountQOR: app.requestedAmountQOR,
      finalDecision: result.decision.finalDecision,
      reasons: result.decision.reasons,
      agentSummaries: result.decision.agentSummaries,
    });
    if (aiNarrative.status !== "generated") {
      console.warn(`[ADVISORY_NARRATIVE_${aiNarrative.status.toUpperCase()}] ${aiNarrative.error}`);
    }

    app.updatedAt = new Date().toISOString();
    db.saveApplication(app);

    res.json({
      success: true,
      executionId: execution.id,
      application: app,
      decision: result.decision,
      aiNarrative,
      transactionResult: result.transactionResult,
      timeline: result.executionTimeline,
    });
  } catch (err: any) {
    execution.status = "FAILED";
    execution.endedAt = new Date().toISOString();
    execution.durationMs = Date.parse(execution.endedAt) - Date.parse(execution.startedAt);
    execution.error = err instanceof Error ? err.message : "Agent pipeline execution failed.";
    db.sseEmitter.emit("execution_event", {
      executionId: execution.id,
      applicationId: app.id,
      status: execution.status,
      error: execution.error,
      durationMs: execution.durationMs,
      timestamp: Date.now(),
    });

    app.status = "FAILED";
    app.rejectionReason = execution.error;
    db.saveApplication(app);
    db.recordAudit({
      applicationId: app.id,
      action: "PIPELINE_ERROR",
      actor: "SystemError",
      details: execution.error,
    });

    res.status(500).json({
      error: "Agent pipeline execution failed",
      message: execution.error,
    });
  }
});
