import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shield, Wallet, ExternalLink, Activity, LogOut } from "lucide-react";
import { useWallet } from "../context/WalletContext.js";
import { useAuth } from "../context/AuthContext.js";

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const {
    isConnected,
    nativeConnected,
    address,
    nativeAddress,
    balance,
    network,
    chainId,
    nativeNetwork,
    nativeChainId,
    isDemoMode,
    toggleDemoMode,
    connectWallet,
  } = useWallet();
  const hasEvmWallet = isConnected && Boolean(address);
  const hasWallet = hasEvmWallet || nativeConnected;
  const activeNetwork = nativeConnected ? nativeNetwork : network;
  const activeChainId = nativeConnected ? nativeChainId : chainId;
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleConnect = async (connect: () => Promise<void>) => {
    if (connecting) return;
    setConnecting(true);
    setConnectionError(null);
    try {
      await connect();
    } catch (error: any) {
      setConnectionError(error.message || "Wallet connection failed.");
    } finally {
      setConnecting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/", { replace: true });
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Sign out failed.");
    }
  };

  return (
    <header className="h-16 border-b border-slate-800 bg-[#070b14]/80 backdrop-blur-md sticky top-0 z-40 px-6 flex items-center justify-between">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base tracking-tight text-white">QORE<span className="text-cyan-400">SENTINEL</span></span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-semibold">FIPS 204</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-none">Autonomous Post-Quantum Microgrants</p>
          </div>
        </Link>
      </div>

      {/* Network & Actions */}
      <div className="flex items-center gap-4">
        {/* Network Badge */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs">
          <span className={`w-2 h-2 rounded-full ${hasWallet ? "bg-emerald-400" : "bg-slate-500"}`}></span>
          <span className="text-slate-300 font-medium">
            {hasWallet ? activeNetwork : "No wallet connected"}
          </span>
          {hasWallet && (
            <span className="text-slate-500 font-mono text-[11px]">({activeChainId})</span>
          )}
        </div>

        {/* Demo Mode Toggle */}
        <button
          onClick={toggleDemoMode}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            isDemoMode
              ? "bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20"
              : "bg-cyan-500/10 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/20"
          }`}
          title="Toggle between demo simulation and live wallet execution"
        >
          <Activity className="w-3.5 h-3.5" />
          <span>{isDemoMode ? "Mode: Demo Sandbox" : "Mode: Live Wallet"}</span>
        </button>

        {/* Faucet Link */}
        <a
          href="https://dashboard.qorechain.io/faucet"
          target="_blank"
          rel="noreferrer"
          className={
            hasWallet && activeChainId !== 9800
              ? "hidden"
              : "hidden lg:flex items-center gap-1 text-xs text-slate-400 hover:text-cyan-400 transition-colors"
          }
        >
          <span>Faucet</span>
          <ExternalLink className="w-3 h-3" />
        </a>

        {/* Connect Wallet */}
        {isConnected && address ? (
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5">
            <Wallet className="w-4 h-4 text-cyan-400" />
            <div
              className="text-left text-xs"
              title={`QoreX native: ${nativeAddress || "unavailable"}\nEVM: ${address}`}
            >
              <span className="block font-mono text-slate-200">
                {nativeAddress
                  ? `${nativeAddress.slice(0, 10)}...${nativeAddress.slice(-6)}`
                  : `EVM ${address.slice(0, 6)}...${address.slice(-4)}`}
              </span>
              <span className="hidden sm:block text-slate-400 text-[10px]">
                {nativeAddress
                  ? `EVM ${address.slice(0, 6)}...${address.slice(-4)} · ${balance}`
                  : balance}
              </span>
            </div>
          </div>
        ) : nativeConnected && nativeAddress ? (
          <div
            className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5"
            title={`QoreX native account: ${nativeAddress}`}
          >
            <Wallet className="w-4 h-4 text-cyan-400" />
            <div className="text-left text-xs">
              <span className="block font-mono text-slate-200">
                {nativeAddress.slice(0, 10)}...{nativeAddress.slice(-6)}
              </span>
              <span className="hidden sm:block text-slate-400 text-[10px]">
                Native QoreX · {nativeNetwork}
              </span>
            </div>
          </div>
        ) : null}
        {(!isConnected || !address) && (
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleConnect(connectWallet)}
                disabled={connecting}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 font-medium text-xs hover:bg-slate-700 transition-all"
              >
                <Wallet className="w-4 h-4" />
                <span>{connecting ? "Connecting..." : "Connect EVM"}</span>
              </button>
            </div>
            {connectionError && (
              <p role="alert" className="max-w-sm text-right text-[11px] text-rose-300">
                {connectionError}
              </p>
            )}
          </div>
        )}
        {user ? (
          <div className="flex items-center gap-2 border-l border-slate-800 pl-3">
            <div className="hidden text-right sm:block">
              <span className="block max-w-36 truncate text-xs font-medium text-slate-200">{user.fullName}</span>
              <span className="text-[10px] uppercase tracking-wide text-cyan-400">{user.role.toLowerCase()}</span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Sign out"
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        ) : (
          <Link to="/login" className="rounded-lg border border-cyan-700/60 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-950/50">
            Sign in
          </Link>
        )}
      </div>
      {authError && <p role="alert" className="absolute right-4 top-16 text-xs text-rose-300">{authError}</p>}
    </header>
  );
};
