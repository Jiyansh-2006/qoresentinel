import { Router, Request, Response } from "express";
import { fromBech32 } from "@cosmjs/encoding";
import { db } from "../database/db.js";
import { baseUnitsToQor, getQoreChainNetwork, qorToBaseUnits } from "@qoresentinel/shared";
import { requireRole } from "../middleware/auth.js";
import { getPoolStatistics } from "./poolRoutes.js";

export const dashboardRouter = Router();
export const adminDashboardRouter = Router();
export const studentDashboardRouter = Router();

function addActivityStream(router: Router, audience: "ADMIN" | "STUDENT"): void {
  router.get("/stream", (req: Request, res: Response) => {
    const user = req.authUser;
    if (!user) {
      return res.status(401).json({ error: "Authentication required." });
    }

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    res.write("retry: 5000\n\n");

    const sendActivity = (log: (typeof db.auditLogs)[number]) => {
      if (audience === "STUDENT") {
        const ownsApplication = log.applicationId && db.applications.some((application) =>
          application.id === log.applicationId &&
          application.applicantEmail?.toLowerCase() === user.email
        );
        if (!ownsApplication) return;
      }

      res.write(`event: update\ndata: ${JSON.stringify({
        id: log.id,
        action: log.action,
        applicationId: log.applicationId,
        createdAt: log.createdAt,
      })}\n\n`);
    };

    db.sseEmitter.on("audit", sendActivity);
    const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 25_000);
    req.on("close", () => {
      clearInterval(heartbeat);
      db.sseEmitter.off("audit", sendActivity);
    });
  });
}

function getDashboardStats(req: Request) {
  const isStudent = req.authUser?.role === "STUDENT";
  const applications = isStudent
    ? db.applications.filter((application) => application.applicantEmail?.toLowerCase() === req.authUser?.email)
    : db.applications;
  const applicationIds = new Set(applications.map((application) => application.id));
  const transactions = isStudent
    ? db.transactions.filter((transaction) =>
        applicationIds.has(transaction.applicationId) ||
    transaction.ownerEmail?.toLowerCase() === req.authUser?.email ||
    transaction.ownerUserId === req.authUser?.id
      )
    : db.transactions;
  const activePools = db.pools.filter((pool) => pool.isActive);
  const financialPools = isStudent ? [] : db.pools.filter((pool) => !pool.isSimulated);
  const sumPoolValue = (field: "totalBudget" | "remainingBudget") =>
    financialPools.reduce((total, pool) => total + BigInt(pool[field] || "0"), 0n);
  const totalDepositedBaseUnits = sumPoolValue("totalBudget");
  const remainingBaseUnits = sumPoolValue("remainingBudget");
  const allocatedBaseUnits = totalDepositedBaseUnits > remainingBaseUnits
    ? totalDepositedBaseUnits - remainingBaseUnits
    : 0n;
  const confirmedPoolFundingBaseUnits = isStudent ? 0n : db.transactions
    .filter((transaction) =>
      transaction.transactionType === "POOL_FUNDING" &&
      transaction.status === "CONFIRMED" &&
      !transaction.isSimulated
    )
    .reduce((total, transaction) => total + BigInt(transaction.amount), 0n);

  const confirmedTransactions = transactions.filter(
    (tx) => tx.status === "CONFIRMED" && !tx.isSimulated && tx.transactionType === "GRANT_PAYMENT"
  );
  const pendingDisbursements = transactions.filter(
    (tx) => tx.status === "PENDING" && !tx.isSimulated && tx.transactionType === "GRANT_PAYMENT"
  ).length;
  const totalDisbursedQOR = confirmedTransactions.reduce(
    (total, tx) =>
      total + Number(BigInt(tx.amount)) / 10 ** (tx.amountDecimals ?? 18),
    0
  );
  const sumApplicationAmount = (amounts: string[]) =>
    amounts.reduce((total, amount) => total + BigInt(amount || "0"), 0n);
  const requestedBaseUnits = sumApplicationAmount(applications.map((application) =>
    qorToBaseUnits(Number(application.requestedAmountQOR || 0), true)
  ));
  const approvedBaseUnits = sumApplicationAmount(applications
    .map((application) => application.approvedAmountBaseUnits)
    .filter((amount): amount is string => typeof amount === "string" && /^\d+$/.test(amount)));
  const fundedApplicationIds = new Set(confirmedTransactions.map((transaction) => transaction.applicationId));

  const pendingApps = applications.filter((a) =>
    a.status === "PENDING" || a.status === "PROCESSING" || a.status === "NEEDS_REVIEW"
  ).length;
  const approvedApps = applications.filter((a) =>
    a.status === "APPROVED" || a.status === "EXECUTION_PENDING" || a.status === "PAID"
  ).length;
  const rejectedApps = applications.filter((a) => a.status === "REJECTED" || a.status === "FAILED").length;
  const failedTransactions = transactions.filter((tx) =>
    tx.status === "FAILED" && !tx.isSimulated
  ).length;

  return {
    totalPools: activePools.length,
    activeFundingPools: financialPools.filter((pool) => pool.isActive).length,
    poolsRequiringReconciliation: financialPools.filter(
      (pool) => pool.accountingStatus === "RECONCILIATION_REQUIRED"
    ).length,
    totalFundingAcrossPoolsQOR: baseUnitsToQor(totalDepositedBaseUnits.toString(), true),
    totalFundsDepositedQOR: baseUnitsToQor(confirmedPoolFundingBaseUnits.toString(), true),
    remainingFundsQOR: baseUnitsToQor(remainingBaseUnits.toString(), true),
    totalAllocatedQOR: baseUnitsToQor(allocatedBaseUnits.toString(), true),
    totalDisbursedQOR,
    pendingApplications: pendingApps,
    approvedApplications: approvedApps,
    rejectedApplications: rejectedApps,
    totalApplications: applications.length,
    fundedApplications: fundedApplicationIds.size,
    failedTransactions,
    totalRequestedQOR: baseUnitsToQor(requestedBaseUnits.toString(), true),
    totalApprovedQOR: baseUnitsToQor(approvedBaseUnits.toString(), true),
    totalReceivedQOR: totalDisbursedQOR,
    applicationsUnderReview: pendingApps,
    completedDisbursements: confirmedTransactions.length,
    pendingDisbursements,
    activeAgentsCount: req.authUser?.role === "ADMIN" ? 7 : 0,
    recentTransactions: confirmedTransactions.slice(0, 5),
    recentAuditLogs: isStudent
      ? db.auditLogs.filter((log) => log.applicationId && applicationIds.has(log.applicationId)).slice(0, 5)
      : db.auditLogs.slice(0, 5),
  };
}

