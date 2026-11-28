import { asset, MockChain } from "@qorechain/asset-kit";

/** Local-only demonstration of a hybrid-holder constrained grant asset. */
export async function simulateRestrictedGrantAsset() {
  const mock = new MockChain();
  const issuer = "qor1issuer";
  const student = "qor1student";
  const assetId = "qoresentinel-demo-grant";
  await mock.asset.createAsset({ issuer, assetId, flags: { freezable: true, pausable: true } });
  await mock.asset.mint({ agent: issuer, assetId, to: student, amount: "100" });
  await mock.asset.freeze({ agent: issuer, assetId, holder: student, frozen: true });
  return mock.asset.canTransfer({ assetId, from: student, to: "qor1merchant", amount: "1" });
}

export { asset };
