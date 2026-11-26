import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shield, Wallet, ExternalLink, Activity, LogOut, Menu, X } from "lucide-react";
import { useWallet } from "../context/WalletContext.js";
import { useAuth } from "../context/AuthContext.js";

interface NavbarProps {
  mobileNavOpen: boolean;
  onToggleMobileNav: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ mobileNavOpen, onToggleMobileNav }) => {
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
    <header className="relative min-h-14 sm:h-16 border-b border-slate-800 bg-[#070b14]/90 backdrop-blur-md sticky top-0 z-40 px-3 sm:px-6 py-2 flex flex-nowrap items-center justify-between gap-2">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <Link to="/" className="flex min-w-0 items-center gap-2 sm:gap-2.5 group">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="font-bold text-sm sm:text-base tracking-tight text-white">QORE<span className="text-cyan-400">SENTINEL</span></span>
              <span className="hidden sm:inline text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-semibold">FIPS 204</span>
            </div>
            <p className="hidden sm:block text-[10px] text-slate-400 leading-none">Autonomous Post-Quantum Microgrants</p>
          </div>
        </Link>
      </div>

      {/* Network & Actions */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-4">
        <button
          type="button"
          onClick={onToggleMobileNav}
          aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileNavOpen}
          aria-controls="mobile-navigation"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 md:hidden"
        >
          {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
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
          className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            isDemoMode
              ? "bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20"
              : "bg-cyan-500/10 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/20"
          }`}
          title="Toggle between demo simulation and live wallet execution"
        >
          <Activity className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{isDemoMode ? "Mode: Demo Sandbox" : "Mode: Live Wallet"}</span>
          <span className="sm:hidden">{isDemoMode ? "Demo" : "Live"}</span>
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
          <div className="hidden md:flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5">
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
            className="hidden md:flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5"
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
          <div className="hidden md:flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleConnect(connectWallet)}
                disabled={connecting}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 font-medium text-xs hover:bg-slate-700 transition-all"
              >
                <Wallet className="w-4 h-4" />
                <span className="hidden sm:inline">{connecting ? "Connecting..." : "Connect EVM"}</span>
                <span className="sm:hidden">{connecting ? "..." : "Connect"}</span>
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
          <Link to="/login" className="hidden md:inline-flex rounded-lg border border-cyan-700/60 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-950/50">
            Sign in
          </Link>
        )}
      </div>
      {mobileNavOpen && (
        <div className="absolute left-0 right-0 top-full flex items-center gap-2 border-b border-slate-800 bg-[#070b14]/95 px-3 py-2 shadow-lg backdrop-blur-md md:hidden">
          <button
            type="button"
            onClick={toggleDemoMode}
            className={`inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] font-medium transition-colors ${
              isDemoMode
                ? "bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20"
                : "bg-cyan-500/10 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/20"
            }`}
          >
            <Activity className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{isDemoMode ? "Mode: Demo Sandbox" : "Mode: Live Wallet"}</span>
          </button>
          {(!isConnected || !address) && (
            <button
              type="button"
              onClick={() => handleConnect(connectWallet)}
              disabled={connecting}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-2 text-[11px] font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50"
            >
              <Wallet className="h-3.5 w-3.5" />
              <span>{connecting ? "Connecting..." : "Connect EVM"}</span>
            </button>
          )}
          {!user && (
            <Link to="/login" className="inline-flex shrink-0 items-center justify-center rounded-lg border border-cyan-700/60 px-2.5 py-2 text-[11px] font-medium text-cyan-300 hover:bg-cyan-950/50">
              Sign in
            </Link>
          )}
          {connectionError && <p role="alert" className="w-full text-xs text-rose-300">{connectionError}</p>}
        </div>
      )}
      {authError && <p role="alert" className="absolute right-4 top-16 text-xs text-rose-300">{authError}</p>}
    </header>
  );
};
