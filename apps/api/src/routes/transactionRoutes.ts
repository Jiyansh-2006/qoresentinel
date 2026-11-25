import { Router, Request, Response } from "express";
import { fromBech32 } from "@cosmjs/encoding";
import { db } from "../database/db.js";
import { getQoreChainNetwork } from "@qoresentinel/shared";
import { requireAuth } from "../middleware/auth.js";

export const transactionRouter = Router();
transactionRouter.use(requireAuth);

transactionRouter.get("/", (req: Request, res: Response) => {
  if (req.authUser?.role === "ADMIN") {
    res.json(db.transactions);
    return;
  }

  const applicationIds = new Set(db.applications
    .filter((application) => application.applicantEmail?.toLowerCase() === req.authUser?.email)
    .map((application) => application.id));
  res.json(db.transactions.filter((transaction) =>
    applicationIds.has(transaction.applicationId) ||
    transaction.ownerEmail?.toLowerCase() === req.authUser?.email ||
    transaction.ownerUserId === req.authUser?.id
  ));
});

transactionRouter.post("/wallet-transfer", (req: Request, res: Response) => {
  const {
    txHash,
    blockNumber,
    fromAddress,
    toAddress,
    amountBaseUnits,
    amountDecimals = 18,
    amountDenom = "wei",
    gasUsed,
    chainId = 9800,
  } = req.body || {};
  if (
    typeof txHash !== "string" ||
    !/^(?:0x)?[0-9a-f]{64}$/i.test(txHash) ||
    typeof fromAddress !== "string" ||
    typeof toAddress !== "string" ||
    typeof amountBaseUnits !== "string" ||
    !/^[1-9]\d*$/.test(amountBaseUnits)
  ) {
    return res.status(400).json({ error: "txHash, fromAddress, toAddress, and amountBaseUnits are required" });
  }

  for (const address of [fromAddress, toAddress]) {
    try {
      const decoded = fromBech32(address, 90);
      if (decoded.prefix !== "qor" || decoded.data.length !== 20) {
        return res.status(400).json({ error: "Wallet transfers require valid QoreChain qor1 addresses." });
      }
    } catch {
      return res.status(400).json({ error: "Wallet transfers require valid QoreChain qor1 addresses." });
    }
  }

  const decimals = Number(amountDecimals);
  if (decimals !== 6 || amountDenom !== "uqor") {
    return res.status(400).json({ error: "Native QOR transfers must use uqor with 6 decimal places." });
  }

  const parsedBlockNumber = Number(blockNumber || 0);
  if (!Number.isSafeInteger(parsedBlockNumber) || parsedBlockNumber < 0) {
    return res.status(400).json({ error: "blockNumber must be a non-negative integer." });
  }

  const network = getQoreChainNetwork(Number(chainId));
  if (!network) {
    return res.status(400).json({ error: "Unsupported QoreChain network." });
  }

  db.transactions.unshift({
    id: `tx_${Date.now()}`,
    applicationId: "wallet_transfer",
    ownerUserId: req.authUser?.id,
    txHash,
    blockNumber: parsedBlockNumber,
    fromAddress,
    toAddress,
    amount: amountBaseUnits,
    amountDecimals: decimals,
    amountDenom: String(amountDenom),
    network: network.name,
    transactionType: "WALLET_TRANSFER",
    isSimulated: false,
    status: "REPORTED",
    gasUsed: String(gasUsed || "0"),
    explorerUrl: `https://explore.qore.network/tx/${encodeURIComponent(txHash)}`,
    createdAt: new Date().toISOString(),
  });

  db.recordAudit({
    action: "WALLET_TRANSFER_REPORTED",
    actor: "QoreX Wallet",
    details: `User-reported native QOR transfer on ${network.name} from ${fromAddress} to ${toAddress}: ${txHash}`,
  });

  res.status(201).json({ success: true, txHash });
});

transactionRouter.get("/:id/status", (req: Request, res: Response) => {
  const tx = db.transactions.find((transaction) =>
    transaction.id === req.params.id || transaction.txHash === req.params.id
  );
  if (!tx) {
    return res.status(404).json({ error: "Transaction not found" });
  }
  if (req.authUser?.role === "STUDENT") {
    const ownsApplication = db.applications.some((application) =>
      application.id === tx.applicationId && application.applicantEmail?.toLowerCase() === req.authUser?.email
    );
    if (!ownsApplication && tx.ownerEmail?.toLowerCase() !== req.authUser.email && tx.ownerUserId !== req.authUser.id) {
      return res.status(404).json({ error: "Transaction not found" });
    }
  }
  return res.json({
    id: tx.id,
    txHash: tx.txHash,
    status: tx.status,
    blockNumber: tx.blockNumber,
    confirmedAt: tx.confirmedAt,
    transactionType: tx.transactionType,
  });
});

transactionRouter.get("/:id", (req: Request, res: Response) => {
  const tx = db.transactions.find((t) => t.id === req.params.id || t.txHash === req.params.id);
  if (!tx) {
    return res.status(404).json({ error: "Transaction not found" });
  }
  if (req.authUser?.role === "STUDENT") {
    const ownsApplication = db.applications.some((application) =>
      application.id === tx.applicationId && application.applicantEmail?.toLowerCase() === req.authUser?.email
    );
    const ownsTransaction = tx.ownerEmail?.toLowerCase() === req.authUser.email;
    const ownsWalletTransfer = tx.ownerUserId === req.authUser.id;
    if (!ownsApplication && !ownsTransaction && !ownsWalletTransfer) {
      return res.status(404).json({ error: "Transaction not found" });
    }
  }
  res.json(tx);
});
