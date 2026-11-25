import test from "node:test";
import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { db, type AgentExecutionRecord } from "../database/db.js";
import { agentRouter } from "../routes/agentRoutes.js";
import { applicationRouter } from "../routes/applicationRoutes.js";
import { DemoDataService } from "../services/demoDataService.js";

async function withAgentServer<T>(run: (port: number) => Promise<T>): Promise<T> {
  const app = express();
  app.use("/api/agents", agentRouter);
  const server = app.listen(0);

  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  try {
    return await run((server.address() as AddressInfo).port);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

function getJson<T>(port: number, path: string): Promise<{ status: number; payload: T }> {
  return new Promise((resolve, reject) => {
    const request = httpRequest({ hostname: "127.0.0.1", port, path }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => { body += chunk; });
      response.on("end", () => resolve({
        status: response.statusCode || 0,
        payload: JSON.parse(body) as T,
      }));
    });
    request.on("error", reject);
    request.end();
  });
}

function postJson<T>(port: number, path: string, payload: unknown): Promise<{ status: number; payload: T }> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const request = httpRequest({
      hostname: "127.0.0.1",
      port,
      path,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    }, (response) => {
      let responseBody = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => { responseBody += chunk; });
      response.on("end", () => resolve({
        status: response.statusCode || 0,
        payload: JSON.parse(responseBody) as T,
      }));
    });
    request.on("error", reject);
    request.end(body);
  });
}

