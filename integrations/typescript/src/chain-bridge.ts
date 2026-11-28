import { featureIdsFor } from "@qorechain/chain-bridge/features";

/** Resolve descriptive feature grants to protocol IDs; no chain transaction is sent. */
export function getValidatorFeatureIds(chains: string[]) {
  return featureIdsFor({ type: "validator", chains });
}
