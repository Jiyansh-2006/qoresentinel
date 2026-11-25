import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowDownToLine,
  Check,
  CheckCircle2,
  Clipboard,
  Clock3,
  FileKey2,
  Fingerprint,
  Search,
  ShieldCheck,
} from "lucide-react";
import { api } from "../services/api.js";

interface AuditLog {
  id: string;
  applicationId?: string;
  action: string;
  actor: string;
  details: string;
  recordHash: string;
  createdAt: string;
}

const actionTone = (action: string) => {
  const value = action.toLowerCase();
  if (value.includes("reject") || value.includes("fail") || value.includes("revoke")) {
    return { icon: AlertCircle, color: "text-rose-300", shell: "border-rose-400/20 bg-rose-400/[0.07]", dot: "bg-rose-300" };
  }
  if (value.includes("approve") || value.includes("confirm") || value.includes("register")) {
    return { icon: CheckCircle2, color: "text-emerald-300", shell: "border-emerald-400/20 bg-emerald-400/[0.07]", dot: "bg-emerald-300" };
  }
  return { icon: Activity, color: "text-cyan-300", shell: "border-cyan-400/20 bg-cyan-400/[0.07]", dot: "bg-cyan-300" };
};

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [copiedId, setCopiedId] = useState("");
  const [downloadMessage, setDownloadMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    api.getAuditLogs()
      .then((records: AuditLog[]) => {
        if (mounted) setLogs(Array.isArray(records) ? records : []);
      })
      .catch((reason: unknown) => {
        if (mounted) setError(reason instanceof Error ? reason.message : "Audit records could not be loaded.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const actions = useMemo(() => Array.from(new Set(logs.map((log) => log.action))).sort(), [logs]);
  const filteredLogs = useMemo(() => {
    const term = query.trim().toLowerCase();
    return logs.filter((log) => {
      if (actionFilter !== "ALL" && log.action !== actionFilter) return false;
      if (!term) return true;
      return [log.action, log.actor, log.details, log.recordHash, log.applicationId]
        .some((value) => value?.toLowerCase().includes(term));
    });
  }, [actionFilter, logs, query]);

  const copyHash = async (log: AuditLog) => {
    try {
      await navigator.clipboard.writeText(log.recordHash);
      setCopiedId(log.id);
      window.setTimeout(() => setCopiedId((current) => current === log.id ? "" : current), 1500);
    } catch {
      setError("Clipboard access is unavailable in this browser.");
    }
  };

  const exportCsv = (records: AuditLog[], scope: "visible" | "all") => {
    const columns = ["id", "createdAt", "action", "actor", "applicationId", "details", "recordHash"] as const;
    const rows = [columns.join(","), ...records.map((log) => columns.map((key) => escapeCsv(log[key])).join(","))];
    const blob = new Blob([`\uFEFF${rows.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `qoresentinel-audit-${scope}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setDownloadMessage(`Downloaded ${records.length} ${records.length === 1 ? "record" : "records"} as CSV.`);
    window.setTimeout(() => setDownloadMessage(""), 3000);
  };

  const latestRecord = logs[0];

  return (
    <main className="space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-cyan-400/15 bg-gradient-to-br from-[#12283a] via-[#101b2c] to-[#101827] p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-cyan-400/[0.07] blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[0.07] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
              <ShieldCheck className="h-3.5 w-3.5" /> Audit &amp; accountability
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Audit Trail</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Review platform events with their recorded SHA-256 hashes, actors, and timestamps.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => exportCsv(filteredLogs, "visible")}
              disabled={filteredLogs.length === 0}
              title={`Download ${filteredLogs.length} visible audit records as a .csv file`}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowDownToLine className="h-4 w-4" /> Download visible .CSV
              <span className="rounded bg-slate-950/10 px-1.5 py-0.5 text-[10px]">{filteredLogs.length}</span>
            </button>
            <button
              type="button"
              onClick={() => exportCsv(logs, "all")}
              disabled={logs.length === 0}
              title={`Download all ${logs.length} audit records as a .csv file`}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-600/70 bg-slate-950/40 px-4 py-2.5 text-xs font-semibold text-slate-200 transition hover:border-cyan-300/40 hover:bg-cyan-300/[0.07] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowDownToLine className="h-4 w-4 text-cyan-200" /> Download all .CSV
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-xs text-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {downloadMessage && <p role="status" className="-mt-3 text-right text-[11px] text-emerald-300">{downloadMessage}</p>}

      <section aria-label="Audit summary" className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={Activity} label="Total records" value={loading ? "—" : logs.length.toLocaleString()} note="Events available in this workspace" />
        <SummaryCard icon={Clock3} label="Latest activity" value={latestRecord ? formatDate(latestRecord.createdAt) : loading ? "Loading" : "No activity"} note={latestRecord?.action ?? "New events will appear here"} compact />
        <SummaryCard icon={Fingerprint} label="Hash coverage" value={loading ? "—" : `${logs.filter((log) => Boolean(log.recordHash)).length} / ${logs.length}`} note="Records with a stored hash" />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0e1828]/90">
        <div className="flex flex-col gap-4 border-b border-slate-800 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="text-sm font-semibold text-white">Event history</h2>
            <p className="mt-1 text-[11px] text-slate-500">{filteredLogs.length} {filteredLogs.length === 1 ? "record" : "records"} shown</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex h-9 min-w-0 items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/60 px-3 sm:w-64">
              <Search className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search event, actor, hash…"
                aria-label="Search audit events"
                className="min-w-0 flex-1 bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-600"
              />
            </label>
            <select
              aria-label="Filter by action"
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
              className="h-9 rounded-lg border border-slate-700 bg-slate-950/60 px-3 text-xs text-slate-300 outline-none focus:border-cyan-300/50"
            >
              <option value="ALL">All event types</option>
              {actions.map((action) => <option key={action} value={action}>{action.replace(/_/g, " ")}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-5" aria-label="Loading audit records">
            {[0, 1, 2].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl bg-slate-800/50" />)}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-slate-700 bg-slate-900 text-slate-500"><FileKey2 className="h-5 w-5" /></div>
            <h3 className="mt-4 text-sm font-semibold text-slate-200">{logs.length ? "No matching records" : "No audit events yet"}</h3>
            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{logs.length ? "Try another search phrase or clear the event type filter." : "Platform activity will be recorded here as events occur."}</p>
            {(query || actionFilter !== "ALL") && <button type="button" onClick={() => { setQuery(""); setActionFilter("ALL"); }} className="mt-4 text-xs font-semibold text-cyan-200 hover:text-white">Clear filters</button>}
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {filteredLogs.map((log) => {
              const tone = actionTone(log.action);
              const Icon = tone.icon;
              return (
                <article key={log.id} className="group px-4 py-4 transition hover:bg-white/[0.015] sm:px-5">
                  <div className="flex gap-3 sm:gap-4">
                    <div className="relative flex flex-col items-center">
                      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${tone.shell} ${tone.color}`}><Icon className="h-4 w-4" /></div>
                      <div className="absolute top-11 h-[calc(100%-1.25rem)] w-px bg-slate-800 group-last:hidden" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-xs font-semibold text-slate-100">{log.action.replace(/_/g, " ")}</h3>
                            <span className={`inline-flex items-center gap-1.5 rounded-full border border-slate-700/80 bg-slate-900/70 px-2 py-0.5 text-[9px] text-slate-400`}>
                              <i className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} /> {log.actor}
                            </span>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-slate-400">{log.details}</p>
                        </div>
                        <time className="shrink-0 text-[10px] text-slate-500 sm:pt-0.5">{formatDate(log.createdAt)}</time>
                      </div>

                      <div className="mt-3 flex flex-col gap-2 rounded-lg border border-slate-800/80 bg-slate-950/45 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-2">
                          <Fingerprint className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300/70" />
                          <div className="min-w-0">
                            <span className="block text-[9px] font-semibold uppercase tracking-wider text-slate-500">Record hash</span>
                            <code className="mt-1 block break-all font-mono text-[10px] text-slate-300 sm:truncate">{log.recordHash || "Not available"}</code>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void copyHash(log)}
                          disabled={!log.recordHash}
                          className="inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-md px-2 py-1 text-[10px] text-slate-400 transition hover:bg-slate-800 hover:text-cyan-200 disabled:opacity-40 sm:self-auto"
                          aria-label="Copy record hash"
                        >
                          {copiedId === log.id ? <Check className="h-3 w-3" /> : <Clipboard className="h-3 w-3" />}
                          {copiedId === log.id ? "Copied" : "Copy hash"}
                        </button>
                      </div>
                      {log.applicationId && <p className="mt-2 text-[10px] text-slate-600">Application <span className="font-mono text-slate-500">{log.applicationId}</span></p>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <p className="flex items-start gap-2 px-1 text-[10px] leading-5 text-slate-600">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
        Hashes are recorded with each event for integrity reference. This screen does not independently verify a hash chain or on-chain audit commitment.
      </p>
    </main>
  );
};

function SummaryCard({
  icon: Icon,
  label,
  value,
  note,
  compact = false,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  note: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#101a2a] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium text-slate-400">{label}</span>
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-cyan-300/10 bg-cyan-300/[0.06] text-cyan-200"><Icon className="h-4 w-4" /></span>
      </div>
      <p className={`${compact ? "text-xs" : "text-xl"} mt-3 font-semibold ${compact ? "leading-5 text-slate-100" : "tracking-tight text-white"}`}>{value}</p>
      <p className="mt-1 truncate text-[10px] text-slate-500">{note}</p>
    </div>
  );
}
