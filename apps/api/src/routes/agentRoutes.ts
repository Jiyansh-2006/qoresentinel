import { Router, Request, Response } from "express";
import { db } from "../database/db.js";

export const agentRouter = Router();

const AGENTS_METADATA = [
  {
    id: "agent_1",
    role: "INTAKE_AGENT",
    name: "Application Intake Agent",
    description: "Validates proposal structure, sanitizes addresses, and ensures required metadata formatting.",
    status: "ACTIVE",
    version: "1.0.4",
  },
  {
    id: "agent_2",
    role: "DOCUMENT_AGENT",
    name: "Document Verification Agent",
    description: "Hashes submitted evidence and checks duplicate documents. OCR extraction is not configured in this demo build.",
    status: "ACTIVE",
    version: "1.2.0",
  },
  {
    id: "agent_3",
    role: "ELIGIBILITY_AGENT",
    name: "Eligibility Agent",
    description: "Applies pool-specific criteria, verifies category alignment, and validates 3-phase milestone execution plans.",
    status: "ACTIVE",
    version: "1.1.2",
  },
  {
    id: "agent_4",
    role: "FRAUD_AGENT",
    name: "Fraud & Duplicate Detection Agent",
    description: "Detects Sybil wallets, identical proposals, and conflicting identities using cross-application deterministic analysis.",
    status: "ACTIVE",
    version: "2.0.1",
  },
  {
    id: "agent_5",
    role: "FINANCIAL_AGENT",
    name: "Financial Policy Agent",
    description: "Evaluates exact integer base units, pool ceilings, milestone tranches, and treasury solvency.",
    status: "ACTIVE",
    version: "1.0.0",
  },
  {
    id: "agent_6",
    role: "COORDINATOR_AGENT",
    name: "Decision Coordinator Agent",
    description: "Synthesizes multi-agent verdicts, enforces deterministic policy gates, and issues ML-DSA-87 signed decisions.",
    status: "ACTIVE",
    version: "1.5.0",
  },
  {
    id: "agent_7",
    role: "TRANSACTION_AGENT",
    name: "Autonomous Transaction Agent",
    description: "Operates with scoped EVM session permissions, validates PQC signatures, and calls GrantVault contract.",
    status: "ACTIVE",
    version: "1.3.1",
  },
];

agentRouter.get("/", (req: Request, res: Response) => {
  res.json(AGENTS_METADATA);
});

agentRouter.get("/overview", (req: Request, res: Response) => {
  const activeRoles = new Set<string>();
  const attentionRoles = new Set<string>();
  const latestStatuses = new Map<string, { status: string; executionStatus: string }>();

  for (const execution of db.agentExecutions) {
    for (const event of [...execution.events].sort((a, b) => b.timestamp - a.timestamp)) {
      if (!latestStatuses.has(event.agentRole)) {
        latestStatuses.set(event.agentRole, { status: event.status, executionStatus: execution.status });
      }
    }
  }
  for (const [role, latest] of latestStatuses) {
    if (latest.status === "START" && latest.executionStatus === "RUNNING") activeRoles.add(role);
    if (latest.status === "ERROR" || latest.executionStatus === "FAILED") attentionRoles.add(role);
  }

  const completed = db.agentExecutions.filter((execution) => execution.status === "COMPLETED");
  const durations = db.agentExecutions
    .map((execution) => execution.durationMs)
    .filter((duration): duration is number => typeof duration === "number");

  res.json({
    totalAgents: AGENTS_METADATA.length,
    activeAgents: activeRoles.size,
    idleAgents: AGENTS_METADATA.length - activeRoles.size,
    agentsRequiringAttention: attentionRoles.size,
    totalApplicationsProcessed: db.agentExecutions.length,
    successfulExecutions: completed.length,
    failedExecutions: db.agentExecutions.filter((execution) => execution.status === "FAILED").length,
    averageProcessingMs: durations.length
      ? Math.round(durations.reduce((total, duration) => total + duration, 0) / durations.length)
      : 0,
    demoData: true,
  });
});

agentRouter.get("/executions", (req: Request, res: Response) => {
  res.json(db.agentExecutions.map((execution) => ({
    id: execution.id,
    applicationId: execution.applicationId,
    status: execution.status,
    startedAt: execution.startedAt,
    endedAt: execution.endedAt,
    durationMs: execution.durationMs,
    finalDecision: execution.finalDecision,
    error: execution.error,
    transactionResult: execution.transactionResult,
  })));
});

agentRouter.get("/executions/:executionId", (req: Request, res: Response) => {
  const execution = db.agentExecutions.find((item) => item.id === req.params.executionId);
  if (!execution) return res.status(404).json({ error: "Agent execution not found." });
  return res.json(execution);
});

agentRouter.get("/activity", (req: Request, res: Response) => {
  const agentEvents = db.agentExecutions.flatMap((execution) =>
    execution.events.map((event) => ({
      id: `${execution.id}-${event.stepIndex}-${event.status}`,
      executionId: execution.id,
      applicationId: execution.applicationId,
      agentRole: event.agentRole,
      eventType: event.status,
      action: `${event.agentName} [${event.status}]`,
      actor: event.agentRole,
      details: event.status === "START"
        ? `Step ${event.stepIndex}/${event.totalSteps} started`
        : `Step ${event.stepIndex}/${event.totalSteps} finished in ${event.executionMs}ms`,
      createdAt: new Date(event.timestamp).toISOString(),
    }))
  );
  const auditEvents = db.auditLogs
    .filter((log) => log.actor.includes("Agent") || log.actor.includes("Pipeline"))
    .map((log) => ({ ...log, eventType: log.action, executionId: undefined, agentRole: undefined }));
  res.json([...agentEvents, ...auditEvents]
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, 100));
});

// Server-Sent Events (SSE) live stream
agentRouter.get("/stream", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent("connected", { status: "STREAM_CONNECTED", timestamp: Date.now() });

  const agentHandler = (data: any) => {
    sendEvent("agent_event", data);
  };

  const auditHandler = (data: any) => {
    sendEvent("audit_event", data);
  };

  const executionHandler = (data: any) => {
    sendEvent("execution_event", data);
  };

  db.sseEmitter.on("agent_event", agentHandler);
  db.sseEmitter.on("audit", auditHandler);
  db.sseEmitter.on("execution_event", executionHandler);

  req.on("close", () => {
    db.sseEmitter.off("agent_event", agentHandler);
    db.sseEmitter.off("audit", auditHandler);
    db.sseEmitter.off("execution_event", executionHandler);
  });
});

agentRouter.get("/:id", (req: Request, res: Response) => {
  const agent = AGENTS_METADATA.find((item) => item.id === req.params.id);
  if (!agent) return res.status(404).json({ error: "Agent not found." });

  const reports = db.agentExecutions.flatMap((execution) =>
    execution.reports
      .filter((report) => report.agentRole === agent.role)
      .map((report) => ({ executionId: execution.id, applicationId: execution.applicationId, ...report }))
  );
  return res.json({ ...agent, reports });
});
