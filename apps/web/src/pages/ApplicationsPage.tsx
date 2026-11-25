import React, { useState, useEffect } from "react";
import {
  FileText,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Shield,
  Layers,
  ChevronRight,
  AlertTriangle,
  ExternalLink,
  Plus,
} from "lucide-react";
import { api } from "../services/api.js";
import { GrantApplication } from "../types/index.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { useWallet } from "../context/WalletContext.js";
import { executeApprovedGrantWalletTransaction, getConnectedWalletAddress } from "../services/walletTransactions.js";
import { useAuth } from "../context/AuthContext.js";
import { GrantPool } from "../types/index.js";

export const ApplicationsPage: React.FC = () => {
  const [applications, setApplications] = useState<GrantApplication[]>([]);
  const [selectedApp, setSelectedApp] = useState<GrantApplication | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [pools, setPools] = useState<GrantPool[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [supportingFile, setSupportingFile] = useState<File | null>(null);
  const [applicationForm, setApplicationForm] = useState({
    poolId: "",
    projectTitle: "",
    projectDescription: "",
    requestedAmountQOR: "",
    beneficiaryWalletAddress: "",
  });
  const { isDemoMode, isConnected, address, connectWallet } = useWallet();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const loadApplications = () => {
    api.getApplications()
      .then((data) => {
        setApplications(data);
        if (data.length > 0 && !selectedApp) {
          setSelectedApp(data[0]);
        }
      })
      .catch(console.error);
  };

  const loadPools = () => {
    api.getPools()
      .then((data) => {
        setPools(data);
        setApplicationForm((current) => ({
          ...current,
          poolId: current.poolId || data[0]?.id || "",
        }));
      })
      .catch(console.error);
  };

  useEffect(() => {
    loadApplications();
    loadPools();
  }, []);

  const handleSeedDemo = async () => {
    try {
      await api.seedDemoApplications();
      loadApplications();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRunAnalysis = async (appId: string) => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    try {
      let walletAddress = address || undefined;
      if (!isDemoMode && !isConnected) {
        await connectWallet();
        walletAddress = (await getConnectedWalletAddress()) || undefined;
      }
      const res = await api.runAgentAnalysis(appId, isDemoMode, walletAddress);

      if (!isDemoMode && res.decision?.finalDecision === "APPROVED") {
        if (!walletAddress) throw new Error("Connect QoreX before executing the live grant");
        const pools = await api.getPools();
        const pool = pools.find((item) => item.id === res.application.poolId);
        if (!pool) throw new Error("The local grant pool record could not be found");

        const paymentIntent = await api.createWalletExecutionIntent(appId, walletAddress);
        const execution = await executeApprovedGrantWalletTransaction({
          applicationId: res.application.id,
          poolId: pool.onChainPoolId,
          beneficiary: res.application.beneficiaryWalletAddress,
          approvedAmountBaseUnits: res.decision.canonicalPayload.approvedAmountBaseUnits,
          milestonePercentages: res.application.milestones.map((milestone: any) => milestone.percentage),
          milestoneIndex: paymentIntent.intent.milestoneIndex,
          evidenceRootHash: res.decision.canonicalPayload.evidenceRootHash,
          decisionPayload: res.decision.canonicalPayload,
        });

        const recorded = await api.recordWalletExecution(appId, {
          intentId: paymentIntent.intentId,
          txHash: execution.releaseTxHash,
        });
        setAnalysisResult({ ...res, transactionResult: {
          success: recorded.status === "CONFIRMED",
          txHash: execution.releaseTxHash,
          blockNumber: recorded.transaction?.blockNumber || execution.blockNumber,
          gasUsed: recorded.transaction?.gasUsed || execution.gasUsed,
          status: recorded.status || "PENDING",
          verificationError: recorded.error,
          isSimulated: false,
          network: "QoreChain Diana Testnet",
        } });
        loadApplications();
        if (recorded.application) setSelectedApp(recorded.application);
      } else {
      setAnalysisResult(res);
      loadApplications();
      if (selectedApp && selectedApp.id === appId) {
        setSelectedApp(res.application);
      }
      }
    } catch (err: any) {
      alert(`Analysis failed: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmitApplication = async (event: React.FormEvent) => {
    event.preventDefault();
    const selectedPool = pools.find((pool) => pool.id === applicationForm.poolId);
    if (!selectedPool || !supportingFile) {
      setSubmitError("Choose an active funding pool and attach a supporting document.");
      return;
    }
    if (supportingFile.size > 8 * 1024 * 1024) {
      setSubmitError("The supporting document must be 8 MB or smaller.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const bytes = new Uint8Array(await supportingFile.arrayBuffer());
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }
      const requestedAmountQOR = Number(applicationForm.requestedAmountQOR);
      const created = await api.submitApplication({
        ...applicationForm,
        requestedAmountQOR,
        category: selectedPool.category,
        budgetBreakdown: [{
          item: "Project implementation",
          percentage: 100,
          amountQOR: requestedAmountQOR,
          description: "Applicant-provided total project budget",
        }],
        milestones: [
          { title: "Milestone 1: Initial delivery", description: "Complete the core project implementation and provide initial deliverables.", percentage: 40, expectedDeliveryWeeks: 3 },
          { title: "Milestone 2: Testing", description: "Complete testing, review, and resolve critical delivery issues.", percentage: 30, expectedDeliveryWeeks: 3 },
          { title: "Milestone 3: Final release", description: "Publish the final release, documentation, and completion evidence.", percentage: 30, expectedDeliveryWeeks: 2 },
        ],
        supportingDocuments: [{
          filename: supportingFile.name,
          mimeType: supportingFile.type || "application/octet-stream",
          contentBase64: btoa(binary),
        }],
      });
      setApplications((current) => [created, ...current]);
      setSelectedApp(created);
      setSupportingFile(null);
      setIsSubmitModalOpen(false);
      setApplicationForm((current) => ({ ...current, projectTitle: "", projectDescription: "", requestedAmountQOR: "" }));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "The application could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Grant Proposal Pipeline</h1>
          <p className="text-sm text-slate-400">Seven deterministic agents, FIPS 204 signing, and an optional AI-written explanation</p>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin ? (
            <button
              onClick={handleSeedDemo}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs flex items-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Load 3 Hackathon Demo Scenarios</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setSubmitError(null);
                setApplicationForm((current) => ({ ...current, beneficiaryWalletAddress: address || current.beneficiaryWalletAddress }));
                setIsSubmitModalOpen(true);
              }}
              disabled={pools.length === 0}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Submit application
            </button>
          )}
        </div>
      </div>

      {/* Demo Scenario Guidance Banner */}
      {isAdmin && (
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-cyan-400" />
              <span>Three Evaluation Testbeds Available</span>
            </span>
            <p className="text-slate-400">
              Select a scenario below and click <strong>"Run AI Agent Analysis Pipeline"</strong> to see deterministic checks and NIST FIPS 204 signing. If configured, Groq receives the project title, category, description, and rule results to write an explanation; it cannot change the decision.
            </p>
          </div>
        </div>
      )}

      {/* Main Grid: List on Left, Inspection Drawer on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Applications List */}
        <div className="lg:col-span-5 space-y-3">
          {applications.map((app) => {
            const isSelected = selectedApp?.id === app.id;
            return (
              <div
                key={app.id}
                onClick={() => {
                  setSelectedApp(app);
                  setAnalysisResult(null);
                }}
                className={`p-4 rounded-xl cursor-pointer transition-all border ${
                  isSelected
                    ? "bg-slate-900/95 border-cyan-500/50 shadow-md shadow-cyan-500/10"
                    : "bg-slate-900/50 border-slate-800 hover:bg-slate-900 hover:border-slate-700"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-cyan-400 font-semibold uppercase">
                      {app.category.replace(/_/g, " ")}
                    </span>
                    <h4 className="text-sm font-semibold text-white line-clamp-1">{app.projectTitle}</h4>
                    <p className="text-xs text-slate-400">By {app.applicantName}</p>
                  </div>
                  <StatusBadge status={app.status} />
                </div>

                <div className="flex items-center justify-between text-xs pt-3 mt-3 border-t border-slate-800/80">
                  <span className="font-mono text-slate-300 font-medium">{app.requestedAmountQOR} QOR</span>
                  <div className="flex items-center gap-1 text-[11px] text-cyan-400">
                    <span>Inspect</span>
                    <ChevronRight className="w-3 h-3" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Detail & Agent Execution View */}
        <div className="lg:col-span-7">
          {selectedApp ? (
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 sticky top-24">
              {/* Header */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-cyan-400 font-semibold px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800">
                    ID: {selectedApp.id}
                  </span>
                  <h2 className="text-lg font-bold text-white mt-2">{selectedApp.projectTitle}</h2>
                  <p className="text-xs text-slate-400">Applicant: {selectedApp.applicantName} ({selectedApp.applicantEmail})</p>
                </div>
                <StatusBadge status={selectedApp.status} />
              </div>

              {/* Action Bar: Run Multi-Agent Evaluation */}
              {isAdmin ? (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
                  <div className="space-y-0.5 text-xs">
                    <span className="text-slate-200 font-medium block">Autonomous AI & Cryptographic Pipeline</span>
                    <span className="text-slate-500">Runs deterministic checks and FIPS 204 signing; an optional model explains the result but never approves or pays grants</span>
                  </div>
                  <button
                    onClick={() => handleRunAnalysis(selectedApp.id)}
                    disabled={isAnalyzing}
                    className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium text-xs hover:opacity-95 shadow-lg shadow-cyan-500/25 flex items-center gap-2 disabled:opacity-50 transition-all shrink-0"
                  >
                    <Play className={`w-3.5 h-3.5 ${isAnalyzing ? "animate-spin" : ""}`} />
                    <span>{isAnalyzing ? "Analyzing (7 Agents)..." : "Run AI Agent Analysis Pipeline"}</span>
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
                  Your application status and review results are shown here. Only administrators can start an agent review.
                </div>
              )}

              {/* Proposal Details */}
              <div className="space-y-4 text-xs">
                <div>
                  <h4 className="font-semibold text-slate-300 mb-1">Project Technical Abstract</h4>
                  <p className="text-slate-400 leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                    {selectedApp.projectDescription}
                  </p>
                </div>

                {/* Beneficiary & Budget */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-slate-500 block">Beneficiary Wallet</span>
                    <span className="font-mono text-slate-300 truncate block" title={selectedApp.beneficiaryWalletAddress}>
                      {selectedApp.beneficiaryWalletAddress}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-slate-500 block">Funding Request</span>
                    <span className="font-mono text-cyan-400 font-semibold text-sm">
                      {selectedApp.requestedAmountQOR} QOR
                    </span>
                  </div>
                </div>

                {/* Milestones Breakdown */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-slate-300">Milestone Disbursement Plan (3 Phases)</h4>
                  <div className="space-y-2">
                    {selectedApp.milestones.map((m, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
                        <div className="space-y-0.5">
                          <span className="text-slate-200 font-medium block">{m.title}</span>
                          <span className="text-slate-500 text-[11px]">{m.description}</span>
                        </div>
                        <span className="font-mono text-cyan-400 font-medium px-2 py-1 rounded bg-cyan-950/50">
                          {m.percentage}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Analysis Outcome Result if just run */}
                {analysisResult && (
                  <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-cyan-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white flex items-center gap-2">
                        {analysisResult.decision.finalDecision === "APPROVED" ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400" />
                        )}
                        <span>Verdict: {analysisResult.decision.finalDecision}</span>
                      </span>
                      {analysisResult.decision.pqcSignatureBundle && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                          ML-DSA-87 SIGNED
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 text-slate-300">
                      {analysisResult.decision.reasons.map((r: string, i: number) => (
                        <p key={i} className="text-slate-400 flex items-start gap-2">
                          <span className="text-cyan-400">•</span>
                          <span>{r}</span>
                        </p>
                      ))}
                    </div>

                    {analysisResult.aiNarrative && (
                      <div className="pt-3 border-t border-slate-800 space-y-1" aria-live="polite">
                        <p className="text-xs font-semibold text-cyan-300">
                          AI explanation · {analysisResult.aiNarrative.status === "generated" ? "advisory" : analysisResult.aiNarrative.status.replace("_", " ")}
                        </p>
                        {analysisResult.aiNarrative.status === "generated" ? (
                          <>
                            <p className="text-sm text-slate-300">{analysisResult.aiNarrative.text}</p>
                            <p className="text-[11px] text-slate-500">
                              Generated by {analysisResult.aiNarrative.provider} ({analysisResult.aiNarrative.model}). Deterministic checks and the signed decision remain authoritative.
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-slate-400">
                            {analysisResult.aiNarrative.error} The deterministic decision is unchanged.
                          </p>
                        )}
                      </div>
                    )}

                    {analysisResult.transactionResult && (
                      <div className="pt-2 border-t border-slate-800 space-y-1 font-mono text-[11px]">
                        <p className={
                          analysisResult.transactionResult.isSimulated
                            ? "text-amber-300"
                            : analysisResult.transactionResult.status === "CONFIRMED"
                              ? "text-emerald-400"
                              : "text-amber-300"
                        }>
                          {analysisResult.transactionResult.isSimulated
                            ? "Demo simulation only — no QOR was transferred."
                            : analysisResult.transactionResult.status === "CONFIRMED"
                              ? "GrantVault receipt and payment event verified."
                              : analysisResult.transactionResult.status === "RECONCILIATION_REQUIRED"
                                ? "Receipt needs reconciliation; grant is not marked paid."
                                : analysisResult.transactionResult.status === "FAILED"
                                  ? "Transaction reverted; grant is not marked paid."
                                      : analysisResult.transactionResult.success === false
                                        ? "No grant payment transaction was submitted."
                                  : "Transaction submitted; awaiting receipt verification."}
                        </p>
                        {analysisResult.transactionResult.txHash && (
                          <p className="text-slate-400 truncate">
                                TxHash: <span className="text-slate-200">{analysisResult.transactionResult.txHash}</span>
                          </p>
                        )}
                        {analysisResult.transactionResult.errorMessage && (
                          <p className="text-amber-200 font-sans">
                                {analysisResult.transactionResult.errorMessage}
                          </p>
                        )}
                        {analysisResult.transactionResult.verificationError && (
                          <p className="text-amber-200 font-sans">
                            {analysisResult.transactionResult.verificationError}
                          </p>
                        )}
                        {analysisResult.transactionResult.status === "CONFIRMED" && (
                          <p className="text-slate-400">
                            Block: {analysisResult.transactionResult.blockNumber} | Gas: {analysisResult.transactionResult.gasUsed}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 rounded-2xl bg-slate-900 border border-slate-800">
              Select an application to view details
            </div>
          )}
        </div>
      </div>

      {isSubmitModalOpen && !isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <form onSubmit={handleSubmitApplication} className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div>
              <h2 className="text-lg font-bold text-white">Submit a grant application</h2>
              <p className="mt-1 text-xs text-slate-400">Your identity is taken from your signed-in account. Do not upload secrets or wallet recovery information.</p>
            </div>
            {submitError && <p role="alert" className="rounded-lg border border-rose-800 bg-rose-950/30 p-3 text-xs text-rose-200">{submitError}</p>}
            <label className="block space-y-1 text-xs text-slate-300">
              <span>Funding pool</span>
              <select
                required
                value={applicationForm.poolId}
                onChange={(event) => setApplicationForm({ ...applicationForm, poolId: event.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-slate-100"
              >
                {pools.map((pool) => <option key={pool.id} value={pool.id}>{pool.title} · {pool.category.replace(/_/g, " ")}</option>)}
              </select>
            </label>
            <label className="block space-y-1 text-xs text-slate-300">
              <span>Project title</span>
              <input required minLength={3} value={applicationForm.projectTitle} onChange={(event) => setApplicationForm({ ...applicationForm, projectTitle: event.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-slate-100" />
            </label>
            <label className="block space-y-1 text-xs text-slate-300">
              <span>Project description</span>
              <textarea required minLength={20} rows={4} value={applicationForm.projectDescription} onChange={(event) => setApplicationForm({ ...applicationForm, projectDescription: event.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-slate-100" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1 text-xs text-slate-300">
                <span>Requested amount (QOR)</span>
                <input required min="0.01" step="0.01" type="number" value={applicationForm.requestedAmountQOR} onChange={(event) => setApplicationForm({ ...applicationForm, requestedAmountQOR: event.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-slate-100" />
              </label>
              <label className="block space-y-1 text-xs text-slate-300">
                <span>Beneficiary EVM wallet address</span>
                <input required pattern="0x[a-fA-F0-9]{40}" value={applicationForm.beneficiaryWalletAddress} onChange={(event) => setApplicationForm({ ...applicationForm, beneficiaryWalletAddress: event.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 font-mono text-slate-100" />
              </label>
            </div>
            <label className="block space-y-1 text-xs text-slate-300">
              <span>Supporting document (PDF, PNG, or JPEG; max 8 MB)</span>
              <input required type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={(event) => setSupportingFile(event.target.files?.[0] || null)} className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-slate-200" />
            </label>
            <p className="text-[11px] text-amber-300">Document files are stored with the in-memory application record for this demo. Automated OCR and durable document storage are not enabled.</p>
            <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
              <button type="button" onClick={() => setIsSubmitModalOpen(false)} className="rounded-lg bg-slate-800 px-4 py-2 text-xs text-slate-300">Cancel</button>
              <button type="submit" disabled={submitting} className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50">{submitting ? "Submitting..." : "Submit application"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
