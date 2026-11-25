import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Circle,
  Clock3,
  Pause,
  Play,
  RefreshCw,
  ShieldAlert,
  Terminal,
  Trash2,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../services/api.js";
import { useWallet } from "../context/WalletContext.js";
import type {
  AgentExecutionDetail,
  AgentExecutionSummary,
  AgentOverview,
  AgentExecutionReport,
  GrantApplication,
} from "../types/index.js";

interface AgentMeta {
  id: string;
  role: string;
  name: string;
  description: string;
  status: string;
  version: string;
}

interface AgentLog {
  id: string;
  action: string;
  actor: string;
  details: string;
  createdAt: string;
  agentRole?: string;
  eventType?: string;
  applicationId?: string;
  executionId?: string;
  output?: unknown;
  stepIndex?: number;
  executionMs?: number;
}

interface LiveAgentEvent {
  executionId: string;
  applicationId: string;
  agentRole: string;
  agentName: string;
  stepIndex: number;
  totalSteps: number;
  status: "START" | "COMPLETE" | "ERROR";
  executionMs: number;
  data: unknown;
  timestamp: number;
}

interface ExecutionSignal {
  executionId: string;
  applicationId: string;
  status: string;
}

const MAX_LOGS = 100;

const formatDuration = (durationMs?: number) => {
  if (durationMs === undefined) return "—";
  return durationMs < 1000 ? `${durationMs} ms` : `${(durationMs / 1000).toFixed(2)} s`;
};

const formatReportOutput = (output: unknown) => JSON.stringify(output ?? null, null, 2);

