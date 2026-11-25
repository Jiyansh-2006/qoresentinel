import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  KeyRound,
  Lock,
  Clock,
  AlertTriangle,
  RotateCw,
  Ban,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { api } from "../services/api.js";
import { SecurityStatus } from "../types/index.js";

export const SecurityPage: React.FC = () => {
  const [security, setSecurity] = useState<SecurityStatus | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [countdown, setCountdown] = useState<number>(7200);

  const loadSecurity = () => {
    api.getSecurityStatus()
      .then((data) => {
        setSecurity(data);
        if (data.authenticatorDetails?.scopedEvmAuthWindow?.remainingSeconds) {
          setCountdown(data.authenticatorDetails.scopedEvmAuthWindow.remainingSeconds);
        }
      })
      .catch(console.error);
  };

  useEffect(() => {
    loadSecurity();
    const interval = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRotateKeys = async () => {
    if (!confirm("Confirm Post-Quantum Key Rotation? A new ML-DSA-87 keypair will be generated and active keystore encrypted.")) return;
    setIsRotating(true);
    try {
      await api.rotateKeys();
      loadSecurity();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsRotating(false);
    }
  };

  const handleExtendEvm = async () => {
    try {
      await api.extendEvmWindow(7200); // 2 hours
      loadSecurity();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleRevokeAgent = async () => {
    if (!confirm("CRITICAL ACTION: Immediately revoke Agent Authenticator session key? All autonomous smart contract payouts will be blocked.")) return;
    try {
      await api.revokeAgent();
      loadSecurity();
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (!security) {
    return <div className="p-8 text-center text-slate-500">Loading Post-Quantum Security Centre...</div>;
  }

  const auth = security.authenticatorDetails;
  const isRevoked = auth.isRevoked;
  const isWindowOpen = auth.scopedEvmAuthWindow.isOpen && countdown > 0;

  const hours = Math.floor(countdown / 3600);
  const minutes = Math.floor((countdown % 3600) / 60);
  const seconds = countdown % 60;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Cryptographic & Smart-Account Security Centre</h1>
          <p className="text-sm text-slate-400">Post-Quantum ML-DSA-87 Attestation & Scoped Session Boundary Controls</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRotateKeys}
            disabled={isRotating}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 text-cyan-400 ${isRotating ? "animate-spin" : ""}`} />
            <span>Rotate ML-DSA-87 Keys</span>
          </button>

          <button
            onClick={handleRevokeAgent}
            disabled={isRevoked}
            className="px-3.5 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs flex items-center gap-2 transition-colors disabled:opacity-40"
          >
            <Ban className="w-3.5 h-3.5 text-rose-400" />
            <span>Revoke Authenticator</span>
          </button>
        </div>
      </div>

      {/* Revocation Alert Banner if revoked */}
      {isRevoked && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 flex items-center gap-3 text-xs">
          <ShieldAlert className="w-5 h-5 shrink-0 text-rose-400" />
          <div>
            <span className="font-bold block">Agent Authenticator Revoked</span>
            <span>All autonomous disbursement executions are halted by smart contract boundary guards.</span>
          </div>
        </div>
      )}

      {/* Grid: PQC Fingerprint & Authenticator Window */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Post-Quantum ML-DSA-87 Card */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-white font-semibold text-base">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
              <span>NIST FIPS 204 Lattice Cryptography</span>
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold">
              LEVEL 5
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Quantum-safe Module-Lattice Digital Signatures protecting all autonomous grant verdicts against Shore's algorithm and future quantum decoders.
          </p>

          <div className="space-y-3 font-mono text-xs">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
              <span className="text-slate-500 block text-[11px]">Active ML-DSA-87 Fingerprint</span>
              <span className="text-cyan-300 font-semibold break-all block">
                {security.publicKeyFingerprint}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                <span className="text-slate-500 block text-[11px]">Algorithm Standard</span>
                <span className="text-slate-200">ML-DSA-87 (Dilithium-5)</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                <span className="text-slate-500 block text-[11px]">Key Storage Security</span>
                <span className="text-emerald-400">AES-256-GCM Encrypted</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scoped EVM Authorization Window */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-white font-semibold text-base">
              <Clock className="w-5 h-5 text-blue-400" />
              <span>Scoped EVM Authorization Window</span>
            </span>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                isWindowOpen && !isRevoked
                  ? "bg-cyan-950 text-cyan-400 border border-cyan-800"
                  : "bg-rose-950 text-rose-400 border border-rose-800"
              }`}
            >
              {isRevoked ? "REVOKED" : isWindowOpen ? "OPEN & PERMITTED" : "EXPIRED"}
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Autonomous agent transactions require an active, time-bounded EVM session. When the window expires, all payment execution automatically stops.
          </p>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 block">Session Time Remaining</span>
              <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">
                {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
              </div>
            </div>

            <button
              onClick={handleExtendEvm}
              className="px-3.5 py-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-medium transition-colors"
            >
              + Extend 2 Hours
            </button>
          </div>

          <div className="text-[11px] text-slate-500 space-y-1">
            <p>Target Smart Contract: <span className="font-mono text-slate-300">{security.activeTargetVault}</span></p>
          </div>
        </div>
      </div>

      {/* Spending Rules & Smart Account Boundary Matrix */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Lock className="w-4 h-4 text-cyan-400" />
          <span>Chain-Enforced Smart-Account Spending Limits</span>
        </h3>
        <p className="text-xs text-slate-400">
          Enforced by QoreChain Account Abstraction logic on Diana Testnet. An autonomous agent attempting to transfer funds above these caps will trigger an immediate on-chain revert.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-xs text-slate-500">Max Single Tx Cap</span>
            <div className="text-xl font-bold font-mono text-white">
              {(Number(BigInt(auth.maxSpendPerTransaction)) / 1e18).toLocaleString()} QOR
            </div>
            <p className="text-[11px] text-slate-500">Per-disbursement ceiling</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-xs text-slate-500">Daily Agent Spending Limit</span>
            <div className="text-xl font-bold font-mono text-white">
              {(Number(BigInt(auth.dailySpendingLimit)) / 1e18).toLocaleString()} QOR
            </div>
            <p className="text-[11px] text-slate-500">24-hour cumulative cap</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-xs text-slate-500">Current Daily Spent</span>
            <div className="text-xl font-bold font-mono text-emerald-400">
              {(Number(BigInt(auth.currentDailySpent)) / 1e18).toLocaleString()} QOR
            </div>
            <p className="text-[11px] text-slate-500">Tracks against daily cap</p>
          </div>
        </div>
      </div>
    </div>
  );
};
