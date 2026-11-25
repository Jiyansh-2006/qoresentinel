import React from "react";
import { Link } from "react-router-dom";
import {
  Shield,
  Bot,
  Cpu,
  Lock,
  ArrowRight,
  Layers,
  Sparkles,
  CheckCircle2,
  KeyRound,
  ExternalLink,
} from "lucide-react";
import { useWallet } from "../context/WalletContext.js";

export const LandingPage: React.FC = () => {
  const { connectWallet, isConnected } = useWallet();

  return (
    <div className="space-y-16 py-4">
      {/* Hero Section */}
      <section className="relative text-center max-w-4xl mx-auto space-y-6 pt-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-800 text-cyan-400 text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5" />
          <span>QoreChain Developer Fest 2026 – Build Before Q-Day</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Autonomous Post-Quantum <br />
          <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-400 bg-clip-text text-transparent">
            Microgrant Allocation Vault
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
          QoreSentinel combines specialized multi-agent AI verification with NIST FIPS 204 ML-DSA-87 digital signatures and QoreChain smart accounts to disburse microgrants with zero human bottleneck and uncompromised cryptographic safety.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium hover:opacity-95 shadow-lg shadow-cyan-500/25 transition-all text-sm"
          >
            <span>Explore Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            to="/applications"
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-medium transition-all text-sm"
          >
            <span>Test Demo Pipeline</span>
          </Link>
        </div>

        {/* Core Metric Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 text-left">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <p className="text-xs text-slate-400">PQC Signature Standard</p>
            <p className="text-lg font-bold text-white font-mono mt-1">ML-DSA-87</p>
            <p className="text-[11px] text-cyan-400">NIST FIPS 204 (Level 5)</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <p className="text-xs text-slate-400">Chain Network</p>
            <p className="text-lg font-bold text-white font-mono mt-1">Diana Testnet</p>
            <p className="text-[11px] text-emerald-400">Chain ID 9800</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <p className="text-xs text-slate-400">Autonomous Agents</p>
            <p className="text-lg font-bold text-white font-mono mt-1">7 Specialized</p>
            <p className="text-[11px] text-blue-400">Deterministic Enforcement</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <p className="text-xs text-slate-400">Session Security</p>
            <p className="text-lg font-bold text-white font-mono mt-1">Scoped EVM</p>
            <p className="text-[11px] text-indigo-400">Least Privilege Rules</p>
          </div>
        </div>
      </section>

      {/* Core Principle Callout */}
      <section className="p-6 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-slate-900 to-blue-950/40 border border-cyan-800/40 text-center space-y-2">
        <div className="inline-flex items-center gap-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider">
          <Shield className="w-4 h-4" />
          <span>Core Security Axiom</span>
        </div>
        <h3 className="text-xl font-bold text-white">
          "AI makes recommendations; cryptographic verification, deterministic policies, and smart contracts enforce permissions."
        </h3>
        <p className="text-sm text-slate-400 max-w-2xl mx-auto">
          The autonomous transaction agent operates strictly under a time-bounded, spending-capped authenticator. An AI agent cannot unilaterally modify its budget or disburse unapproved funds.
        </p>
      </section>

      {/* 3 Pillars of QoreSentinel */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
            <Bot className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-white">Multi-Agent Intelligence</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Independent agents for Intake, Document OCR extraction, Eligibility criteria, Fraud detection, Financial treasury policies, and Consensus coordination.
          </p>
        </div>

        <div className="p-6 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-white">Post-Quantum Cryptography</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Every approved decision payload is canonically sorted (RFC 8785) and signed with NIST FIPS 204 ML-DSA-87 (Security Level 5) post-quantum lattice signatures.
          </p>
        </div>

        <div className="p-6 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
            <KeyRound className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-white">Scoped Smart Accounts</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Disbursements execute through QoreChain smart accounts with strict per-transaction limits, daily pool caps, and expiring EVM authorization windows.
          </p>
        </div>
      </section>
    </div>
  );
};
