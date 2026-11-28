import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import { metaMaskWallet } from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { QOREX_CHAINS, qorechain, qorechainTestnet, qorexWallet } from "@qorechain/qorex-rainbowkit";

export function createQorexWagmiConfig(projectId: string, appName = "QoreSentinel") {
  if (!projectId.trim()) throw new Error("A WalletConnect project id is required for RainbowKit.");
  const connectors = connectorsForWallets(
    [{ groupName: "Recommended", wallets: [qorexWallet, metaMaskWallet] }],
    { appName, projectId },
  );
  return createConfig({
    chains: QOREX_CHAINS,
    connectors,
    transports: { [qorechain.id]: http(), [qorechainTestnet.id]: http() },
  });
}
