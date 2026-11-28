import type { ComponentProps, ReactNode } from "react";
import { ChainProvider } from "@cosmos-kit/react";
import { wallets as qorexWallets } from "@qorechain/qorex-cosmos-kit";

type Props = Pick<ComponentProps<typeof ChainProvider>, "chains" | "assetLists"> & { children: ReactNode };

/** Provider for a Cosmos dApp using QoreX through cosmos-kit. */
export function QorexCosmosKitProvider({ chains, assetLists, children }: Props) {
  return <ChainProvider chains={chains} assetLists={assetLists} wallets={[...qorexWallets]} throwErrors={false}>{children}</ChainProvider>;
}
