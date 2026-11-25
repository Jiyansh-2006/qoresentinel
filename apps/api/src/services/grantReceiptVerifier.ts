import { Interface, ethers } from "ethers";

const GRANT_VAULT_EVENTS = new Interface([
  "event GrantReleased(bytes32 indexed applicationId,bytes32 indexed poolId,address indexed beneficiary,uint256 amount,uint256 milestoneIndex)",
]);
const GRANT_RELEASED_TOPIC = GRANT_VAULT_EVENTS.getEvent("GrantReleased")?.topicHash;
const POOL_EVENTS = new Interface([
  "event PoolCreated(bytes32 indexed poolId,string name,string category,uint256 totalBudget,uint256 maxGrant)",
  "event FundsDeposited(bytes32 indexed poolId,address indexed depositor,uint256 amount)",
]);
const POOL_CREATED_TOPIC = POOL_EVENTS.getEvent("PoolCreated")?.topicHash;
const FUNDS_DEPOSITED_TOPIC = POOL_EVENTS.getEvent("FundsDeposited")?.topicHash;

export interface GrantReleaseReceiptProvider {
  getNetwork(): Promise<{ chainId: bigint }>;
  getTransactionReceipt(txHash: string): Promise<{
    hash: string;
    status: number | null;
    blockNumber: number;
    gasUsed: bigint;
    logs: readonly { address: string; topics: readonly string[]; data: string }[];
  } | null>;
  getTransaction(txHash: string): Promise<{
    hash: string;
    from: string;
    to: string | null;
  } | null>;
}

export interface GrantReleaseExpectation {
  txHash: string;
  chainId: number;
  contractAddress: string;
  applicationId: string;
  poolId: string;
  sender: string;
  beneficiary: string;
  amountBaseUnits: string;
  milestoneIndex: number;
}

export interface PoolFundingExpectation {
  txHash: string;
  chainId: number;
  contractAddress: string;
  poolId: string;
  sender: string;
  amountBaseUnits: string;
  poolName?: string;
  category?: string;
  maxGrantBaseUnits?: string;
}

export type GrantReleaseVerification =
  | { status: "PENDING" }
  | { status: "FAILED"; blockNumber: number; gasUsed: string }
  | {
      status: "CONFIRMED";
      blockNumber: number;
      gasUsed: string;
      fromAddress: string;
      logIndex: number;
    }
  | { status: "RECONCILIATION_REQUIRED"; reason: string };
export type PoolFundingVerification = GrantReleaseVerification;

function hashApplicationId(applicationId: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(applicationId));
}

function normalizeBytes32(value: string): string | undefined {
  if (!ethers.isHexString(value, 32)) return undefined;
  return value.toLowerCase();
}

