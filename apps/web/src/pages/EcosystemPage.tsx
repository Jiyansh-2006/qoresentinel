import React, { useMemo, useState } from "react";
import { Activity, Check, Clipboard, Code2, ExternalLink, Search, ShieldCheck, Wrench } from "lucide-react";
import { NetworkFeatureStatus } from "../components/NetworkFeatureStatus.js";
import { useWallet } from "../context/WalletContext.js";

type Stack = { name: string; area: string; state: "App runtime" | "Companion tool" | "Demo / reference"; summary: string; action?: string; langs: string };

const stacks: Stack[] = [
  { name: "QoreChain SDK", area: "Core SDK", state: "App runtime", summary: "API and web app use QoreChain account, network, PQC status, signing, and EVM adapters.", langs: "TypeScript · React · EVM" },
  { name: "create-qorechain-app", area: "Scaffold", state: "Companion tool", summary: "The repository package is named create-qorechain-dapp. It generates a separate starter project; it does not scaffold over this app.", action: "npm run scaffold:qorechain -- my-qore-app --template fullstack-web --no-install", langs: "TypeScript CLI" },
  { name: "qorechain-pqc", area: "Cryptography", state: "App runtime", summary: "The API uses the QoreChain PQC package for ML-DSA-87 signature operations.", langs: "TypeScript" },
  { name: "QoreSign", area: "Signing tools", state: "Companion tool", summary: "A helper can inspect a transaction and read related PQC key and EVM window status.", action: "npm run qore:inspect -- <tx-hash> [qor-address]", langs: "TypeScript · Python · Rust · Go · Swift · JVM" },
  { name: "QoreSeal", area: "Encryption", state: "Demo / reference", summary: "An offline encryption demo is available. It is not used to encrypt student or production records.", action: "npm run qore:seal-demo -- <text>", langs: "TypeScript · Python · Rust · Go · Swift · JVM · Android" },
  { name: "QoreX integrations", area: "Wallets", state: "App runtime", summary: "The app connects to QoreX for native and EVM accounts and user-approved native transfers. Additional adapter examples are companion code.", langs: "TypeScript · React" },
  { name: "Wallet adapter", area: "Wallets", state: "Companion tool", summary: "An optional CosmJS wallet-adapter configuration is provided separately; it is not included in the deployed bundle.", langs: "TypeScript" },
  { name: "RDK", area: "Rollups", state: "Companion tool", summary: "The toolkit reads RDK module status and provides a rollup scaffold command. QoreSentinel does not deploy a rollup.", action: "npm run qore:rdk-status", langs: "TypeScript · CLI · Python · Rust · Go · Java" },
  { name: "MCP + qore CLI", area: "Developer tools", state: "Companion tool", summary: "Read-only MCP and qore CLI commands run as separate local tools, not as web-app server processes.", action: "npm run qore:mcp  |  npm run qore:chain", langs: "TypeScript · Python" },
  { name: "Asset Kit", area: "Assets", state: "Demo / reference", summary: "A local mock demonstrates restricted asset operations. No live Asset Kit asset is deployed by this project.", action: "npm run qore:asset-mock", langs: "TypeScript · Python · Go · Java · Solidity" },
  { name: "QoreScan", area: "Inspection", state: "Companion tool", summary: "A CLI command can scan the Solidity project. It is an inventory tool, not an audit certification.", action: "npm run qorescan:contracts", langs: "npm CLI · Python · Go" },
  { name: "Custody kit", area: "Custody", state: "Demo / reference", summary: "Upstream reference-kit setup and language locations are documented. No custody, deposit, or withdrawal service is implemented.", langs: "TypeScript · Python · Go · Rust · Java" },
  { name: "Chain bridge", area: "Interoperability", state: "Companion tool", summary: "A helper resolves bridge feature IDs. It does not relay or submit cross-chain transactions.", action: "npm --prefix integrations/typescript run bridge:features -- Solana Ethereum", langs: "TypeScript · Node.js" },
  { name: "Handles", area: "Identity", state: "Companion tool", summary: "A resolver helper includes a pin-store boundary for checking changed handle addresses; no app sign-in flow depends on it.", langs: "TypeScript" },
  { name: "PQ light client", area: "Verification", state: "Demo / reference", summary: "A checkpoint verifier works with supplied sample/reference data. It is not connected to live QoreChain checkpoints.", langs: "TypeScript · Rust · Go" },
];

