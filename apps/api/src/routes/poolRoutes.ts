import { Router, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { ethers } from "ethers";
import { db } from "../database/db.js";
import { CreatePoolSchema, qorToBaseUnits } from "@qoresentinel/shared";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import { optionalAuth, requireRole, requireSameOrigin } from "../middleware/auth.js";
import { createGrantReceiptProvider, verifyPoolFundingReceipt } from "../services/grantReceiptVerifier.js";
import type { PoolFundingIntent, PoolFundingTransaction } from "../db/store.js";

export const poolRouter = Router();
poolRouter.use(optionalAuth);
poolRouter.use(requireSameOrigin);

poolRouter.get("/", (req: Request, res: Response) => {
  const pools = req.authUser?.role === "ADMIN"
    ? db.pools
    : db.pools.filter((pool) => pool.isActive);
  res.json(pools.map((pool) => ({ ...pool, ...getPoolStatistics(pool) })));
});

poolRouter.get("/:id", (req: Request, res: Response) => {
  const pool = db.pools.find((p) => p.id === req.params.id);
  if (!pool) {
    return res.status(404).json({ error: "Grant pool not found" });
  }
  if (!pool.isActive && req.authUser?.role !== "ADMIN") {
    return res.status(404).json({ error: "Grant pool not found" });
  }
  res.json({ ...pool, ...getPoolStatistics(pool) });
});

export function getPoolStatistics(pool: any) {
  const applications = db.applications.filter((application) => application.poolId === pool.id);
  const poolTransactions = db.transactions.filter((transaction) =>
    transaction.poolId === pool.id && transaction.transactionType === "GRANT_PAYMENT"
  );
  const confirmedTransactions = poolTransactions.filter(
    (transaction) => transaction.status === "CONFIRMED" && !transaction.isSimulated
  );
  const totalDistributed = confirmedTransactions.reduce(
    (total, transaction) => total + BigInt(transaction.amount),
    0n
  );
  const totalAllocated = applications.reduce(
    (total, application) =>
      application.status === "REJECTED" || application.status === "FAILED"
        ? total
        : total + BigInt(application.approvedAmountBaseUnits || "0"),
    0n
  );
  const reservedAmount = totalAllocated > totalDistributed
    ? totalAllocated - totalDistributed
    : 0n;
  const totalDeposited = BigInt(pool.totalBudget || "0");

  return {
    totalDeposited: totalDeposited.toString(),
    totalAllocated: totalAllocated.toString(),
    totalDistributed: totalDistributed.toString(),
    reservedAmount: reservedAmount.toString(),
    remainingBalance: String(pool.remainingBudget || "0"),
    accountingStatus: pool.accountingStatus || "IN_SYNC",
    numberOfApplications: applications.length,
    numberOfApprovedApplications: applications.filter((application) =>
      ["APPROVED", "EXECUTION_PENDING", "PAID"].includes(application.status)
    ).length,
    numberOfFundedApplications: new Set(confirmedTransactions.map((transaction) => transaction.applicationId)).size,
    fundingUtilizationPercent: totalDeposited > 0n
      ? Number(totalDistributed * 10000n / totalDeposited) / 100
      : 0,
    status: pool.isActive ? "ACTIVE" : pool.creationStatus || "INACTIVE",
  };
}

poolRouter.get("/:id/stats", (req: Request, res: Response) => {
  const pool = db.pools.find((item) => item.id === req.params.id);
  if (!pool || (!pool.isActive && req.authUser?.role !== "ADMIN")) {
    return res.status(404).json({ error: "Funding pool not found." });
  }
  return res.json({ poolId: pool.id, poolName: pool.title, ...getPoolStatistics(pool) });
});

poolRouter.get("/:id/transactions", (req: Request, res: Response) => {
  const pool = db.pools.find((item) => item.id === req.params.id);
  if (!pool || (!pool.isActive && req.authUser?.role !== "ADMIN")) {
    return res.status(404).json({ error: "Funding pool not found." });
  }
  const transactions = db.transactions.filter((transaction) => transaction.poolId === pool.id);
  return res.json(transactions);
});

poolRouter.get("/:id/balance", (req: Request, res: Response) => {
  const pool = db.pools.find((item) => item.id === req.params.id);
  if (!pool || (!pool.isActive && req.authUser?.role !== "ADMIN")) {
    return res.status(404).json({ error: "Funding pool not found." });
  }
  const statistics = getPoolStatistics(pool);
  return res.json({
    poolId: pool.id,
    totalDeposited: statistics.totalDeposited,
    totalDistributed: statistics.totalDistributed,
    reservedAmount: statistics.reservedAmount,
    remainingBalance: statistics.remainingBalance,
    source: pool.isSimulated ? "SIMULATED" : "LOCAL_RECONCILED",
  });
});

poolRouter.post("/", requireRole("ADMIN"), (req: Request, res: Response) => {
  const parseResult = CreatePoolSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Validation failed", details: parseResult.error.issues });
  }

  const data = parseResult.data;
  const isDemoMode = req.body?.demoMode === true;
  const walletAddress = req.body?.walletAddress;
  const contractAddress = process.env.QORECHAIN_CONTRACT_ADDRESS;
  if (!isDemoMode && (typeof walletAddress !== "string" || !ethers.isAddress(walletAddress))) {
    return res.status(400).json({ error: "Connect a valid QoreX EVM wallet before creating a live pool." });
  }
  if (!isDemoMode && typeof contractAddress !== "string") {
    return res.status(503).json({ error: "QORECHAIN_CONTRACT_ADDRESS is required for live pool funding." });
  }

  const poolId = `pool_${Date.now()}`;
  const onChainHash = `0x${bytesToHex(sha256(new TextEncoder().encode(`${poolId}:${Date.now()}`)))}`;
  const initialBudget = qorToBaseUnits(data.totalBudgetQOR, true);
  const createdAt = new Date().toISOString();

  const newPool = {
    id: poolId,
    onChainPoolId: onChainHash,
    title: data.title,
    description: data.description,
    category: data.category,
    totalBudget: isDemoMode ? initialBudget : "0",
    remainingBudget: isDemoMode ? initialBudget : "0",
    pendingInitialBudget: isDemoMode ? undefined : initialBudget,
    maxGrantPerApplicant: qorToBaseUnits(data.maxGrantQOR, true),
    dailyCap: qorToBaseUnits(data.dailyCapQOR, true),
    dailySpent: "0",
    tokenAddress: "0x0000000000000000000000000000000000000000",
    eligibilityCriteria: data.eligibilityCriteria,
    requiredDocuments: data.requiredDocuments,
    isActive: isDemoMode,
    isSimulated: isDemoMode,
    creationStatus: isDemoMode ? "SIMULATED" : "AWAITING_SUBMISSION",
    createdAt,
  };

  let fundingIntent: PoolFundingIntent | undefined;
  if (!isDemoMode) {
    fundingIntent = {
      id: randomUUID(),
      poolId,
      onChainPoolId: onChainHash,
      operation: "CREATE",
      fromAddress: ethers.getAddress(walletAddress),
      amountBaseUnits: initialBudget,
      poolName: data.title,
      category: data.category,
      maxGrantBaseUnits: newPool.maxGrantPerApplicant,
      status: "AWAITING_SUBMISSION",
      createdAt,
    };
    db.createPoolFundingIntent(fundingIntent);
  }
  db.pools.push(newPool);
  db.savePool(newPool);
  db.recordAudit({
    action: "GRANT_POOL_CREATED",
    actor: "PoolProvider",
    details: isDemoMode
      ? `Created simulated pool '${newPool.title}'. Its balance is demo data, not verified QoreChain funding.`
      : `Created pending pool '${newPool.title}'. It will become active after a verified GrantVault receipt.`,
  });

  res.status(201).json({ ...newPool, fundingIntentId: fundingIntent?.id });
});