dashboardRouter.get("/stats", (req: Request, res: Response) => {
  res.json(getDashboardStats(req));
});

adminDashboardRouter.use(requireRole("ADMIN"));
adminDashboardRouter.get("/stats", (req: Request, res: Response) => {
  res.json(getDashboardStats(req));
});
adminDashboardRouter.get("/transactions", (_req: Request, res: Response) => {
  res.json(db.transactions);
});
adminDashboardRouter.get("/activity", (_req: Request, res: Response) => {
  res.json(db.auditLogs);
});
adminDashboardRouter.get("/grant-distributions", (_req: Request, res: Response) => {
  const distributions = db.applications.map((application) => {
    const transactions = db.transactions.filter((transaction) =>
      transaction.applicationId === application.id && transaction.transactionType === "GRANT_PAYMENT"
    );
    return {
      ...application,
      pool: db.pools.find((pool) => pool.id === application.poolId) || null,
      transactions,
      paymentStatus: transactions.some((transaction) =>
        transaction.status === "CONFIRMED" && !transaction.isSimulated
      )
        ? application.status === "PAID" ? "PAID" : "PARTIALLY_PAID"
        : transactions.some((transaction) =>
          transaction.status === "PENDING" && !transaction.isSimulated
        )
          ? "PENDING"
          : "UNPAID",
    };
  });
  res.json(distributions);
});
adminDashboardRouter.get("/funding-pools", (_req: Request, res: Response) => {
  res.json(db.pools.map((pool) => ({ ...pool, ...getPoolStatistics(pool) })));
});
addActivityStream(adminDashboardRouter, "ADMIN");

studentDashboardRouter.use(requireRole("STUDENT"));
studentDashboardRouter.get("/stats", (req: Request, res: Response) => {
  res.json(getDashboardStats(req));
});
studentDashboardRouter.get("/applications", (req: Request, res: Response) => {
  res.json(db.applications.filter((application) =>
    application.applicantEmail?.toLowerCase() === req.authUser?.email
  ));
});
studentDashboardRouter.get("/transactions", (req: Request, res: Response) => {
  const applicationIds = new Set(db.applications
    .filter((application) => application.applicantEmail?.toLowerCase() === req.authUser?.email)
    .map((application) => application.id));
  res.json(db.transactions.filter((transaction) =>
    applicationIds.has(transaction.applicationId) ||
    transaction.ownerEmail?.toLowerCase() === req.authUser?.email ||
    transaction.ownerUserId === req.authUser?.id
  ));
});
studentDashboardRouter.get("/activity", (req: Request, res: Response) => {
  const applicationIds = new Set(db.applications
    .filter((application) => application.applicantEmail?.toLowerCase() === req.authUser?.email)
    .map((application) => application.id));
  res.json(db.auditLogs.filter((log) => log.applicationId && applicationIds.has(log.applicationId)));
});
addActivityStream(studentDashboardRouter, "STUDENT");

dashboardRouter.get("/native-balance", async (req: Request, res: Response) => {
  const address = String(req.query.address || "");
  const chainId = Number(req.query.chainId);
  const network = getQoreChainNetwork(chainId);

  if (!network) {
    return res.status(400).json({ error: "Unsupported QoreChain network." });
  }

  try {
    const decodedAddress = fromBech32(address, 90);
    if (decodedAddress.prefix !== "qor" || decodedAddress.data.length !== 20) {
      return res.status(400).json({ error: "A valid qor1 native address is required." });
    }
  } catch {
    return res.status(400).json({ error: "A valid qor1 native address is required." });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const upstream = await fetch(
      `${network.restUrl}/cosmos/bank/v1beta1/balances/${encodeURIComponent(address)}/by_denom?denom=${network.nativeDenom}`,
      { signal: controller.signal }
    );

    if (!upstream.ok) {
      console.error(
        `QoreChain balance lookup failed for chain ${chainId}: HTTP ${upstream.status}`
      );
      return res.status(502).json({ error: "The QoreChain balance service is unavailable." });
    }

    const payload = await upstream.json() as {
      balance?: { denom?: string; amount?: string };
    };
    const amount = payload.balance?.amount;
    if (
      payload.balance?.denom !== network.nativeDenom ||
      typeof amount !== "string" ||
      !/^\d+$/.test(amount)
    ) {
      console.error(`QoreChain returned an invalid balance payload for chain ${chainId}.`);
      return res.status(502).json({ error: "The QoreChain balance response was invalid." });
    }

    return res.json({
      address,
      chainId,
      network: network.name,
      denom: network.nativeDenom,
      decimals: network.nativeDecimals,
      amountBaseUnits: amount,
    });
  } catch (error) {
    console.error("QoreChain balance lookup failed:", error);
    return res.status(502).json({ error: "Could not retrieve the live QoreChain balance." });
  } finally {
    clearTimeout(timeout);
  }
});
