import test from "node:test";
import assert from "node:assert/strict";
import { Interface, ethers } from "ethers";
import {
  verifyGrantReleaseReceipt,
  type GrantReleaseExpectation,
  type GrantReleaseReceiptProvider,
} from "../services/grantReceiptVerifier.js";

const vault = "0x0000000000000000000000000000000000009800";
const sender = "0x0000000000000000000000000000000000000001";
const beneficiary = "0x0000000000000000000000000000000000000002";
const applicationId = "app-test-receipt-verification";
const poolId = `0x${"12".repeat(32)}`;
const txHash = `0x${"ab".repeat(32)}`;
const eventInterface = new Interface([
  "event GrantReleased(bytes32 indexed applicationId,bytes32 indexed poolId,address indexed beneficiary,uint256 amount,uint256 milestoneIndex)",
]);
const releaseLog = eventInterface.encodeEventLog(
  eventInterface.getEvent("GrantReleased")!,
  [
    ethers.keccak256(ethers.toUtf8Bytes(applicationId)),
    poolId,
    beneficiary,
    400n,
    0n,
  ]
);

const expected: GrantReleaseExpectation = {
  txHash,
  chainId: 9800,
  contractAddress: vault,
  applicationId,
  poolId,
  sender,
  beneficiary,
  amountBaseUnits: "400",
  milestoneIndex: 0,
};

function providerWith(receipt: {
  hash: string;
  status: number | null;
  blockNumber: number;
  gasUsed: bigint;
  logs: Array<{ address: string; topics: string[]; data: string }>;
} | null): GrantReleaseReceiptProvider {
  return {
    getNetwork: async () => ({ chainId: 9800n }),
    getTransactionReceipt: async () => receipt,
    getTransaction: async () => ({ hash: txHash, from: sender, to: vault }),
  };
}

test("pending receipt is not treated as a confirmed payment", async () => {
  const result = await verifyGrantReleaseReceipt(providerWith(null), expected);
  assert.deepEqual(result, { status: "PENDING" });
});

test("only a successful receipt with the matching GrantReleased event is confirmed", async () => {
  const result = await verifyGrantReleaseReceipt(
    providerWith({
      hash: txHash,
      status: 1,
      blockNumber: 321,
      gasUsed: 50_000n,
      logs: [{
        address: vault,
        topics: releaseLog.topics,
        data: releaseLog.data,
      }],
    }),
    expected
  );
  assert.deepEqual(result, {
    status: "CONFIRMED",
    blockNumber: 321,
    gasUsed: "50000",
    fromAddress: ethers.getAddress(sender),
    logIndex: 0,
  });
});

test("a successful transaction with the wrong payment amount requires reconciliation", async () => {
  const mismatchedLog = eventInterface.encodeEventLog(
    eventInterface.getEvent("GrantReleased")!,
    [
      ethers.keccak256(ethers.toUtf8Bytes(applicationId)),
      poolId,
      beneficiary,
      401n,
      0n,
    ]
  );
  const result = await verifyGrantReleaseReceipt(
    providerWith({
      hash: txHash,
      status: 1,
      blockNumber: 321,
      gasUsed: 50_000n,
      logs: [{ address: vault, topics: mismatchedLog.topics, data: mismatchedLog.data }],
    }),
    expected
  );
  assert.equal(result.status, "RECONCILIATION_REQUIRED");
});

test("a reverted receipt is recorded as failed rather than paid", async () => {
  const result = await verifyGrantReleaseReceipt(
    providerWith({ hash: txHash, status: 0, blockNumber: 321, gasUsed: 50_000n, logs: [] }),
    expected
  );
  assert.deepEqual(result, {
    status: "FAILED",
    blockNumber: 321,
    gasUsed: "50000",
  });
});