export async function verifyGrantReleaseReceipt(
  provider: GrantReleaseReceiptProvider,
  expected: GrantReleaseExpectation
): Promise<GrantReleaseVerification> {
  let chainId: bigint;
  let receipt: Awaited<ReturnType<GrantReleaseReceiptProvider["getTransactionReceipt"]>>;
  let transaction: Awaited<ReturnType<GrantReleaseReceiptProvider["getTransaction"]>>;

  try {
    ({ chainId } = await provider.getNetwork());
    receipt = await provider.getTransactionReceipt(expected.txHash);
    if (!receipt) return { status: "PENDING" };
    transaction = await provider.getTransaction(expected.txHash);
  } catch (error) {
    throw new Error(
      `Could not verify the QoreChain receipt: ${
        error instanceof Error ? error.message : "RPC request failed."
      }`
    );
  }

  if (chainId !== BigInt(expected.chainId)) {
    return {
      status: "RECONCILIATION_REQUIRED",
      reason: `RPC returned chain ${chainId}; expected chain ${expected.chainId}.`,
    };
  }
  if (!transaction || transaction.hash.toLowerCase() !== expected.txHash.toLowerCase()) {
    return {
      status: "RECONCILIATION_REQUIRED",
      reason: "The transaction details could not be matched to the submitted hash.",
    };
  }
  if (receipt.hash.toLowerCase() !== expected.txHash.toLowerCase()) {
    return {
      status: "RECONCILIATION_REQUIRED",
      reason: "The receipt hash does not match the submitted transaction hash.",
    };
  }
  if (receipt.status === 0) {
    return {
      status: "FAILED",
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
    };
  }
  if (receipt.status !== 1) {
    return {
      status: "RECONCILIATION_REQUIRED",
      reason: "The receipt does not contain a successful execution status.",
    };
  }

  const expectedContract = ethers.getAddress(expected.contractAddress);
  const expectedSender = ethers.getAddress(expected.sender);
  const expectedBeneficiary = ethers.getAddress(expected.beneficiary);
  if (!transaction.to || ethers.getAddress(transaction.to) !== expectedContract) {
    return {
      status: "RECONCILIATION_REQUIRED",
      reason: "The transaction target does not match the configured GrantVault.",
    };
  }
  if (ethers.getAddress(transaction.from) !== expectedSender) {
    return {
      status: "RECONCILIATION_REQUIRED",
      reason: "The transaction sender does not match the wallet recorded for this payment.",
    };
  }

  const expectedPoolId = normalizeBytes32(expected.poolId);
  if (!expectedPoolId) {
    return {
      status: "RECONCILIATION_REQUIRED",
      reason: "The grant pool identifier is not a valid bytes32 value.",
    };
  }

  const releaseLogs = receipt.logs.filter(
    (log) =>
      log.address.toLowerCase() === expectedContract.toLowerCase() &&
      log.topics[0]?.toLowerCase() === GRANT_RELEASED_TOPIC?.toLowerCase()
  );
  if (releaseLogs.length !== 1 || !GRANT_RELEASED_TOPIC) {
    return {
      status: "RECONCILIATION_REQUIRED",
      reason: "The successful receipt must contain exactly one GrantReleased event from GrantVault.",
    };
  }

  const event = GRANT_VAULT_EVENTS.parseLog(releaseLogs[0]);
  if (!event) {
    return {
      status: "RECONCILIATION_REQUIRED",
      reason: "GrantVault emitted an event that could not be decoded.",
    };
  }
  const eventApplicationId = String(event.args[0]).toLowerCase();
  const eventPoolId = String(event.args[1]).toLowerCase();
  const eventBeneficiary = ethers.getAddress(String(event.args[2]));
  const eventAmount = BigInt(event.args[3]).toString();
  const eventMilestoneIndex = Number(event.args[4]);

  if (
    eventApplicationId !== hashApplicationId(expected.applicationId).toLowerCase() ||
    eventPoolId !== expectedPoolId ||
    eventBeneficiary !== expectedBeneficiary ||
    eventAmount !== BigInt(expected.amountBaseUnits).toString() ||
    eventMilestoneIndex !== expected.milestoneIndex
  ) {
    return {
      status: "RECONCILIATION_REQUIRED",
      reason: "GrantReleased event details do not match the approved payment intent.",
    };
  }

  const logIndex = receipt.logs.indexOf(releaseLogs[0]);
  return {
    status: "CONFIRMED",
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
    fromAddress: ethers.getAddress(transaction.from),
    logIndex,
  };
}

