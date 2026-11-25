import React from "react";
import { CheckCircle2, XCircle, Clock, AlertTriangle, ShieldCheck, ArrowRightCircle } from "lucide-react";

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  switch (status) {
    case "PAID":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <ShieldCheck className="w-3.5 h-3.5" />
          PAID / DISBURSED
        </span>
      );
    case "APPROVED":
    case "EXECUTION_PENDING":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
          <CheckCircle2 className="w-3.5 h-3.5" />
          APPROVED (PQC SIGNED)
        </span>
      );
    case "PROCESSING":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30 animate-pulse">
          <Clock className="w-3.5 h-3.5 animate-spin" />
          AGENTS ANALYZING
        </span>
      );
    case "REJECTED":
    case "FAILED":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30">
          <XCircle className="w-3.5 h-3.5" />
          REJECTED BY POLICY
        </span>
      );
    case "NEEDS_REVIEW":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
          <AlertTriangle className="w-3.5 h-3.5" />
          MANUAL REVIEW
        </span>
      );
    case "PENDING":
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
          <Clock className="w-3.5 h-3.5" />
          PENDING INTAKE
        </span>
      );
  }
};
