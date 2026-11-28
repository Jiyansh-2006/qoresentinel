import { createServer } from "@qorechain/mcp";

/** Build the upstream read-only MCP server for local stdio/HTTP transport wiring. */
export function createQoreChainMcpServer() {
  return createServer({ defaultNetwork: "testnet" });
}
