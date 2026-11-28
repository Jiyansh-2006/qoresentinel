import { inspectQoreTransaction } from "./qoresign-inspector.js";
import { sealPrivateNote } from "./qoreseal.js";
import { readRollupModuleStatus } from "./rdk-status.js";
import { simulateRestrictedGrantAsset } from "./asset-kit-mock.js";
import { getValidatorFeatureIds } from "./chain-bridge.js";

const [command, ...args] = process.argv.slice(2);

try {
  if (command === "inspect") {
    if (!args[0]) throw new Error("Usage: qore-toolkit inspect <txHash> [qor-address]");
    console.log(JSON.stringify(await inspectQoreTransaction(args[0], args[1]), null, 2));
  } else if (command === "rdk-status") {
    console.log(JSON.stringify(await readRollupModuleStatus(), null, 2));
  } else if (command === "asset-mock") {
    console.log(JSON.stringify(await simulateRestrictedGrantAsset(), null, 2));
  } else if (command === "seal-demo") {
    const result = sealPrivateNote(args.join(" ") || "Demo confidential note");
    console.log(JSON.stringify({ envelope: result.envelope, roundTrip: result.open() }, null, 2));
    console.warn("Demo recipient keys are ephemeral and will be lost when this process exits.");
  } else if (command === "bridge-feature-ids") {
    console.log(JSON.stringify(getValidatorFeatureIds(args), null, 2));
  } else {
    throw new Error("Commands: inspect, rdk-status, asset-mock, seal-demo, bridge-feature-ids");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