poolRouter.post("/:id/deposit-intent", requireRole("ADMIN"), (req: Request, res: Response) => {
  const pool = db.pools.find((p) => p.id === req.params.id);
  if (!pool) {
    return res.status(404).json({ error: "Grant pool not found." });
  }
  const amountQOR = Number(req.body.amountQOR);
  const walletAddress = req.body?.walletAddress;
  if (!pool.isActive || pool.isSimulated) {
    return res.status(409).json({ error: "Live deposits require an active, on-chain funding pool." });
  }
  if (!Number.isFinite(amountQOR) || amountQOR <= 0) {
    return res.status(400).json({ error: "Positive deposit amount in QOR required." });
  }
  if (typeof walletAddress !== "string" || !ethers.isAddress(walletAddress)) {
    return res.status(400).json({ error: "A valid connected QoreX EVM wallet address is required." });
  }

  const intent: PoolFundingIntent = {
    id: randomUUID(),
    poolId: pool.id,
    onChainPoolId: pool.onChainPoolId,
    operation: "DEPOSIT",
    fromAddress: ethers.getAddress(walletAddress),
    amountBaseUnits: qorToBaseUnits(amountQOR, true),
    status: "AWAITING_SUBMISSION",
    createdAt: new Date().toISOString(),
  };
  db.createPoolFundingIntent(intent);
  return res.status(201).json({ intentId: intent.id, intent });
});

