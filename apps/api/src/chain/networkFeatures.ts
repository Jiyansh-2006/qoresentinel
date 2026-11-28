const REST = process.env.QORE_REST || "https://api-testnet.qore.host";
const EVM_RPC = process.env.QORE_EVM_RPC || "https://evm-testnet.qore.host";

type Probe = { ok: boolean; data?: any; error?: string };

async function readJson(url: string): Promise<Probe> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };
    return { ok: true, data: await response.json() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Request failed" };
  }
}

async function evmChainId(): Promise<Probe> {
  try {
    const response = await fetch(EVM_RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
      signal: AbortSignal.timeout(8_000),
    });
    const result = await response.json() as { result?: string };
    const id = Number.parseInt(result.result || "0x0", 16);
    return { ok: response.ok && id === 9800, data: id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "EVM RPC unavailable" };
  }
}

export async function getNetworkFeatures(address?: string) {
  const probes = await Promise.all([
    readJson(`${REST}/qorechain/pqc/v1/protocol_features`),
    readJson(`${REST}/qorechain/abstractaccount/v1/config`),
    readJson(`${REST}/qorechain/rdk/v1/params`),
    readJson(`${REST}/qorechain/crossvm/v1/params`),
    readJson(`${REST}/qorechain/stakingtier/v1/params`),
    readJson(`${REST}/qorechain/amm/v1/pools`),
    readJson(`${REST}/ibc/core/channel/v1/channels`),
    readJson(`${REST}/cosmos/evm/erc20/v1/token_pairs`),
    evmChainId(),
    address ? readJson(`${REST}/qorechain/pqc/v1/account/${encodeURIComponent(address)}`) : Promise.resolve({ ok: false, error: "Connect a QoreChain account to inspect its PQC registration." } as Probe),
    address ? readJson(`${REST}/qorechain/pqc/v1/evm_window/${encodeURIComponent(address)}`) : Promise.resolve({ ok: false, error: "Connect a QoreChain account to inspect its scoped EVM window." } as Probe),
    address ? readJson(`${REST}/qorechain/pqc/v1/kem/${encodeURIComponent(address)}`) : Promise.resolve({ ok: false, error: "Connect a QoreChain account to inspect its QoreSeal registry entry." } as Probe),
  ]);
  const [pqc, aa, rdk, crossVm, staking, amm, ibc, tokens, evm, account, window, kem] = probes;
  const hasValue = (probe: Probe, key: string) => Boolean(probe.ok && probe.data && (probe.data[key] === true || probe.data[key] === "true"));
  const poolList = amm.ok ? (Array.isArray(amm.data) ? amm.data : amm.data?.pools) : undefined;
  const channelList = ibc.ok ? (Array.isArray(ibc.data) ? ibc.data : ibc.data?.channels) : undefined;
  const tokenList = tokens.ok ? (Array.isArray(tokens.data) ? tokens.data : tokens.data?.token_pairs) : undefined;
  const item = (id: string, label: string, state: string, detail: string, source?: string) => ({ id, label, state, detail, source });

  return {
    network: { name: "QoreChain Diana Testnet", chainId: 9800, evmConnected: evm.ok },
    checkedAt: new Date().toISOString(),
    features: [
      item("hybrid-tx", "Hybrid ML-DSA-87 transactions", pqc.ok ? "available" : "unavailable", pqc.ok ? "PQC protocol feature endpoint responds. Wallet signing is required for a transaction." : pqc.error || "PQC feature endpoint unavailable.", "/qorechain/pqc/v1/protocol_features"),
      item("evm-window", "EVM window (including scoped)", window.ok ? (hasValue(window, "live") ? "active" : "available") : "needs-account", window.ok ? JSON.stringify(window.data).slice(0, 220) : window.error || "Connect an account to inspect the scoped authorization window.", "/qorechain/pqc/v1/evm_window/{address}"),
      item("pqc-status", "Solidity PQC key status", pqc.ok ? "available" : "unavailable", pqc.ok ? "QoreChain PQC module is responding; account-specific key status is shown in the QoreChain integration card." : pqc.error || "PQC module unavailable.", "/qorechain/pqc/v1/protocol_features"),
      item("smart-accounts", "Smart accounts and spending rules", aa.ok && hasValue(aa, "enabled") ? "enabled" : aa.ok ? "disabled" : "unavailable", aa.ok ? `Abstract account module enabled: ${String(aa.data?.enabled ?? "unknown")}. Spending-rule changes require a wallet-signed transaction.` : aa.error || "Abstract account endpoint unavailable.", "/qorechain/abstractaccount/v1/config"),
      item("amm", "AMM pools", amm.ok ? (poolList?.length ? "pools-found" : "no-pools") : "unavailable", amm.ok ? `${poolList?.length ?? "Unknown number of"} pool(s) reported by the testnet.` : amm.error || "AMM pool query unavailable.", "/qorechain/amm/v1/pools"),
      item("ibc", "IBC via QORel", ibc.ok ? (channelList?.length ? "channels-found" : "no-channels") : "unavailable", ibc.ok ? `${channelList?.length ?? "Unknown number of"} IBC channel(s) reported. QORel relaying is a separate service.` : ibc.error || "IBC channel query unavailable.", "/ibc/core/channel/v1/channels"),
      item("rdk", "RDK rollup", rdk.ok ? "available" : "unavailable", rdk.ok ? "RDK parameters are readable from testnet; this does not mean a rollup is deployed by this app." : rdk.error || "RDK parameters unavailable.", "/qorechain/rdk/v1/params"),
      item("light-node", "Light node", "manual-setup", "Light-node operation requires its own node setup and any applicable network registration/license."),
      item("native-contracts", "Approved Native contracts", "manual-setup", "Contract approval and deployment depend on network governance and permissions; this app does not deploy Native contracts."),
      item("asset-kit", "Asset Kit", "reference", "Asset Kit functionality is represented by the project's integration layer; no asset contract is deployed by this status check."),
      item("pop", "PQC key registration with proof of possession", account.ok ? (hasValue(account, "possession_proven") || hasValue(account, "possessionProven") ? "verified" : hasValue(account, "registered") ? "registered" : "not-registered") : "needs-account", account.ok ? JSON.stringify(account.data).slice(0, 220) : account.error || "Connect an account to check proof-of-possession registration.", "/qorechain/pqc/v1/account/{address}"),
      item("pqc-signature", "Solidity PQC signature check", pqc.ok ? "available" : "unavailable", pqc.ok ? "Testnet PQC precompile feature is documented; an actual signature check needs a signature and contract call." : pqc.error || "PQC module unavailable."),
      item("qoreseal", "QoreSeal and encryption key registry", kem.ok ? "registered-or-queryable" : "needs-account", kem.ok ? JSON.stringify(kem.data).slice(0, 220) : kem.error || "Connect an account to query the KEM registry.", "/qorechain/pqc/v1/kem/{address}"),
      item("staking", "Staking tiers", staking.ok ? "available" : "unavailable", staking.ok ? "Staking-tier parameters are readable. Locking or staking requires an explicit signed transaction." : staking.error || "Staking parameters unavailable.", "/qorechain/stakingtier/v1/params"),
      item("test-tokens", "Test tokens (fUSD, fETH, fBTC)", tokens.ok ? "registry-available" : "unavailable", tokens.ok ? `${tokenList?.length ?? "Token"} token pair(s) found in the EVM registry. These are testnet assets only.` : tokens.error || "EVM token registry unavailable.", "/cosmos/evm/erc20/v1/token_pairs"),
      item("cross-vm", "Cross-VM EVM to Native", crossVm.ok ? "available" : "unavailable", crossVm.ok ? "Cross-VM module parameters are readable; executing a transfer requires wallet approval." : crossVm.error || "Cross-VM parameters unavailable.", "/qorechain/crossvm/v1/params"),
      item("sidechain", "Sidechain or paychain", "manual-setup", "No sidechain/paychain deployment is configured by this application."),
      item("mcp-cli", "MCP server or Qore CLI", "project-integration", "Project integration helpers and CLI scripts are documented in the repository; they run separately from the web app."),
      item("siwq", "Sign In with QoreChain", evm.ok ? "network-ready" : "network-unavailable", evm.ok ? "QoreChain EVM testnet RPC is reachable. Authentication still requires an explicit wallet signature." : evm.error || "QoreChain EVM RPC unavailable."),
      item("qorescan", "QoreScan", "external-tool", "QoreScan is an external explorer/audit tool; use it to independently inspect testnet addresses and transactions."),
    ],
  };
}
