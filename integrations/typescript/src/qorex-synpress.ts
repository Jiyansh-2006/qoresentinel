import { qorexMockFixtures } from "@qorechain/qorex-synpress";

/** Playwright fixtures exercise wallet-connect and rejection flows without a live wallet. */
export const qorexPlaywright = qorexMockFixtures({ profile: "current" });
