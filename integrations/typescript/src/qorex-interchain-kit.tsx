import type { ComponentProps, ReactNode } from "react";
import { ChainProvider } from "@interchain-kit/react";
import { qorexWallet } from "@qorechain/qorex-interchain-kit";

type Props = Pick<ComponentProps<typeof ChainProvider>, "chains" | "assetLists"> & { children: ReactNode };

/** Provider for a Cosmos dApp using QoreX through Interchain Kit. */
export function QorexInterchainProvider({ chains, assetLists, children }: Props) {
  return <ChainProvider chains={chains} assetLists={assetLists} wallets={[qorexWallet]}>{children}</ChainProvider>;
}
