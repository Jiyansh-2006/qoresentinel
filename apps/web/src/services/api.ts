import {
  GrantPool,
  GrantApplication,
  SecurityStatus,
  DashboardStats,
  NativeWalletBalance,
  AssistantChatMessage,
  AgentOverview,
  AgentExecutionDetail,
  AgentExecutionSummary,
} from "../types/index.js";

const API_BASE = "/api";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: "ADMIN" | "STUDENT";
  profile: Record<string, string>;
  createdAt: string;
}

async function authRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}/auth${path}`, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(payload.error || "Authentication request failed.");
  return payload;
}

export const api = {
  getAuthSession: async (): Promise<{ isAuthenticated: boolean; user: AuthUser | null }> =>
    authRequest("/session"),

  login: async (email: string, password: string, rememberMe: boolean): Promise<{ user: AuthUser }> =>
    authRequest("/login", {
      method: "POST",
      body: JSON.stringify({ email, password, rememberMe }),
    }),

  register: async (role: "STUDENT" | "ADMIN", data: Record<string, string>): Promise<{ user: AuthUser }> =>
    authRequest(`/register/${role === "ADMIN" ? "admin" : "student"}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  logout: async (): Promise<void> => {
    await authRequest("/logout", { method: "POST" });
  },

  getStats: async (role?: "ADMIN" | "STUDENT"): Promise<DashboardStats> => {
    const dashboardPath = role ? `/${role.toLowerCase()}/dashboard/stats` : "/dashboard/stats";
    const res = await fetch(`${API_BASE}${dashboardPath}`, { credentials: "same-origin" });
    if (!res.ok) throw new Error("Failed to fetch dashboard stats");
    return res.json();
  },

  getDashboardStreamUrl: (role: "ADMIN" | "STUDENT"): string =>
    `${API_BASE}/${role.toLowerCase()}/dashboard/stream`,

  getNativeBalance: async (
    address: string,
    chainId: number
  ): Promise<NativeWalletBalance> => {
    const params = new URLSearchParams({ address, chainId: String(chainId) });
    const res = await fetch(`${API_BASE}/dashboard/native-balance?${params}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || "Failed to fetch native QOR balance");
    }
    return res.json();
  },

  getPools: async (): Promise<GrantPool[]> => {
    const res = await fetch(`${API_BASE}/pools`);
    if (!res.ok) throw new Error("Failed to fetch grant pools");
    return res.json();
  },

  createPool: async (data: any): Promise<GrantPool> => {
    const res = await fetch(`${API_BASE}/pools`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to create pool");
    }
    return res.json();
  },

  depositPool: async (id: string, amountQOR: number, demoMode: boolean) => {
    const res = await fetch(`${API_BASE}/pools/${id}/deposit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountQOR, demoMode }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || "Deposit failed");
    return payload;
  },

  createPoolFundingIntent: async (id: string, amountQOR: number, walletAddress: string) => {
    const res = await fetch(`${API_BASE}/pools/${id}/deposit-intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountQOR, walletAddress }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || "Failed to create a pool funding intent");
    return payload;
  },

  confirmPoolFunding: async (id: string, intentId: string, txHash: string) => {
    const res = await fetch(`${API_BASE}/pools/${id}/deposit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intentId, txHash }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok && !["PENDING", "FAILED", "RECONCILIATION_REQUIRED"].includes(payload.status)) {
      throw new Error(payload.error || "Failed to verify pool funding");
    }
    return payload;
  },

  getApplications: async (): Promise<GrantApplication[]> => {
    const res = await fetch(`${API_BASE}/applications`);
    if (!res.ok) throw new Error("Failed to fetch applications");
    return res.json();
  },

  getApplicationDetails: async (id: string) => {
    const res = await fetch(`${API_BASE}/applications/${id}`);
    if (!res.ok) throw new Error("Failed to fetch application details");
    return res.json();
  },

  submitApplication: async (data: any): Promise<GrantApplication> => {
    const res = await fetch(`${API_BASE}/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to submit application");
    }
    return res.json();
  },

  seedDemoApplications: async () => {
    const res = await fetch(`${API_BASE}/applications/seed-demo`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Failed to seed demo applications");
    return res.json();
  },

  runAgentAnalysis: async (applicationId: string, demoMode: boolean, walletAddress?: string) => {
    const res = await fetch(`${API_BASE}/applications/${applicationId}/analyse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ demoMode, walletAddress }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || err.error || "Agent evaluation failed");
    }
    return res.json();
  },

  createWalletExecutionIntent: async (applicationId: string, walletAddress: string) => {
    const res = await fetch(`${API_BASE}/applications/${applicationId}/wallet-execution-intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || "Failed to create a grant payment intent");
    return payload;
  },

  recordWalletExecution: async (applicationId: string, payload: any) => {
    const res = await fetch(`${API_BASE}/applications/${applicationId}/wallet-execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok && !["PENDING", "FAILED", "RECONCILIATION_REQUIRED"].includes(result.status)) {
      throw new Error(result.message || result.error || "Failed to record wallet transaction");
    }
    return result;
  },

  getAgents: async () => {
    const res = await fetch(`${API_BASE}/agents`);
    if (!res.ok) throw new Error("Failed to fetch agents");
    return res.json();
  },

  getAgentOverview: async (): Promise<AgentOverview> => {
    const res = await fetch(`${API_BASE}/agents/overview`);
    if (!res.ok) throw new Error("Failed to fetch agent overview");
    return res.json();
  },

  getAgentActivity: async () => {
    const res = await fetch(`${API_BASE}/agents/activity`);
    if (!res.ok) throw new Error("Failed to fetch agent activity");
    return res.json();
  },

  getAgentExecutions: async (): Promise<AgentExecutionSummary[]> => {
    const res = await fetch(`${API_BASE}/agents/executions`);
    if (!res.ok) throw new Error("Failed to fetch agent execution history");
    return res.json();
  },

  getAgentExecution: async (executionId: string): Promise<AgentExecutionDetail> => {
    const res = await fetch(`${API_BASE}/agents/executions/${encodeURIComponent(executionId)}`);
    if (!res.ok) throw new Error("Failed to fetch agent execution details");
    return res.json();
  },

  getSecurityStatus: async (): Promise<SecurityStatus> => {
    const res = await fetch(`${API_BASE}/security/status`);
    if (!res.ok) throw new Error("Failed to fetch security status");
    return res.json();
  },

  extendEvmWindow: async (durationSeconds: number = 7200) => {
    const res = await fetch(`${API_BASE}/security/authorise`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durationSeconds }),
    });
    if (!res.ok) throw new Error("Failed to extend EVM window");
    return res.json();
  },

  revokeAgent: async () => {
    const res = await fetch(`${API_BASE}/security/revoke`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Failed to revoke agent");
    return res.json();
  },

  rotateKeys: async () => {
    const res = await fetch(`${API_BASE}/security/rotate-keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Manual Administrator Key Rotation" }),
    });
    if (!res.ok) throw new Error("Failed to rotate keys");
    return res.json();
  },

  getTransactions: async () => {
    const res = await fetch(`${API_BASE}/transactions`);
    if (!res.ok) throw new Error("Failed to fetch transactions");
    return res.json();
  },

  recordWalletTransfer: async (payload: any) => {
    const res = await fetch(`${API_BASE}/transactions/wallet-transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to record wallet transfer");
    }
    return res.json();
  },

  getAuditLogs: async (applicationId?: string) => {
    const url = applicationId ? `${API_BASE}/audit/${applicationId}` : `${API_BASE}/audit`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch audit logs");
    return res.json();
  },

  chatWithAssistant: async (messages: AssistantChatMessage[]): Promise<{ reply: string }> => {
    const res = await fetch(`${API_BASE}/assistant/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
    const payload = await res.json().catch(() => null) as { reply?: string; error?: string } | null;
    if (!res.ok) {
      throw new Error(payload?.error || "The website assistant could not respond.");
    }
    if (!payload?.reply) {
      throw new Error("The website assistant returned an empty response.");
    }
    return { reply: payload.reply };
  },
};