async function withExecutionServer<T>(run: (port: number) => Promise<T>): Promise<T> {
  const app = express();
  app.use(express.json());
  app.use((request, _response, next) => {
    request.authUser = {
      id: "agent-route-test-admin",
      email: "agent-admin@example.test",
      fullName: "Agent Route Test Administrator",
      role: "ADMIN",
      profile: {},
      createdAt: new Date().toISOString(),
    };
    next();
  });
  app.use("/api/applications", applicationRouter);
  app.use("/api/agents", agentRouter);
  const server = app.listen(0);

  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  try {
    return await run((server.address() as AddressInfo).port);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

test("agent centre exposes overview, history, reports, and static paths", async () => {
  const execution: AgentExecutionRecord = {
    id: "agent-center-test-execution",
    applicationId: "app-test",
    status: "COMPLETED",
    startedAt: "2026-01-01T00:00:00.000Z",
    endedAt: "2026-01-01T00:00:00.250Z",
    durationMs: 250,
    finalDecision: "REJECTED",
    events: [{
      executionId: "agent-center-test-execution",
      applicationId: "app-test",
      agentRole: "INTAKE_AGENT",
      agentName: "Application Intake Agent",
      stepIndex: 1,
      totalSteps: 7,
      status: "COMPLETE",
      executionMs: 10,
      data: { valid: true },
      timestamp: Date.parse("2026-01-01T00:00:00.100Z"),
    }],
    reports: [{
      agentRole: "INTAKE_AGENT",
      agentName: "Application Intake Agent",
      stepIndex: 1,
      status: "COMPLETE",
      executionMs: 10,
      output: { valid: true },
      createdAt: "2026-01-01T00:00:00.100Z",
    }],
  };
  db.agentExecutions.unshift(execution);

  try {
    await withAgentServer(async (port) => {
      const [overview, history, detail, agent, activity] = await Promise.all([
        getJson<{ totalAgents: number; totalApplicationsProcessed: number; demoData: boolean }>(port, "/api/agents/overview"),
        getJson<Array<{ id: string }>>(port, "/api/agents/executions"),
        getJson<AgentExecutionRecord>(port, `/api/agents/executions/${execution.id}`),
        getJson<{ role: string; reports: unknown[] }>(port, "/api/agents/agent_1"),
        getJson<Array<{ executionId?: string }>>(port, "/api/agents/activity"),
      ]);

      assert.equal(overview.status, 200);
      assert.equal(overview.payload.totalAgents, 7);
      assert.equal(overview.payload.demoData, true);
      assert.ok(overview.payload.totalApplicationsProcessed >= 1);
      assert.ok(history.payload.some((item) => item.id === execution.id));
      assert.equal(detail.payload.reports.length, 1);
      assert.equal(agent.payload.role, "INTAKE_AGENT");
      assert.equal(agent.payload.reports.length, 1);
      assert.ok(activity.payload.some((event) => event.executionId === execution.id));
    });
  } finally {
    const index = db.agentExecutions.indexOf(execution);
    if (index >= 0) db.agentExecutions.splice(index, 1);
  }
});

test("review execution records real agent outputs and prevents replay", async () => {
  const originalApiKey = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = "";
  const application = {
    ...DemoDataService.DEMO_APPLICATIONS[2],
    id: `agent-center-test-${Date.now()}`,
    status: "PENDING",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.applications.unshift(application);
  let executionId: string | undefined;

  try {
    await withExecutionServer(async (port) => {
      const result = await postJson<{
        executionId: string;
        decision: { finalDecision: string };
      }>(port, `/api/applications/${application.id}/analyse`, { demoMode: true });

      assert.equal(result.status, 200);
      executionId = result.payload.executionId;
      assert.ok(executionId);
      assert.equal(result.payload.decision.finalDecision, "REJECTED");

      const execution = await getJson<AgentExecutionRecord>(port, `/api/agents/executions/${executionId}`);
      assert.equal(execution.status, 200);
      assert.equal(execution.payload.status, "COMPLETED");
      assert.equal(execution.payload.finalDecision, "REJECTED");
      assert.ok(execution.payload.reports.length >= 6);
      assert.ok(execution.payload.reports.some((report) => report.agentRole === "COORDINATOR_AGENT"));

      const replay = await postJson<{ error: string }>(
        port,
        `/api/applications/${application.id}/analyse`,
        { demoMode: true }
      );
      assert.equal(replay.status, 409);
      assert.match(replay.payload.error, /pending applications/);
    });
  } finally {
    if (executionId) {
      const executionIndex = db.agentExecutions.findIndex((item) => item.id === executionId);
      if (executionIndex >= 0) db.agentExecutions.splice(executionIndex, 1);
    }
    db.deleteApplicationRecord(application.id);
    if (originalApiKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = originalApiKey;
  }
});

test("demo execution approves a grant without recording a simulated payment as paid", async () => {
  const originalApiKey = process.env.GROQ_API_KEY;
  const pool = db.pools.find((item) => item.id === DemoDataService.DEMO_APPLICATIONS[0].poolId);
  assert.ok(pool);
  const originalRemainingBudget = pool.remainingBudget;
  process.env.GROQ_API_KEY = "";
  const suffix = Date.now().toString();
  const application = {
    ...DemoDataService.DEMO_APPLICATIONS[0],
    id: `agent-center-demo-ledger-${suffix}`,
    applicantEmail: `demo-ledger-${suffix}@example.test`,
    projectTitle: `Demo Ledger Safety ${suffix}`,
    beneficiaryWalletAddress: "0x0000000000000000000000000000000000000abc",
    supportingDocuments: DemoDataService.DEMO_APPLICATIONS[0].supportingDocuments.map((document) => ({
      ...document,
      filename: `${suffix}-${document.filename}`,
      contentBase64: `${document.contentBase64}-${suffix}`,
    })),
    status: "PENDING",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.applications.unshift(application);
  let executionId: string | undefined;

  try {
    await withExecutionServer(async (port) => {
      const result = await postJson<{
        executionId: string;
        application: { status: string };
        decision: { finalDecision: string };
        transactionResult: { success: boolean; isSimulated: boolean };
      }>(port, `/api/applications/${application.id}/analyse`, { demoMode: true });

      assert.equal(result.status, 200);
      executionId = result.payload.executionId;
      assert.equal(result.payload.decision.finalDecision, "APPROVED");
      assert.equal(result.payload.application.status, "APPROVED");
      assert.equal(result.payload.transactionResult.success, true);
      assert.equal(result.payload.transactionResult.isSimulated, true);
      assert.equal(db.transactions.some((transaction) => transaction.applicationId === application.id), false);
    });
  } finally {
    if (executionId) {
      const executionIndex = db.agentExecutions.findIndex((item) => item.id === executionId);
      if (executionIndex >= 0) db.agentExecutions.splice(executionIndex, 1);
    }
    db.deleteApplicationRecord(application.id);
    pool.remainingBudget = originalRemainingBudget;
    db.savePool(pool);
    if (originalApiKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = originalApiKey;
  }
});