export const AgentsPage: React.FC = () => {
  const [agents, setAgents] = useState<AgentMeta[]>([]);
  const [overview, setOverview] = useState<AgentOverview | null>(null);
  const [applications, setApplications] = useState<GrantApplication[]>([]);
  const [executions, setExecutions] = useState<AgentExecutionSummary[]>([]);
  const [activeExecutionId, setActiveExecutionId] = useState("");
  const [activeExecution, setActiveExecution] = useState<AgentExecutionDetail | null>(null);
  const [selectedApplicationId, setSelectedApplicationId] = useState("");
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [streamStatus, setStreamStatus] = useState<"connecting" | "connected" | "reconnecting">("connecting");
  const [streamPaused, setStreamPaused] = useState(false);
  const [agentFilter, setAgentFilter] = useState("all");
  const [applicationFilter, setApplicationFilter] = useState("");
  const [eventFilter, setEventFilter] = useState("all");
  const [loadingApplications, setLoadingApplications] = useState(true);
  const [running, setRunning] = useState(false);
  const [confirmReview, setConfirmReview] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const pausedRef = useRef(false);
  const bufferedLogsRef = useRef<AgentLog[]>([]);
  const { isDemoMode } = useWallet();

  const loadApplications = useCallback(async () => {
    setLoadingApplications(true);
    try {
      const data = await api.getApplications();
      setApplications(data);
      setSelectedApplicationId((current) => {
        if (data.some((app) => app.id === current && app.status === "PENDING")) return current;
        return data.find((app) => app.status === "PENDING")?.id || "";
      });
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Could not load applications.");
    } finally {
      setLoadingApplications(false);
    }
  }, []);

  const loadExecutionHistory = useCallback(async () => {
    try {
      const data = await api.getAgentExecutions();
      setExecutions(data);
      setActiveExecutionId((current) => current || data[0]?.id || "");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Could not load execution history.");
    }
  }, []);

  const refreshOverview = useCallback(async () => {
    try {
      setOverview(await api.getAgentOverview());
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Could not load agent overview.");
    }
  }, []);

  useEffect(() => {
    api.getAgents()
      .then(setAgents)
      .catch((error) => setPageError(error instanceof Error ? error.message : "Could not load agent status."));
    api.getAgentActivity()
      .then((activity) => setLogs(activity.slice(0, MAX_LOGS)))
      .catch((error) => setPageError(error instanceof Error ? error.message : "Could not load agent activity."));
    void loadApplications();
    void loadExecutionHistory();
    void refreshOverview();

    const eventSource = new EventSource("/api/agents/stream");
    eventSource.onopen = () => setStreamStatus("connected");
    eventSource.onerror = () => setStreamStatus("reconnecting");
    eventSource.addEventListener("agent_event", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as LiveAgentEvent;
      const log: AgentLog = {
        id: `live-${data.executionId}-${data.stepIndex}-${data.status}-${Math.random()}`,
        action: `${data.agentName} [${data.status}]`,
        actor: data.agentRole,
        agentRole: data.agentRole,
        eventType: data.status,
        applicationId: data.applicationId,
        executionId: data.executionId,
        output: data.data,
        stepIndex: data.stepIndex,
        executionMs: data.executionMs,
        details: data.status === "START"
          ? `Step ${data.stepIndex}/${data.totalSteps} started`
          : `Step ${data.stepIndex}/${data.totalSteps} finished in ${data.executionMs}ms`,
        createdAt: new Date(data.timestamp).toISOString(),
      };
      setActiveExecutionId(data.executionId);

      if (pausedRef.current) {
        bufferedLogsRef.current.push(log);
        if (bufferedLogsRef.current.length > MAX_LOGS) {
          bufferedLogsRef.current.splice(0, bufferedLogsRef.current.length - MAX_LOGS);
        }
        return;
      }
      setLogs((current) => [log, ...current].slice(0, MAX_LOGS));
    });
    eventSource.addEventListener("execution_event", (event) => {
      const signal = JSON.parse((event as MessageEvent).data) as ExecutionSignal;
      if (signal.status === "COMPLETED" || signal.status === "FAILED") {
        void loadExecutionHistory();
        void refreshOverview();
      }
    });

    return () => eventSource.close();
  }, [loadApplications, loadExecutionHistory, refreshOverview]);

  useEffect(() => {
    if (!activeExecutionId) {
      setActiveExecution(null);
      return;
    }
    api.getAgentExecution(activeExecutionId)
      .then(setActiveExecution)
      .catch((error) => {
        setActiveExecution(null);
        setPageError(error instanceof Error ? error.message : "Could not load execution report.");
      });
  }, [activeExecutionId]);

  const pendingApplications = useMemo(
    () => applications.filter((application) => application.status === "PENDING"),
    [applications]
  );
  const selectedApplication = pendingApplications.find((application) => application.id === selectedApplicationId);

  const filteredLogs = useMemo(() => logs.filter((log) => {
    const matchesAgent = agentFilter === "all" || log.actor === agentFilter || log.agentRole === agentFilter;
    const matchesApplication = !applicationFilter.trim()
      || log.applicationId?.toLowerCase().includes(applicationFilter.trim().toLowerCase());
    const matchesEvent = eventFilter === "all" || log.eventType === eventFilter;
    return matchesAgent && matchesApplication && matchesEvent;
  }), [agentFilter, applicationFilter, eventFilter, logs]);

  const latestAgentStatuses = useMemo(() => {
    const statuses = new Map<string, LiveAgentEvent["status"]>();
    const executionLogs = logs
      .filter((log) => !activeExecutionId || log.executionId === activeExecutionId);
    for (const log of executionLogs) {
      const match = log.action.match(/\[(START|COMPLETE|ERROR)\]$/);
      if (match && log.agentRole && !statuses.has(log.agentRole)) {
        statuses.set(log.agentRole, match[1] as LiveAgentEvent["status"]);
      }
    }
    return statuses;
  }, [activeExecutionId, logs]);

  const toggleStreamPause = () => {
    const nextPaused = !pausedRef.current;
    pausedRef.current = nextPaused;
    setStreamPaused(nextPaused);
    if (!nextPaused && bufferedLogsRef.current.length) {
      const bufferedLogs = bufferedLogsRef.current.splice(0).reverse();
      setLogs((current) => [...bufferedLogs, ...current].slice(0, MAX_LOGS));
    }
  };

  const handleRunPipeline = async () => {
    if (!selectedApplication || running || !isDemoMode) return;
    setConfirmReview(false);
    setRunning(true);
    setRunMessage(null);
    setPageError(null);
    try {
      const result = await api.runAgentAnalysis(selectedApplication.id, true);
      setActiveExecutionId(result.executionId);
      const details = await api.getAgentExecution(result.executionId);
      setActiveExecution(details);
      setRunMessage(`Review completed for ${selectedApplication.projectTitle}: ${result.decision?.finalDecision || "complete"}.`);
      await Promise.all([loadApplications(), loadExecutionHistory(), refreshOverview()]);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Agent pipeline execution failed.");
      await Promise.all([loadApplications(), loadExecutionHistory(), refreshOverview()]);
    } finally {
      setRunning(false);
    }
  };

  const getAgentStatus = (agent: AgentMeta) => {
    const status = latestAgentStatuses.get(agent.role);
    if (status === "START") return { label: "RUNNING", className: "text-amber-300", dotClassName: "bg-amber-300 animate-pulse" };
    if (status === "ERROR") return { label: "ERROR", className: "text-rose-300", dotClassName: "bg-rose-400" };
    if (status === "COMPLETE") return { label: "COMPLETE", className: "text-emerald-300", dotClassName: "bg-emerald-400" };
    return { label: "IDLE", className: "text-slate-400", dotClassName: "bg-slate-500" };
  };

  const getExecutionStatus = (agentRole: string) => {
    const status = latestAgentStatuses.get(agentRole);
    if (status === "START") return "running";
    if (status === "COMPLETE") return "complete";
    if (status === "ERROR") return "failed";
    return "waiting";
  };

  const selectedExecution = executions.find((execution) => execution.id === activeExecutionId);
  const liveReports = logs
    .filter((log) => log.executionId === activeExecutionId && log.eventType !== "START")
    .map((log) => ({
      agentRole: log.agentRole || log.actor,
      agentName: log.action.replace(/\s+\[(COMPLETE|ERROR)\]$/, ""),
      stepIndex: log.stepIndex || 0,
      status: log.eventType || "COMPLETE",
      executionMs: log.executionMs || 0,
      output: log.output,
      createdAt: log.createdAt,
    }))
    .reverse();
  const visibleReports = activeExecution?.reports.length ? activeExecution.reports : liveReports;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Autonomous AI Agent Control Centre</h1>
          <p className="mt-1 text-sm text-slate-400">Run and monitor the seven-agent deterministic grant evaluation pipeline.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void Promise.all([loadApplications(), loadExecutionHistory(), refreshOverview()])}
            disabled={loadingApplications || running}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingApplications ? "animate-spin" : ""}`} />
            Refresh panel
          </button>
          <Link to="/applications" className="rounded-lg border border-cyan-800 px-3 py-2 text-xs font-medium text-cyan-200 hover:bg-cyan-950/50">
            Open Applications
          </Link>
        </div>
      </header>

      <section aria-label="Agent overview" className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Operations overview</h2>
          <span className="rounded-full border border-amber-900/70 bg-amber-950/30 px-2.5 py-1 text-[10px] font-medium text-amber-200">
            {overview?.demoData ? "In-memory demo records" : "Live API metrics"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          {[
            ["Agents", overview?.totalAgents ?? agents.length],
            ["Running", overview?.activeAgents ?? 0],
            ["Idle", overview?.idleAgents ?? agents.length],
            ["Attention", overview?.agentsRequiringAttention ?? 0],
            ["Reviews", overview?.totalApplicationsProcessed ?? 0],
            ["Completed", overview?.successfulExecutions ?? 0],
            ["Failed", overview?.failedExecutions ?? 0],
            ["Avg. time", formatDuration(overview?.averageProcessingMs)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-1 text-lg font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5" aria-label="Pipeline controls">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <label htmlFor="agent-application" className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Application to evaluate
            </label>
            <select
              id="agent-application"
              value={selectedApplicationId}
              onChange={(event) => {
                setSelectedApplicationId(event.target.value);
                setRunMessage(null);
              }}
              disabled={loadingApplications || running || !pendingApplications.length}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-600 disabled:opacity-60"
            >
              {pendingApplications.length ? pendingApplications.map((application) => (
                <option key={application.id} value={application.id}>
                  {application.projectTitle} — {application.requestedAmountQOR} QOR
                </option>
              )) : (
                <option value="">{loadingApplications ? "Loading applications…" : "No pending applications"}</option>
              )}
            </select>
            <p className="text-xs text-slate-500">
              {isDemoMode
                ? "Runs the complete seven-agent pipeline in demo mode. Decisions remain controlled by deterministic checks."
                : "Live execution requires the wallet confirmation flow on the Applications page."}
            </p>
          </div>
          {isDemoMode ? (
            <button
              type="button"
              onClick={() => setConfirmReview(true)}
              disabled={!selectedApplication || running || loadingApplications}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              Run autonomous review
            </button>
          ) : (
            <Link to="/applications" className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
              <Play className="h-4 w-4" />
              Continue in Applications
            </Link>
          )}
        </div>

        {!pendingApplications.length && !loadingApplications && (
          <p className="mt-3 text-xs text-slate-500">
            Need a test application? Open Applications and load the demo scenarios, or submit a new application.
          </p>
        )}
        {runMessage && <p role="status" className="mt-3 text-sm text-emerald-300">{runMessage}</p>}
        {pageError && (
          <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-rose-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {pageError}
          </p>
        )}
      </section>

      <section aria-label="Agent workflow execution">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Live workflow</h2>
            <p className="mt-1 text-xs text-slate-500">
              {activeExecution ? `Execution ${activeExecution.id} · ${activeExecution.status}` : "Workflow status updates from backend execution events"}
            </p>
          </div>
          {selectedExecution?.durationMs !== undefined && (
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <Clock3 className="h-3.5 w-3.5" />
              {formatDuration(selectedExecution.durationMs)}
            </span>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {agents.map((agent, index) => {
            const state = getExecutionStatus(agent.role);
            return (
              <React.Fragment key={agent.id}>
                <div className={`min-w-40 flex-1 rounded-xl border p-3 ${
                  state === "running" ? "border-amber-500/60 bg-amber-950/20" :
                  state === "complete" ? "border-emerald-800 bg-emerald-950/20" :
                  state === "failed" ? "border-rose-800 bg-rose-950/20" :
                  "border-slate-800 bg-slate-900"
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono text-slate-500">{String(index + 1).padStart(2, "0")}</span>
                    {state === "complete" ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> :
                      state === "failed" ? <XCircle className="h-4 w-4 text-rose-400" /> :
                        state === "running" ? <Activity className="h-4 w-4 animate-pulse text-amber-300" /> :
                          <Circle className="h-3.5 w-3.5 text-slate-600" />}
                  </div>
                  <p className="mt-2 text-xs font-semibold text-slate-200">{agent.name}</p>
                  <p className="mt-1 text-[10px] uppercase text-slate-500">{state}</p>
                </div>
                {index < agents.length - 1 && <ArrowRight className="mt-8 h-4 w-4 shrink-0 text-slate-600" />}
              </React.Fragment>
            );
          })}
        </div>
      </section>

      <section aria-label="Agent pipeline nodes">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-white">Pipeline agents</h2>
          <span className="text-xs text-slate-500">{agents.length} nodes</span>
        </div>
        {agents.length === 0 && !pageError ? (
          <p className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-400">Loading agent status…</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {agents.map((agent, index) => {
              const status = getAgentStatus(agent);
              const report = visibleReports.find((item) => item.agentRole === agent.role);
              return (
                <article key={agent.id} className="flex flex-col justify-between space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-5">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="rounded border border-cyan-800 bg-cyan-950 px-2 py-0.5 font-mono text-[10px] font-semibold text-cyan-300">
                        Node #{index + 1}
                      </span>
                      <span className={`flex items-center gap-1.5 text-[10px] font-semibold ${status.className}`}>
                        <span className={`h-2 w-2 rounded-full ${status.dotClassName}`} />
                        {status.label}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white">{agent.name}</h3>
                    <p className="text-xs leading-relaxed text-slate-400">{agent.description}</p>
                    <details className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                      <summary className="cursor-pointer text-xs font-medium text-cyan-200">
                        {report ? "Inspect latest report" : "Agent information"}
                      </summary>
                      <div className="mt-3 space-y-2 text-xs text-slate-400">
                        <p><span className="text-slate-500">Role:</span> {agent.role}</p>
                        {report ? (
                          <>
                            <p><span className="text-slate-500">Status:</span> {report.status} · {formatDuration(report.executionMs)}</p>
                            <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded bg-black/40 p-2 text-[10px] text-slate-300">
                              {formatReportOutput(report.output)}
                            </pre>
                          </>
                        ) : <p>No report for this agent in the selected execution.</p>}
                      </div>
                    </details>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 font-mono text-[10px] text-slate-500">
                    <span>{agent.role}</span>
                    <span>v{agent.version}</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {(activeExecution || (running && liveReports.length > 0)) && (
        <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6" aria-label="Execution decision and reports">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">Decision and agent reports</h2>
              <p className="mt-1 text-xs text-slate-500">
                Application {activeExecution?.applicationId || selectedApplicationId} · {visibleReports.length} completed report(s)
              </p>
            </div>
            {activeExecution?.finalDecision && (
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                activeExecution.finalDecision === "APPROVED"
                  ? "border-emerald-800 bg-emerald-950/40 text-emerald-300"
                  : "border-rose-800 bg-rose-950/40 text-rose-300"
              }`}>
                {activeExecution.finalDecision}
              </span>
            )}
          </div>
          {activeExecution?.error && <p role="alert" className="text-sm text-rose-300">{activeExecution.error}</p>}
          {activeExecution?.transactionResult && (
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300">
              <p>Transaction: {activeExecution.transactionResult.isSimulated ? "Demo simulation" : "On-chain execution"}</p>
              {activeExecution.transactionResult.txHash && <p className="mt-1 break-all font-mono text-cyan-300">{activeExecution.transactionResult.txHash}</p>}
            </div>
          )}
          <div className="space-y-2">
            {visibleReports.map((report: AgentExecutionReport) => (
              <details key={`${report.agentRole}-${report.stepIndex}`} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <summary className="cursor-pointer text-sm font-medium text-slate-200">
                  {report.agentName} — {report.status}
                  <span className="ml-2 text-xs font-normal text-slate-500">{formatDuration(report.executionMs)}</span>
                </summary>
                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded bg-black/40 p-3 text-[11px] text-slate-300">
                  {formatReportOutput(report.output)}
                </pre>
              </details>
            ))}
            {!visibleReports.length && (
              <p className="text-sm text-slate-500">Reports will appear here as the backend completes each agent.</p>
            )}
          </div>
        </section>
      )}

      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6" aria-label="Execution history">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Autonomous execution history</h2>
            <p className="mt-1 text-xs text-slate-500">The latest 100 execution records are held in API memory and reset when the demo API restarts.</p>
          </div>
          <span className="text-xs text-slate-500">{executions.length} run(s)</span>
        </div>
        {executions.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-2 pr-3">Execution</th>
                  <th className="pb-2 pr-3">Application</th>
                  <th className="pb-2 pr-3">Started</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Decision</th>
                  <th className="pb-2 pr-3">Duration</th>
                  <th className="pb-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {executions.map((execution) => (
                  <tr key={execution.id} className="border-t border-slate-800 text-slate-300">
                    <td className="py-2 pr-3 font-mono text-cyan-300">{execution.id.slice(0, 8)}</td>
                    <td className="py-2 pr-3 font-mono">{execution.applicationId}</td>
                    <td className="py-2 pr-3">{new Date(execution.startedAt).toLocaleString()}</td>
                    <td className="py-2 pr-3">{execution.status}</td>
                    <td className="py-2 pr-3">{execution.finalDecision || "—"}</td>
                    <td className="py-2 pr-3">{formatDuration(execution.durationMs)}</td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => setActiveExecutionId(execution.id)}
                        className="rounded border border-slate-700 px-2 py-1 text-cyan-200 hover:bg-slate-800"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No reviews have been run in this API session yet.</p>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6" aria-label="Agent execution stream">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-base font-semibold text-white">
            <Terminal className="h-4 w-4 text-cyan-400" />
            <h2>Real-Time Multi-Agent Execution Stream</h2>
          </div>
          <span className={`flex items-center gap-1.5 font-mono text-xs ${streamStatus === "connected" ? "text-emerald-300" : "text-amber-300"}`}>
            <span className={`h-2 w-2 rounded-full ${streamStatus === "connected" ? "bg-emerald-400" : "bg-amber-300 animate-pulse"}`} />
            {streamPaused ? "Paused" : streamStatus === "connected" ? "Live connected" : streamStatus === "connecting" ? "Connecting…" : "Reconnecting…"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleStreamPause}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"
          >
            {streamPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            {streamPaused ? "Resume stream" : "Pause stream"}
          </button>
          <button
            type="button"
            onClick={() => {
              setLogs([]);
              bufferedLogsRef.current = [];
            }}
            disabled={!logs.length && !bufferedLogsRef.current.length}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear events
          </button>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            Agent
            <select
              value={agentFilter}
              onChange={(event) => setAgentFilter(event.target.value)}
              className="max-w-56 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-slate-200 outline-none focus:border-cyan-600"
            >
              <option value="all">All agents</option>
              {agents.map((agent) => <option key={agent.id} value={agent.role}>{agent.name}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            Application
            <input
              value={applicationFilter}
              onChange={(event) => setApplicationFilter(event.target.value)}
              placeholder="Filter by ID"
              className="w-36 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-600"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            Event
            <select
              value={eventFilter}
              onChange={(event) => setEventFilter(event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-slate-200 outline-none focus:border-cyan-600"
            >
              <option value="all">All events</option>
              <option value="START">Started</option>
              <option value="COMPLETE">Completed</option>
              <option value="ERROR">Failed</option>
            </select>
          </label>
        </div>

        <div className="max-h-96 space-y-2 overflow-y-auto rounded-xl border border-slate-800/80 bg-[#04070e] p-4 font-mono text-xs" aria-live="polite">
          {filteredLogs.length === 0 ? (
            <p className="text-slate-600">{logs.length ? "No events match these filters." : "Waiting for agent pipeline execution events…"}</p>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 border-b border-slate-900/60 py-1.5 last:border-0">
                <span className="shrink-0 text-slate-600">[{new Date(log.createdAt).toLocaleTimeString()}]</span>
                <span className="flex shrink-0 items-center gap-1.5 font-semibold text-cyan-400">
                  {log.eventType === "COMPLETE" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> :
                    log.eventType === "ERROR" ? <XCircle className="h-3.5 w-3.5 text-rose-400" /> :
                      <Circle className="h-3 w-3" />}
                  {log.actor}:
                </span>
                <span className="break-words text-slate-300">{log.action} — {log.details}</span>
              </div>
            ))
          )}
        </div>
        {streamPaused && bufferedLogsRef.current.length > 0 && (
          <p className="text-xs text-slate-500">{bufferedLogsRef.current.length} new event(s) buffered. Resume to display them.</p>
        )}
      </section>

      <section className="flex items-start gap-3 rounded-xl border border-amber-900/60 bg-amber-950/20 p-4 text-xs text-amber-100" aria-label="Admin controls security limitation">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
        <p>
          Agent start/stop, behavior configuration, permissions, and kill-switch controls are not exposed here because this API does not yet authenticate administrators. Pipeline decisions remain deterministic; live blockchain execution continues through the existing wallet-confirmation flow.
        </p>
      </section>

      {confirmReview && selectedApplication && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-confirm-title"
            className="w-full max-w-lg space-y-5 rounded-2xl border border-slate-700 bg-slate-950 p-6 shadow-2xl"
          >
            <div>
              <h2 id="review-confirm-title" className="text-lg font-semibold text-white">Confirm autonomous review</h2>
              <p className="mt-1 text-sm text-slate-400">The full seven-agent deterministic pipeline will evaluate this pending application in demo mode.</p>
            </div>
            <dl className="grid grid-cols-2 gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm">
              <dt className="text-slate-500">Project</dt><dd className="text-right text-slate-200">{selectedApplication.projectTitle}</dd>
              <dt className="text-slate-500">Applicant</dt><dd className="text-right text-slate-200">{selectedApplication.applicantName}</dd>
              <dt className="text-slate-500">Category</dt><dd className="text-right text-slate-200">{selectedApplication.category.replace(/_/g, " ")}</dd>
              <dt className="text-slate-500">Request</dt><dd className="text-right text-slate-200">{selectedApplication.requestedAmountQOR} QOR</dd>
            </dl>
            <p className="text-xs text-amber-200">This is a demo review. It does not submit a real blockchain payment.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmReview(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">
                Cancel
              </button>
              <button type="button" onClick={() => void handleRunPipeline()} className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
                <Play className="h-4 w-4" />
                Confirm review
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