poolRouter.post("/:id/deposit", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const pool = db.pools.find((p) => p.id === req.params.id);
  if (!pool) {
    return res.status(404).json({ error: "Grant pool not found." });
  }

  if (req.body?.demoMode === true) {
    if (!pool.isSimulated) {
      return res.status(409).json({ error: "Demo deposits can only modify a simulated pool." });
    }
    const amountQOR = Number(req.body.amountQOR);
    if (!Number.isFinite(amountQOR) || amountQOR <= 0) {
      return res.status(400).json({ error: "Positive deposit amount in QOR required." });
    }
    const depositBaseUnits = BigInt(qorToBaseUnits(amountQOR, true));
    pool.totalBudget = (BigInt(pool.totalBudget) + depositBaseUnits).toString();
    pool.remainingBudget = (BigInt(pool.remainingBudget) + depositBaseUnits).toString();
    db.savePool(pool);
    db.recordAudit({
      action: "FUNDS_DEPOSITED_SIMULATED",
      actor: "GrantProvider",
      details: `Simulated deposit of ${amountQOR} QOR into demo pool '${pool.title}'. No on-chain funds moved.`,
    });
    return res.json({ success: true, simulated: true, pool });
  }

  const { intentId, txHash } = req.body || {};
  if (typeof intentId !== "string" || typeof txHash !== "string" || !/^0x[0-9a-f]{64}$/i.test(txHash)) {
    return res.status(400).json({ error: "A funding intent ID and valid transaction hash are required." });
  }
  const intent = db.getPoolFundingIntent(intentId);
  if (!intent || intent.poolId !== pool.id) {
    return res.status(404).json({ error: "Pool funding intent not found." });
  }
  const normalizedHash = txHash.toLowerCase();
  const contractAddress = process.env.QORECHAIN_CONTRACT_ADDRESS;
  if (typeof contractAddress !== "string" || !ethers.isAddress(contractAddress)) {
    return res.status(503).json({ error: "A valid QORECHAIN_CONTRACT_ADDRESS is required to verify this funding." });
  }
  const existing = db.transactions.find((transaction) => transaction.paymentIntentId === intent.id);
  if (existing && existing.txHash.toLowerCase() !== normalizedHash) {
    return res.status(409).json({ error: "This funding intent has already been submitted with another transaction hash." });
  }
  if (existing?.status === "CONFIRMED") {
    return res.json({ success: true, status: "CONFIRMED", transaction: existing, pool });
  }
  if (existing?.status === "FAILED") {
    return res.status(422).json({ status: "FAILED", transaction: existing, error: "The funding transaction already reverted." });
  }

  intent.status = "SUBMITTED";
  intent.txHash = normalizedHash;
  const pendingTransaction: PoolFundingTransaction = {
    id: `pool_tx_${intent.id}`,
    paymentIntentId: intent.id,
    applicationId: "pool_funding",
    poolId: pool.id,
    transactionType: "POOL_FUNDING",
    txHash: normalizedHash,
    blockNumber: existing?.blockNumber || 0,
    fromAddress: intent.fromAddress,
    toAddress: ethers.getAddress(contractAddress),
    amount: intent.amountBaseUnits,
    amountDecimals: 18,
    amountDenom: "QOR",
    network: "QoreChain Diana Testnet",
    chainId: 9800,
    isSimulated: false,
    status: "PENDING",
    gasUsed: existing?.gasUsed || "0",
    explorerUrl: `https://explore.qore.network/tx/${normalizedHash}`,
    createdAt: intent.createdAt,
  };
  db.savePoolFundingState(pendingTransaction, intent);

  let verification;
  try {
    verification = await verifyPoolFundingReceipt(createGrantReceiptProvider(), {
      txHash: normalizedHash,
      chainId: 9800,
      contractAddress,
      poolId: intent.onChainPoolId,
      sender: intent.fromAddress,
      amountBaseUnits: intent.amountBaseUnits,
      poolName: intent.operation === "CREATE" ? intent.poolName : undefined,
      category: intent.operation === "CREATE" ? intent.category : undefined,
      maxGrantBaseUnits: intent.operation === "CREATE" ? intent.maxGrantBaseUnits : undefined,
    });
  } catch (error) {
    return res.status(503).json({
      error: error instanceof Error ? error.message : "QoreChain receipt verification failed.",
      status: "PENDING",
      transaction: pendingTransaction,
    });
  }

  if (verification.status === "PENDING") {
    return res.status(202).json({ status: "PENDING", transaction: pendingTransaction, pool });
  }
  if (verification.status === "FAILED") {
    const failedTransaction = {
      ...pendingTransaction,
      status: "FAILED" as const,
      blockNumber: verification.blockNumber,
      gasUsed: verification.gasUsed,
    };
    intent.status = "FAILED";
    db.savePoolFundingState(failedTransaction, intent);
    return res.status(422).json({ status: "FAILED", transaction: failedTransaction });
  }
  if (verification.status === "RECONCILIATION_REQUIRED") {
    const reconciliationTransaction = {
      ...pendingTransaction,
      status: "RECONCILIATION_REQUIRED" as const,
    };
    intent.status = "RECONCILIATION_REQUIRED";
    db.savePoolFundingState(reconciliationTransaction, intent);
    return res.status(409).json({
      status: "RECONCILIATION_REQUIRED",
      transaction: reconciliationTransaction,
      error: verification.reason,
    });
  }

  const confirmedAt = new Date().toISOString();
  const confirmedTransaction: PoolFundingTransaction = {
    ...pendingTransaction,
    status: "CONFIRMED",
    blockNumber: verification.blockNumber,
    fromAddress: verification.fromAddress,
    gasUsed: verification.gasUsed,
    confirmedAt,
  };
  intent.status = "CONFIRMED";
  const updatedPool = { ...pool };
  if (intent.operation === "CREATE") {
    updatedPool.totalBudget = intent.amountBaseUnits;
    updatedPool.remainingBudget = intent.amountBaseUnits;
    updatedPool.isActive = true;
    updatedPool.isSimulated = false;
    updatedPool.creationStatus = "CONFIRMED";
  } else {
    updatedPool.totalBudget = (BigInt(pool.totalBudget) + BigInt(intent.amountBaseUnits)).toString();
    updatedPool.remainingBudget = (BigInt(pool.remainingBudget) + BigInt(intent.amountBaseUnits)).toString();
  }
  updatedPool.updatedAt = confirmedAt;
  db.savePoolFundingState(confirmedTransaction, intent, updatedPool);
  Object.assign(pool, updatedPool);
  db.recordAudit({
    action: intent.operation === "CREATE" ? "GRANT_POOL_FUNDED" : "FUNDS_DEPOSITED",
    actor: "GrantVault",
    details: `Verified ${intent.amountBaseUnits} uqor funding event for pool '${pool.title}'. Transaction ${normalizedHash}.`,
  });
  return res.json({ success: true, status: "CONFIRMED", transaction: confirmedTransaction, pool });
});
