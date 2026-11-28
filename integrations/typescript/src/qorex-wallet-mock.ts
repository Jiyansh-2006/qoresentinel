import { createQorexMock } from "@qorechain/qorex-wallet-mock";

/** Install QoreX's documented testnet-only provider mock in a browser test. */
export function installQorexMock(target: Window) {
  const mock = createQorexMock({ profile: "current" });
  mock.install(target);
  return mock;
}