const stateClass: Record<Stack["state"], string> = {
  "App runtime": "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  "Companion tool": "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  "Demo / reference": "border-amber-500/30 bg-amber-500/10 text-amber-300",
};

export const EcosystemPage: React.FC = () => {
  const { nativeAddress } = useWallet();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All integrations");
  const [copied, setCopied] = useState("");
  const visibleStacks = useMemo(() => stacks.filter((stack) => {
    const matchesQuery = `${stack.name} ${stack.summary} ${stack.langs} ${stack.area}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (filter === "All integrations" || stack.state === filter);
  }), [query, filter]);

  const copyCommand = async (stack: Stack) => {
    if (!stack.action) return;
    try {
      await navigator.clipboard.writeText(stack.action);
      setCopied(stack.name);
      window.setTimeout(() => setCopied(""), 1800);
    } catch {
      setCopied("Clipboard unavailable");
    }
  };

  return (
    <div className="space-y-8">
      <header className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/40 via-slate-900 to-violet-950/30 p-6 sm:p-8">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300"><Code2 className="h-4 w-4" /> Developer ecosystem</div>
        <h1 className="mt-3 text-2xl font-bold text-white sm:text-3xl">QoreChain integrations, in one place</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">Explore the SDKs, tools, and network capabilities used or demonstrated by QoreSentinel. Run companion commands in the project environment; this browser page cannot execute local developer tools on your device.</p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-emerald-300">{stacks.filter((item) => item.state === "App runtime").length} app runtime</span>
          <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-cyan-300">{stacks.filter((item) => item.state === "Companion tool").length} companion tools</span>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-amber-300">{stacks.filter((item) => item.state === "Demo / reference").length} demo/reference</span>
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-white"><Wrench className="h-5 w-5 text-violet-300" /> Kits and SDKs</h2>
            <p className="mt-1 text-xs text-slate-400">Commands are copied for use in the repository terminal; they are not executed by the deployed server.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search kits and SDKs" className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-xs text-slate-200 sm:w-56" />
            </label>
            <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200">
              {["All integrations", "App runtime", "Companion tool", "Demo / reference"].map((value) => <option key={value}>{value}</option>)}
            </select>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleStacks.map((stack) => (
            <article key={stack.name} className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/80 p-4 transition hover:border-slate-700">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{stack.area}</p><h3 className="mt-1 font-semibold text-white">{stack.name}</h3></div>
                <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-bold ${stateClass[stack.state]}`}>{stack.state}</span>
              </div>
              <p className="mt-3 flex-1 text-xs leading-relaxed text-slate-400">{stack.summary}</p>
              <p className="mt-3 text-[10px] text-slate-500">{stack.langs}</p>
              {stack.action && <button onClick={() => void copyCommand(stack)} className="mt-3 inline-flex items-center gap-2 self-start rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-[10px] text-slate-300 hover:border-cyan-500/40 hover:text-cyan-200">
                {copied === stack.name ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Clipboard className="h-3.5 w-3.5" />}{copied === stack.name ? "Copied command" : "Copy example command"}
              </button>}
            </article>
          ))}
          {visibleStacks.length === 0 && <div className="rounded-xl border border-slate-800 p-8 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-3">No integrations match that search.</div>}
        </div>
        <a href="https://github.com/qorechain" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200">QoreChain upstream repositories <ExternalLink className="h-3 w-3" /></a>
      </section>

      <section className="space-y-3">
        <div><h2 className="flex items-center gap-2 text-lg font-bold text-white"><ShieldCheck className="h-5 w-5 text-cyan-300" /> Network feature monitor</h2><p className="mt-1 text-xs text-slate-400">Read-only testnet checks and feature readiness. Wallet transactions, deployments, staking, and relaying still require explicit setup and approval.</p></div>
        <NetworkFeatureStatus nativeAddress={nativeAddress} />
      </section>

      <div className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-xs leading-relaxed text-slate-500"><Activity className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />Status labels describe how each integration is represented in this repository. They are not a guarantee that a third-party package, testnet module, bridge, contract, or external CLI is currently available.</div>
    </div>
  );
};
