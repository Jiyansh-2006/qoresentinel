import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  Activity,
  Wallet,
  RefreshCw,
} from "lucide-react";
import { api } from "../services/api.js";
import { DashboardStats } from "../types/index.js";
import { useWallet } from "../context/WalletContext.js";
import { useAuth } from "../context/AuthContext.js";

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const {
    isConnected,
    nativeConnected,
    address,
    nativeAddress,
    network,
    chainId,
    nativeNetwork,
    nativeChainId,
    nativeBalance,
    nativeBalanceLoading,
    nativeBalanceError,
    connectNativeWallet,
    selectNativeNetwork,
    refreshWalletData,
  } = useWallet();

  const handleSignerAction = async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      if (nativeConnected) {
        await refreshWalletData();
      } else {
        await connectNativeWallet();
      }
    } catch (error) {
      setRefreshError(
        error instanceof Error ? error.message : "QoreX wallet request failed."
      );
    } finally {
      setRefreshing(false);
    }
  };

  const formatNativeBalance = (baseUnits: string | null): string | null => {
    if (baseUnits === null) return null;
    try {
      const units = BigInt(baseUnits);
      const divisor = 1_000_000n;
      const whole = (units / divisor).toLocaleString();
      const fractional = (units % divisor)
        .toString()
        .padStart(6, "0")
        .replace(/0+$/, "");
      return fractional ? `${whole}.${fractional}` : whole;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (!user?.role) return;
    let firstLoad = true;
    const refreshStats = () => {
      api.getStats(user.role)
        .then((data) => {
          setStats(data);
          setLoading(false);
          firstLoad = false;
        })
        .catch((err) => {
          console.error("Dashboard fetch failed", err);
          if (firstLoad) {
            setStatsError("Platform records could not be loaded.");
            setLoading(false);
          }
        });
    };

    refreshStats();
    const events = new EventSource(api.getDashboardStreamUrl(user.role), { withCredentials: true });
    events.addEventListener("update", refreshStats);
    return () => events.close();
  }, [user?.role]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-800 rounded w-1/4"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-900 rounded-xl border border-slate-800"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div role="alert" className="rounded-xl border border-rose-900 bg-rose-950/30 p-5 text-sm text-rose-200">
        {statsError || "Dashboard data is unavailable. Please retry."}
      </div>
    );
  }

  const overviewCards = user?.role === "STUDENT"
    ? [
        { label: "Total applications", value: stats.totalApplications, suffix: "", detail: "Your submissions" },
        { label: "Under review", value: stats.applicationsUnderReview, suffix: "", detail: "Awaiting a decision" },
        { label: "Approved", value: stats.approvedApplications, suffix: "", detail: "Approved, not necessarily paid" },
        { label: "Rejected", value: stats.rejectedApplications, suffix: "", detail: "Your applications" },
        { label: "Funded", value: stats.fundedApplications, suffix: "", detail: "At least one verified payment" },
        { label: "Requested", value: stats.totalRequestedQOR, suffix: " QOR", detail: "Across your applications" },
        { label: "Approved amount", value: stats.totalApprovedQOR, suffix: " QOR", detail: "May differ from amount received" },
        { label: "Received", value: stats.totalReceivedQOR, suffix: " QOR", detail: "Verified GrantVault payments only" },
      ]
    : [
        { label: "Funding across pools", value: stats.totalFundingAcrossPoolsQOR, suffix: " QOR", detail: "Verified, non-demo pools" },
        { label: "Funds deposited", value: stats.totalFundsDepositedQOR, suffix: " QOR", detail: "Confirmed pool funding" },
        { label: "Grants distributed", value: stats.totalDisbursedQOR, suffix: " QOR", detail: "Receipt-verified GrantReleased events" },
        { label: "Remaining funds", value: stats.remainingFundsQOR, suffix: " QOR", detail: "Excludes simulated pools" },
        { label: "Funding pools", value: stats.totalPools, suffix: "", detail: `${stats.activeFundingPools} verified active pools` },
        { label: "Applications", value: stats.totalApplications, suffix: "", detail: "All platform records" },
        { label: "Pending", value: stats.pendingApplications, suffix: "", detail: "Awaiting review" },
        { label: "Approved", value: stats.approvedApplications, suffix: "", detail: "Approval is not payment" },
        { label: "Funded", value: stats.fundedApplications, suffix: "", detail: "At least one verified payment" },
        { label: "Rejected", value: stats.rejectedApplications, suffix: "", detail: "Policy or review outcome" },
        { label: "Failed transactions", value: stats.failedTransactions, suffix: "", detail: "Reverted on-chain transactions" },
        { label: "Payments pending", value: stats.pendingDisbursements, suffix: "", detail: "Submitted; not counted as distributed" },
        { label: "Pools to reconcile", value: stats.poolsRequiringReconciliation, suffix: "", detail: "Verified payouts exceeded the local balance" },
      ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {user?.role === "ADMIN" ? "Administrator Dashboard" : "Student Dashboard"}
          </h1>
          <p className="text-sm text-slate-400">
            {user?.role === "STUDENT"
              ? "Track your grant applications and connect your QoreX wallet when needed."
              : nativeConnected
              ? `QoreX account: ${nativeNetwork} (chain ${nativeChainId})`
              : "Connect the QoreX account imported from the Dashboard"}
            {isConnected ? ` · EVM: ${network} (${chainId})` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/applications"
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium text-xs hover:opacity-95 shadow-md shadow-cyan-500/20"
          >
            {user?.role === "STUDENT" ? "My Applications" : "Review Grant Applications"}
          </Link>
        </div>
      </div>

      <section className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Wallet className="w-4 h-4 text-cyan-400" />
            QoreX native wallet account
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-slate-400">
              Network
              <select
                value={nativeChainId}
                onChange={(event) => selectNativeNetwork(Number(event.target.value))}
                disabled={refreshing || nativeBalanceLoading}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
              >
                <option value={9800}>Diana Testnet</option>
                <option value={9801}>Mainnet</option>
              </select>
            </label>
            <button
              type="button"
              onClick={handleSignerAction}
              disabled={refreshing || nativeBalanceLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              {nativeConnected ? (
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              ) : (
                <Wallet className="w-3.5 h-3.5" />
              )}
              {refreshing
                ? "Connecting..."
                : nativeConnected
                  ? "Refresh account"
                  : "Connect QoreX account"}
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Set the same network in QoreX. This selector only sets QoreSentinel’s requested network; the extension controls its own active network.
        </p>
        {nativeConnected ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                Live native QOR balance · {nativeNetwork}
              </p>
              <p className="mt-1 text-2xl font-bold font-mono text-emerald-400">
                {nativeBalanceLoading
                  ? "Checking chain…"
                  : formatNativeBalance(nativeBalance) !== null
                    ? `${formatNativeBalance(nativeBalance)} QOR`
                    : "Unavailable"}
              </p>
              {nativeBalanceError && (
                <p role="alert" className="mt-1 text-xs text-rose-300">
                  {nativeBalanceError}
                </p>
              )}
            </div>
            <div className="space-y-2 text-xs">
              <div>
                <p className="text-slate-500">Connected QoreX native address</p>
                <p className="break-all font-mono text-slate-200">{nativeAddress}</p>
              </div>
              <p className="text-slate-400">
                Native transfers will be signed by this account. Confirm it matches the Dashboard account you imported.
              </p>
              {isConnected && (
                <p className="text-slate-400">
                  Separate EVM contract account: <span className="font-mono text-slate-300">{address}</span>
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-slate-400">
              To use a Dashboard-created account, import its recovery phrase inside the official QoreX wallet—not here—then select the matching account and connect. In QoreX, use Wallets → Add/Restore, then Your accounts → Add an Ethereum account (coin 60) if the Dashboard account was created from an Ethereum-style phrase. Select Diana Testnet before connecting.
            </p>
            <p className="text-xs text-amber-200">
              Never enter your recovery phrase in QoreSentinel or share it in chat. The Dashboard’s “Connect with QoreX” bridge works only on dashboard.qorechain.io; this app connects through QoreX’s standard dApp provider.
            </p>
            {refreshError && (
              <p role="alert" className="text-xs text-rose-300">
                {refreshError}
              </p>
            )}
          </div>
        )}
      </section>

      <p className="rounded-lg border border-amber-900/70 bg-amber-950/30 px-4 py-3 text-xs text-amber-200">
        Only successful GrantVault receipts with a matching pool, application, recipient, amount, and GrantReleased event count as distributed. Demo pool balances are excluded from live financial totals.
      </p>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {overviewCards.map((card) => (
          <div key={card.label} className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>{card.label}</span>
              <Activity className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {typeof card.value === "number" ? card.value.toLocaleString() : card.value}
              <span className="text-sm text-cyan-400 font-sans">{card.suffix}</span>
            </div>
            <p className="text-xs text-slate-500">{card.detail}</p>
          </div>
        ))}
      </div>

      {/* Grid: Recorded Transactions & Audit Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent recorded transactions */}
        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>Verified Grant Payments</span>
            </h3>
            <Link to="/transactions" className="text-xs text-cyan-400 hover:underline flex items-center gap-1">
              <span>View all</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-3">
            {stats.recentTransactions.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                No verified grant payments are available yet. Pending, simulated, and user-reported wallet transfers are not counted as paid grants.
              </p>
            ) : (
              stats.recentTransactions.map((tx: any) => (
                <div key={tx.id} className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-cyan-300 font-medium">
                        {tx.txHash.slice(0, 10)}...{tx.txHash.slice(-8)}
                      </span>
                    </div>
                    <p className="text-slate-400">
                      To: <span className="font-mono text-slate-300">{tx.toAddress.slice(0, 8)}...</span>
                    </p>
                  </div>

                  <div className="text-right space-y-1">
                    <span className="text-emerald-400 font-mono font-medium block">
                      {(Number(tx.amount) / 10 ** (tx.amountDecimals ?? 18)).toLocaleString()} QOR
                    </span>
                    <a
                      href={tx.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-cyan-400"
                    >
                      <span>Explorer</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Audit Events */}
        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              <span>{user?.role === "STUDENT" ? "Your Recent Activity" : "Immutable Audit Trail"}</span>
            </h3>
            {user?.role === "ADMIN" && (
              <Link to="/audit" className="text-xs text-cyan-400 hover:underline flex items-center gap-1">
                <span>View all</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>

          <div className="space-y-3">
            {stats.recentAuditLogs.map((log: any) => (
              <div key={log.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-200">{log.action}</span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-xs text-slate-400 truncate">{log.details}</p>
                <div className="text-[10px] font-mono text-slate-600 truncate">
                  Hash: {log.recordHash}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
