import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createSvmClient } from "@qorechain/svm";
import { QoreChainProvider, usePqcStatus } from "@qorechain/react";
import { Activity, ExternalLink, ShieldCheck } from "lucide-react";

interface Props {
  nativeAddress: string | null;
  nativeChainId: number;
}

const REST_BY_EVM_CHAIN: Record<number, string> = {
  9800: "https://api-testnet.qore.host",
  9801: "https://api.qore.host",
};

const SVM_RPC_BY_EVM_CHAIN: Record<number, string> = {
  9800: "https://svm-testnet.qore.host",
  9801: "https://svm.qore.host",
};

function QoreChainStatusContent({ nativeAddress, nativeChainId }: Props) {
  const rest = REST_BY_EVM_CHAIN[nativeChainId] ?? REST_BY_EVM_CHAIN[9800];
  const svmRpc = SVM_RPC_BY_EVM_CHAIN[nativeChainId] ?? SVM_RPC_BY_EVM_CHAIN[9800];
  const pqc = usePqcStatus(nativeAddress ?? undefined, {
    enabled: Boolean(nativeAddress),
    refreshInterval: 30_000,
  });
  const [svmSlot, setSvmSlot] = useState<number | null>(null);
  const [svmError, setSvmError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const client = createSvmClient({ rpcUrl: svmRpc });
    const refreshSlot = async () => {
      try {
        const slot = await client.connection.getSlot("confirmed");
        if (active) {
          setSvmSlot(slot);
          setSvmError(null);
        }
      } catch (error) {
        if (active) {
          setSvmError(error instanceof Error ? error.message : "SVM endpoint is unavailable.");
        }
      }
    };

    setSvmSlot(null);
    void refreshSlot();
    const timer = window.setInterval(() => void refreshSlot(), 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [svmRpc]);

  return (
    <section className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 md:grid-cols-2">
      <div className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <ShieldCheck className="h-4 w-4 text-cyan-400" />
          QoreX PQC key and proof of possession
        </h3>
        {!nativeAddress ? (
          <p className="text-xs leading-relaxed text-slate-400">
            Connect your QoreX native account to check its ML-DSA-87 key on {nativeChainId === 9801 ? "Mainnet" : "Diana Testnet"}.
          </p>
        ) : pqc.isLoading && !pqc.data ? (
          <p className="text-xs text-slate-400">Reading the registered key from QoreChain…</p>
        ) : pqc.error ? (
          <p role="status" className="text-xs text-amber-300">
            The network status could not be confirmed: {pqc.error.message}
          </p>
        ) : pqc.isRegistered ? (
          <div className="space-y-2 text-xs">
            <p className="text-emerald-300">ML-DSA-87 key is registered for this account.</p>
            {pqc.data?.possessionProven === true ? (
              <p className="text-emerald-300">Proof of possession is confirmed on chain.</p>
            ) : pqc.data?.possessionProven === false ? (
              <p className="text-amber-300">This key is registered, but the chain does not record proof of possession for it.</p>
            ) : (
              <p className="text-amber-300">The connected network did not report proof-of-possession status.</p>
            )}
          </div>
        ) : (
          <div className="space-y-2 text-xs">
            <p className="text-amber-300">No ML-DSA-87 key is registered for this account yet.</p>
            <p className="text-slate-400">QoreX can register the key with proof of possession when you approve your first native transaction.</p>
            <Link to="/transactions" className="inline-flex items-center gap-1 font-medium text-cyan-300 hover:text-cyan-200">
              Open native transfers <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        )}
        {nativeAddress && (
          <p className="break-all font-mono text-[10px] text-slate-500">{nativeAddress}</p>
        )}
        <p className="text-[10px] text-slate-600">Status source: {rest}</p>
      </div>

      <div className="space-y-3 border-t border-slate-800 pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Activity className="h-4 w-4 text-violet-400" />
          QoreChain SVM adapter
        </h3>
        <div className="flex items-center gap-2">
          <span className="rounded border border-amber-700/60 bg-amber-950/40 px-2 py-1 text-[10px] font-bold text-amber-300">READ ONLY</span>
          <span className="text-xs text-slate-400">Public SVM transaction submission is disabled.</span>
        </div>
        {svmError ? (
          <p className="text-xs text-slate-500">SVM endpoint unavailable: {svmError}</p>
        ) : (
          <p className="text-xs text-slate-400">
            {svmSlot === null ? "Checking the public SVM endpoint…" : `Latest confirmed slot: ${svmSlot.toLocaleString()}`}
          </p>
        )}
        <p className="break-all font-mono text-[10px] text-slate-600">{svmRpc}</p>
      </div>
    </section>
  );
}

export function QoreChainIntegrationStatus(props: Props) {
  return (
    <QoreChainProvider config={{ network: props.nativeChainId === 9801 ? "mainnet" : "testnet" }}>
      <QoreChainStatusContent {...props} />
    </QoreChainProvider>
  );
}
