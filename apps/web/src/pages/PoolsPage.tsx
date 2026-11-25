import React, { useState, useEffect } from "react";
import { Plus, Layers, DollarSign, Shield, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { api } from "../services/api.js";
import { GrantPool } from "../types/index.js";
import { useWallet } from "../context/WalletContext.js";
import {
  createOnChainPool,
  depositOnChainPool,
  getConnectedWalletAddress,
} from "../services/walletTransactions.js";
import { parseEther } from "ethers";
import { useAuth } from "../context/AuthContext.js";

export const PoolsPage: React.FC = () => {
  const [pools, setPools] = useState<GrantPool[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [depositModalPool, setDepositModalPool] = useState<GrantPool | null>(null);
  const [depositAmount, setDepositAmount] = useState<string>("500");
  const { isDemoMode, isConnected, address, connectWallet } = useWallet();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "POST_QUANTUM_CRYPTO",
    totalBudgetQOR: 20000,
    maxGrantQOR: 3000,
    dailyCapQOR: 5000,
    eligibilityCriteria: "Open-source under MIT/Apache, NIST FIPS 204 compliant, Complete test vectors",
    requiredDocuments: "Technical Architecture Whitepaper, Resource Budget Breakdown, Proof of Milestone Delivery",
  });

  const loadPools = () => {
    api.getPools().then(setPools).catch(console.error);
  };

  useEffect(() => {
    loadPools();
  }, []);

  const handleCreatePool = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let walletAddress: string | undefined;
      if (!isDemoMode) {
        if (!isConnected) await connectWallet();
        walletAddress = address || (await getConnectedWalletAddress()) || undefined;
        if (!walletAddress) throw new Error("Connect QoreX before creating a live funding pool.");
      }
      const created = await api.createPool({
        ...formData,
        demoMode: isDemoMode,
        walletAddress,
        eligibilityCriteria: formData.eligibilityCriteria.split(",").map((s) => s.trim()),
        requiredDocuments: formData.requiredDocuments.split(",").map((s) => s.trim()),
      });
      if (!isDemoMode) {
        if (!created.fundingIntentId || !created.pendingInitialBudget) {
          throw new Error("The API did not return a pending funding intent for this pool.");
        }
        const submission = await createOnChainPool({
          onChainPoolId: created.onChainPoolId,
          title: created.title,
          category: created.category,
          totalBudgetBaseUnits: created.pendingInitialBudget,
          maxGrantBaseUnits: created.maxGrantPerApplicant,
          dailyCapBaseUnits: created.dailyCap,
        });
        const verified = await api.confirmPoolFunding(
          created.id,
          created.fundingIntentId,
          submission.txHash
        );
        if (verified.status !== "CONFIRMED") {
          alert("Pool creation is pending receipt verification. The pool will stay inactive until QoreChain confirms it.");
        }
      }
      setIsModalOpen(false);
      loadPools();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeposit = async () => {
    if (!depositModalPool) return;
    try {
      if (isDemoMode) {
        await api.depositPool(depositModalPool.id, Number(depositAmount), true);
      } else {
        if (!isConnected) await connectWallet();
        const walletAddress = address || (await getConnectedWalletAddress());
        if (!walletAddress) throw new Error("Connect QoreX before depositing into a live pool.");
        const intent = await api.createPoolFundingIntent(
          depositModalPool.id,
          Number(depositAmount),
          walletAddress
        );
        const submission = await depositOnChainPool(
          depositModalPool.onChainPoolId,
          parseEther(depositAmount).toString()
        );
        const verified = await api.confirmPoolFunding(
          depositModalPool.id,
          intent.intentId,
          submission.txHash
        );
        if (verified.status !== "CONFIRMED") {
          alert("Pool deposit is pending receipt verification. The displayed pool balance has not been increased.");
        }
      }
      setDepositModalPool(null);
      loadPools();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Microgrant Funding Pools</h1>
          <p className="text-sm text-slate-400">
            {isAdmin ? "Manage autonomous treasury vaults and budgets" : "Browse active funding opportunities"}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium text-xs hover:opacity-95 shadow-lg shadow-cyan-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Create Funding Pool</span>
          </button>
        )}
      </div>

      {/* Pools Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {pools.map((pool) => {
          const totalQor = Number(BigInt(pool.totalBudget) / 10n ** 18n);
          const remainingQor = Number(BigInt(pool.remainingBudget) / 10n ** 18n);
          const maxGrantQor = Number(BigInt(pool.maxGrantPerApplicant) / 10n ** 18n);
          const usedPct = Math.min(100, Math.round(((totalQor - remainingQor) / totalQor) * 100)) || 0;

          return (
            <div key={pool.id} className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                    {pool.category}
                  </span>
                  <h3 className="text-lg font-bold text-white mt-1.5">{pool.title}</h3>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => setDepositModalPool(pool)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 flex items-center gap-1 transition-colors"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Deposit Funds</span>
                  </button>
                )}
              </div>

              {pool.isSimulated && (
                <p className="rounded border border-amber-800/70 bg-amber-950/30 px-3 py-2 text-[11px] text-amber-200">
                  Demo pool — displayed balances are simulated and are not verified QoreChain funds.
                </p>
              )}
              {!pool.isActive && (
                <p className="rounded border border-cyan-900 bg-cyan-950/30 px-3 py-2 text-[11px] text-cyan-200">
                  {pool.creationStatus === "AWAITING_SUBMISSION"
                    ? "Waiting for the pool funding transaction to be submitted."
                    : "Pool remains inactive until its funding receipt is verified."}
                </p>
              )}

              <p className="text-xs text-slate-400 leading-relaxed">{pool.description}</p>

              {/* Budget Utilisation Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">Remaining Treasury</span>
                  <span className="text-white font-medium">{remainingQor.toLocaleString()} / {totalQor.toLocaleString()} QOR</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(5, usedPct)}%` }}
                  ></div>
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-3 pt-2 text-xs border-t border-slate-800/80">
                <div>
                  <span className="text-slate-500 block">Single Grant Ceiling</span>
                  <span className="text-slate-200 font-mono font-semibold">{maxGrantQor.toLocaleString()} QOR</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Smart Contract Target</span>
                  <span className="text-cyan-400 font-mono truncate block" title={pool.onChainPoolId}>
                    {pool.onChainPoolId.slice(0, 10)}...{pool.onChainPoolId.slice(-6)}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 border-t border-slate-800/80 pt-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Total deposited</span>
                  <span className="text-slate-200 font-mono">
                    {(Number(BigInt(pool.totalDeposited || "0")) / 1e18).toLocaleString()} QOR
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Total allocated</span>
                  <span className="text-blue-200 font-mono">
                    {(Number(BigInt(pool.totalAllocated || "0")) / 1e18).toLocaleString()} QOR
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Total distributed</span>
                  <span className="text-emerald-300 font-mono">
                    {(Number(BigInt(pool.totalDistributed || "0")) / 1e18).toLocaleString()} QOR
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Remaining balance</span>
                  <span className="text-slate-200 font-mono">
                    {(Number(BigInt(pool.remainingBalance || pool.remainingBudget || "0")) / 1e18).toLocaleString()} QOR
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Reserved</span>
                  <span className="text-amber-200 font-mono">
                    {(Number(BigInt(pool.reservedAmount || "0")) / 1e18).toLocaleString()} QOR
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Distributed utilization</span>
                  <span className="text-slate-200 font-mono">
                    {(pool.fundingUtilizationPercent || 0).toLocaleString()}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Applications</span>
                  <span className="text-slate-200 font-mono">{pool.numberOfApplications || 0}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Approved</span>
                  <span className="text-slate-200 font-mono">{pool.numberOfApprovedApplications || 0}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Funded</span>
                  <span className="text-slate-200 font-mono">{pool.numberOfFundedApplications || 0}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Pool status</span>
                  <span className={`font-mono ${pool.isActive ? "text-emerald-300" : "text-amber-200"}`}>
                    {pool.isActive ? "ACTIVE" : pool.creationStatus || "INACTIVE"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Pool Modal */}
      {isAdmin && isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-white">Create Autonomous Grant Pool</h2>
            <form onSubmit={handleCreatePool} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 block mb-1">Pool Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Description</label>
                <textarea
                  required
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100"
                ></textarea>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1">Budget (QOR)</label>
                  <input
                    type="number"
                    required
                    value={formData.totalBudgetQOR}
                    onChange={(e) => setFormData({ ...formData, totalBudgetQOR: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1">Max Grant (QOR)</label>
                  <input
                    type="number"
                    required
                    value={formData.maxGrantQOR}
                    onChange={(e) => setFormData({ ...formData, maxGrantQOR: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1">Daily Cap (QOR)</label>
                  <input
                    type="number"
                    required
                    value={formData.dailyCapQOR}
                    onChange={(e) => setFormData({ ...formData, dailyCapQOR: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold"
                >
                  Create Pool
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deposit Modal */}
      {isAdmin && depositModalPool && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-white">Deposit Testnet QOR</h3>
            <p className="text-xs text-slate-400">Funding pool: {depositModalPool.title}</p>
            <div>
              <label className="text-slate-300 text-xs block mb-1">Deposit Amount (QOR)</label>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100 text-sm font-mono"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDepositModalPool(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleDeposit}
                className="px-4 py-1.5 rounded-lg bg-cyan-500 text-slate-950 font-semibold text-xs"
              >
                Deposit QOR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
