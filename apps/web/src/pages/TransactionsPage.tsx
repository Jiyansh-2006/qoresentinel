import React, { useState, useEffect } from "react";
import { Receipt, ExternalLink, ShieldCheck, CheckCircle2, Clock } from "lucide-react";
import { api } from "../services/api.js";
import { useWallet } from "../context/WalletContext.js";
import { sendQorTransfer } from "../services/walletTransactions.js";

export const TransactionsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("0.1");
  const [isSending, setIsSending] = useState(false);
  const [balanceRefreshError, setBalanceRefreshError] = useState<string | null>(null);
  const {
    isConnected,
    nativeConnected,
    address,
    nativeAddress,
    nativeNetwork,
    nativeChainId,
    nativeBalanceError,
    connectNativeWallet,
    refreshWalletData,
  } = useWallet();

  useEffect(() => {
    api.getTransactions()
      .then((data) => {
        setTransactions(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handleTransfer = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSending(true);
    setBalanceRefreshError(null);
    try {
      if (!nativeConnected) await connectNativeWallet();
      const transfer = await sendQorTransfer(recipient, amount, nativeChainId);
      try {
        await refreshWalletData();
      } catch (refreshError) {
        setBalanceRefreshError(
          `Transfer submitted, but wallet refresh failed: ${
            refreshError instanceof Error
              ? refreshError.message
              : "Unknown wallet refresh error."
          }`
        );
      }
      setRecipient("");
      setAmount("0.1");

      try {
        await api.recordWalletTransfer({
          txHash: transfer.txHash,
          blockNumber: transfer.blockNumber,
          fromAddress: transfer.fromAddress,
          toAddress: transfer.toAddress,
          amountBaseUnits: transfer.amountBaseUnits,
          amountDecimals: transfer.amountDecimals,
          amountDenom: transfer.amountDenom,
          chainId: transfer.chainId,
        });
        const data = await api.getTransactions();
        setTransactions(data);
      } catch (recordError: any) {
        alert(
          `QoreX sent the transfer, but QoreSentinel could not update its local history. Transaction: ${transfer.txHash}. ${recordError.message || ""}`
        );
      }
    } catch (error: any) {
      alert(error.message || "QOR transfer failed");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Blockchain Transaction Explorer</h1>
        <p className="text-sm text-slate-400">
          {nativeConnected
            ? `Native QOR transfers on ${nativeNetwork}`
            : isConnected
              ? "Connect the QoreX native account before sending native QOR"
              : "Connect QoreX to view the native wallet network"}
        </p>
      </div>

      <form onSubmit={handleTransfer} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-3 items-end">
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Recipient QoreChain address</label>
          <input
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            placeholder="qor1..."
            required
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2.5 text-sm font-mono text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Amount (QOR, 6 decimals)</label>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            type="number"
            min="0.000001"
            step="any"
            required
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2.5 text-sm font-mono text-white"
          />
        </div>
        <button
          type="submit"
          disabled={isSending}
          className="rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 px-5 py-2.5 text-sm font-semibold"
        >
          {isSending ? "Confirm in QoreX..." : "Send QOR"}
        </button>
        {nativeConnected && (
          <p className="md:col-span-3 text-[11px] text-slate-500 font-mono">
            From QoreX native account: {nativeAddress || "not available"}
            {address ? ` · EVM account ${address}` : ""}
          </p>
        )}
      </form>
      {(balanceRefreshError || nativeBalanceError) && (
        <p role="alert" className="text-xs text-amber-300">
          {balanceRefreshError || nativeBalanceError}
        </p>
      )}
      <p className="text-xs text-slate-500">
        Native transfers request {nativeNetwork} (chain {nativeChainId}) and are sent from the connected QoreX account. Set QoreX itself to the same network before sending; QoreSentinel cannot switch the extension’s active network. Testnet and mainnet balances are separate.
      </p>
      <p className="text-xs text-slate-500">
        For your phone, open this app in QoreX’s dApp browser using an HTTPS URL reachable from the phone; a desktop localhost URL is not accessible there.
      </p>

      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-medium">
                <th className="pb-3">Transaction Hash</th>
                <th className="pb-3">Recipient Beneficiary</th>
                <th className="pb-3">Disbursed Amount</th>
                <th className="pb-3">Block</th>
                <th className="pb-3">Execution Mode</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Explorer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                    No transactions executed yet.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const statusLabel = tx.status === "CONFIRMED"
                    ? "Receipt verified"
                    : tx.status === "PENDING"
                      ? "Awaiting verification"
                      : tx.status === "FAILED"
                        ? "Reverted"
                        : tx.status === "RECONCILIATION_REQUIRED"
                          ? "Needs reconciliation"
                          : tx.status === "REPORTED"
                            ? "Wallet-reported · unverified"
                            : tx.status;
                  const statusColor = tx.status === "CONFIRMED"
                    ? "text-emerald-400"
                    : tx.status === "FAILED" || tx.status === "RECONCILIATION_REQUIRED"
                      ? "text-rose-300"
                      : "text-amber-300";
                  return (
                  <tr key={tx.id} className="hover:bg-slate-950/40">
                    <td className="py-3 text-cyan-300 font-semibold truncate max-w-[180px]">
                      {tx.txHash || "—"}
                    </td>
                    <td className="py-3 text-slate-300 truncate max-w-[140px]">
                      {tx.toAddress}
                    </td>
                    <td className={`py-3 font-medium ${tx.status === "CONFIRMED" ? "text-emerald-400" : "text-slate-300"}`}>
                      {(Number(tx.amount) / 10 ** (tx.amountDecimals ?? 18)).toLocaleString()} QOR
                    </td>
                    <td className="py-3 text-slate-400">#{tx.blockNumber}</td>
                    <td className="py-3 font-sans">
                      {tx.isSimulated ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">
                          Demo Simulated
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                          {tx.network || "Live"}
                        </span>
                      )}
                    </td>
                    <td className="py-3 font-sans">
                      <span className={`inline-flex items-center gap-1 ${statusColor}`}>
                        {tx.status === "CONFIRMED"
                          ? <CheckCircle2 className="w-3.5 h-3.5" />
                          : <Clock className="w-3.5 h-3.5" />}
                        <span>{statusLabel}</span>
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <a
                        href={tx.explorerUrl || `https://explore.qore.network/tx/${encodeURIComponent(tx.txHash)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-sans"
                      >
                        <span>View</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
