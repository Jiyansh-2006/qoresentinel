import { qoreChainInfo } from "@qorechain/wallet-adapter";

/** Chain metadata for Keplr-compatible wallets; this does not connect or sign. */
export const qoreDianaWalletConfig = qoreChainInfo({
  chainId: "qorechain-diana",
  rpc: "https://rpc-testnet.qore.host",
  rest: "https://api-testnet.qore.host",
});
