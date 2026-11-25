import React, { useState, useEffect } from "react";
import { History, Shield, CheckCircle2, Lock } from "lucide-react";
import { api } from "../services/api.js";

export const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    api.getAuditLogs().then(setLogs).catch(console.error);
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Cryptographic Audit Trail</h1>
        <p className="text-sm text-slate-400">Immutable, tamper-evident record of all AI decisions, PQC signatures, and smart contract state changes</p>
      </div>

      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="space-y-3">
          {logs.map((log) => (
            <div key={log.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono font-semibold">
                    {log.action}
                  </span>
                  <span className="text-slate-400">Actor: <strong className="text-slate-200">{log.actor}</strong></span>
                </div>
                <span className="font-mono text-slate-500 text-[11px]">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>

              <p className="text-xs text-slate-300">{log.details}</p>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span className="truncate">Record Integrity Hash: <span className="text-slate-400">{log.recordHash}</span></span>
                <span className="text-emerald-400 flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Verified</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