export async function verifyPoolFundingReceipt(
  provider: GrantReleaseReceiptProvider,
  expected: PoolFundingExpectation
): Promise<PoolFundingVerification> {
  let chainId: bigint;
  let receipt: Awaited<ReturnType<GrantReleaseReceiptProvider["getTransactionReceipt"]>>;
  let transaction: Awaited<ReturnType<GrantReleaseReceiptProvider["getTransaction"]>>;

  try {
    ({ chainId } = await provider.getNetwork());
    receipt = await provider.getTransactionReceipt(expected.txHash);
    if (!receipt) return { status: "PENDING" };
    transaction = await provider.getTransaction(expected.txHash);
  } catch (error) {
    throw new Error(
      `Could not verify the QoreChain receipt: ${
        error instanceof Error ? error.message : "RPC request failed."
      }`
    );
  }

  if (chainId !== BigInt(expected.chainId)) {
    return {
      status: "RECONCILIATION_REQUIRED",
      reason: `RPC returned chain ${chainId}; expected chain ${expected.chainId}.`,
    };
  }
  if (
    !transaction ||
    transaction.hash.toLowerCase() !== expected.txHash.toLowerCase() ||
    receipt.hash.toLowerCase() !== expected.txHash.toLowerCase()
  ) {
    return {
      status: "RECONCILIATION_REQUIRED",
      reason: "The transaction and receipt details could not be matched to the submitted hash.",
    };
  }
  if (receipt.status === 0) {
    return {
      status: "FAILED",
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
    };
  }
  if (receipt.status !== 1) {
    return {
      status: "RECONCILIATION_REQUIRED",
      reason: "The receipt does not contain a successful execution status.",
    };
  }

  const expectedContract = ethers.getAddress(expected.contractAddress);
  const expectedSender = ethers.getAddress(expected.sender);
  if (
    !transaction.to ||
    ethers.getAddress(transaction.to) !== expectedContract ||
    ethers.getAddress(transaction.from) !== expectedSender
  ) {
    return {
      status: "RECONCILIATION_REQUIRED",
      reason: "Transaction target or sender does not match the funding intent.",
    };
  }

  const expectedPoolId = normalizeBytes32(expected.poolId);
  if (!expectedPoolId || !POOL_CREATED_TOPIC || !FUNDS_DEPOSITED_TOPIC) {
    return {
      status: "RECONCILIATION_REQUIRED",
      reason: "Pool identifiers or GrantVault event definitions are invalid.",
    };
  }

  const poolLogs = receipt.logs.filter(
    (log) =>
      log.address.toLowerCase() === expectedContract.toLowerCase() &&
      [POOL_CREATED_TOPIC, FUNDS_DEPOSITED_TOPIC].some(
        (topic) => log.topics[0]?.toLowerCase() === topic.toLowerCase()
      )
  );
  const creationLogs = poolLogs.filter(
    (log) => log.topics[0]?.toLowerCase() === POOL_CREATED_TOPIC.toLowerCase()
  );
  const depositLogs = poolLogs.filter(
    (log) => log.topics[0]?.toLowerCase() === FUNDS_DEPOSITED_TOPIC.toLowerCase()
  );
  const creationExpected = expected.poolName !== undefined;
  if (depositLogs.length !== 1 || (creationExpected ? creationLogs.length !== 1 : creationLogs.length !== 0)) {
    return {
      status: "RECONCILIATION_REQUIRED",
      reason: "Receipt events do not match the expected GrantVault pool funding operation.",
    };
  }

  const deposit = POOL_EVENTS.parseLog(depositLogs[0]);
  if (
    !deposit ||
    String(deposit.args[0]).toLowerCase() !== expectedPoolId ||
    ethers.getAddress(String(deposit.args[1])) !== expectedSender ||
    BigInt(deposit.args[2]).toString() !== BigInt(expected.amountBaseUnits).toString()
  ) {
    return {
      status: "RECONCILIATION_REQUIRED",
      reason: "FundsDeposited event details do not match the funding intent.",
    };
  }

  if (creationExpected) {
    const creation = POOL_EVENTS.parseLog(creationLogs[0]);
    if (
      !creation ||
      String(creation.args[0]).toLowerCase() !== expectedPoolId ||
      String(creation.args[1]) !== expected.poolName ||
      String(creation.args[2]) !== expected.category ||
      BigInt(creation.args[3]).toString() !== BigInt(expected.amountBaseUnits).toString() ||
      BigInt(creation.args[4]).toString() !== BigInt(expected.maxGrantBaseUnits || "0").toString()
    ) {
      return {
        status: "RECONCILIATION_REQUIRED",
        reason: "PoolCreated event details do not match the pool creation intent.",
      };
    }
  }

  return {
    status: "CONFIRMED",
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
    fromAddress: ethers.getAddress(transaction.from),
    logIndex: receipt.logs.indexOf(depositLogs[0]),
  };
}

export function createGrantReceiptProvider(): GrantReleaseReceiptProvider {
  const rpcUrl = process.env.QORECHAIN_EVM_RPC;
  if (!rpcUrl) {
    throw new Error("QORECHAIN_EVM_RPC is required to verify grant receipts.");
  }
  return new ethers.JsonRpcProvider(rpcUrl);
}
