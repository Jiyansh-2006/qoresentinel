import React, { useEffect, useState } from "react";
import { Activity, CheckCircle2, CircleHelp, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { api } from "../services/api.js";

type FeatureReport = Awaited<ReturnType<typeof api.getNetworkFeatures>>;

const stateStyle = (state: string) => {
  if (["verified", "enabled", "active", "available", "registry-available", "pools-found", "channels-found", "project-integration", "external-tool", "network-ready", "registered-or-queryable"].includes(state)) {
    return "border-emerald-500/20 bg-emerald-500/5 text-emerald-300";
  }
  if (["needs-account", "manual-setup", "reference", "no-pools", "no-channels", "not-registered"].includes(state)) {
    return "border-amber-500/20 bg-amber-500/5 text-amber-300";
  }
  return "border-rose-500/20 bg-rose-500/5 text-rose-300";
};

export const NetworkFeatureStatus: React.FC<{ nativeAddress?: string | null }> = ({ nativeAddress }) => {
  const [report, setReport] = useState<FeatureReport | null>(null);
  const [address, setAddress] = useState(nativeAddress || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setAddress(nativeAddress || ""), [nativeAddress]);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      setReport(await api.getNetworkFeatures(address.trim() || undefined));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load network feature status.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6 space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-white"><Activity className="h-5 w-5 text-cyan-400" /> QoreChain Network Features</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-400">Live, read-only checks against Diana Testnet plus clear setup notes for features that need a separate service, deployment, or wallet signature. A reachable endpoint alone does not mean a transaction or contract is deployed.</p>
        </div>
        <button onClick={() => void refresh()} disabled={loading} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh checks
        </button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="QoreChain account (qor1…) for account-specific checks" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none" />
        <button onClick={() => void refresh()} disabled={loading} className="rounded-lg bg-slate-800 px-4 py-2 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-50">Check account</button>
      </div>

      {error && <p role="alert" className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-300">{error}</p>}
      {report && <>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs">
          <span className="font-semibold text-slate-200">{report.network.name}</span>
          <span className="text-slate-500">Chain ID {report.network.chainId}</span>
          <span className={`inline-flex items-center gap-1 ${report.network.evmConnected ? "text-emerald-300" : "text-rose-300"}`}>
            {report.network.evmConnected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {report.network.evmConnected ? "EVM RPC reachable" : "EVM RPC unavailable"}
          </span>
          <span className="ml-auto text-[10px] text-slate-600">Checked {new Date(report.checkedAt).toLocaleTimeString()}</span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {report.features.map((feature) => (
            <article key={feature.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-100">{feature.label}</h3>
                <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${stateStyle(feature.state)}`}>{feature.state.replace(/-/g, " ")}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{feature.detail}</p>
              {feature.source && <code className="mt-3 block break-all text-[10px] text-slate-600">{feature.source}</code>}
            </article>
          ))}
        </div>
      </>}
      {!report && !error && <div className="flex items-center gap-2 py-5 text-xs text-slate-500"><CircleHelp className="h-4 w-4" />{loading ? "Querying testnet feature endpoints…" : <><CheckCircle2 className="h-4 w-4" />Ready to check the testnet.</>}</div>}
      <p className="text-[10px] text-slate-600">Read-only status only. Staking, transfers, contract deployment, IBC relaying, and wallet authentication are never initiated by this panel.</p>
    </section>
  );
};
