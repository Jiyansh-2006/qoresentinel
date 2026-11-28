import { inspectTransaction, fetchPqKeyStatus, fetchEvmWindow } from "@qorechain/qoresign/network";

export async function inspectQoreTransaction(txHash: string, address?: string) {
  if (!/^(?:0x)?[0-9a-f]{64}$/i.test(txHash)) throw new Error("Expected a 32-byte QoreChain transaction hash.");
  const rest = process.env.QORE_REST ?? "https://api-testnet.qore.host";
  const [transaction, pqc, window] = await Promise.all([
    inspectTransaction({ rest, chainId: process.env.QORE_CHAIN_ID ?? "qorechain-diana", txhash: txHash }),
    address ? fetchPqKeyStatus({ rest, address }) : Promise.resolve(undefined),
    address ? fetchEvmWindow({ rest, address }) : Promise.resolve(undefined),
  ]);
  return { transaction, pqc, window };
}
