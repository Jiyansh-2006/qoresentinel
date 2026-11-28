import { RestClient } from "@qorechain/rdk";

/** Read-only rollup module status; does not create or submit a rollup. */
export async function readRollupModuleStatus() {
  const rest = new RestClient(process.env.QORE_REST ?? "https://api-testnet.qore.host");
  return rest.getParams();
}
