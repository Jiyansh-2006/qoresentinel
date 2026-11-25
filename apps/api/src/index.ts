import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env");
dotenv.config({ path: envPath });

const [
  { authRouter },
  { dashboardRouter, adminDashboardRouter, studentDashboardRouter },
  { poolRouter },
  { applicationRouter },
  { agentRouter },
  { securityRouter },
  { transactionRouter },
  { auditRouter },
  { assistantRouter },
  { requireAuth, requireRole, requireSameOrigin },
] = await Promise.all([
  import("./routes/authRoutes.js"),
  import("./routes/dashboardRoutes.js"),
  import("./routes/poolRoutes.js"),
  import("./routes/applicationRoutes.js"),
  import("./routes/agentRoutes.js"),
  import("./routes/securityRoutes.js"),
  import("./routes/transactionRoutes.js"),
  import("./routes/auditRoutes.js"),
  import("./routes/assistantRoutes.js"),
  import("./middleware/auth.js"),
]);

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const allowedOrigins = (process.env.APP_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Request origin is not allowed."));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json({ limit: "15mb" }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path !== "/api/agents/stream") {
      console.log(`[API] ${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "HEALTHY",
    service: "QoreSentinel API & Autonomous Multi-Agent Core",
    network: "QoreChain Diana Testnet",
    chainId: 9800,
    pqcAlgorithm: "ML-DSA-87",
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
app.use("/api/auth", authRouter);
app.use("/api/dashboard", requireAuth, dashboardRouter);
app.use("/api/admin/dashboard", requireAuth, adminDashboardRouter);
app.use("/api/student/dashboard", requireAuth, studentDashboardRouter);
app.use("/api/pools", poolRouter);
app.use("/api/applications", applicationRouter);
app.use("/api/admin/applications", requireAuth, requireRole("ADMIN"), applicationRouter);
app.use("/api/agents", requireSameOrigin, requireAuth, requireRole("ADMIN"), agentRouter);
app.use("/api/security", requireSameOrigin, requireAuth, requireRole("ADMIN"), securityRouter);
app.use("/api/transactions", requireSameOrigin, transactionRouter);
app.use("/api/audit", requireSameOrigin, requireAuth, requireRole("ADMIN"), auditRouter);
app.use("/api/assistant", assistantRouter);

if (process.env.SERVE_WEB === "true") {
  const webDistPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web/dist");
  app.use(express.static(webDistPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) {
      next();
      return;
    }
    res.sendFile(path.join(webDistPath, "index.html"), (error) => {
      if (error) next(error);
    });
  });
}

// Central error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[SERVER_ERROR]", err);
  res.status(err.status || 500).json({
    error: err.name || "InternalServerError",
    message: err.message || "An unexpected error occurred",
  });
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, "0.0.0.0", () => {
    console.log("==================================================================");
    console.log(`🚀 QoreSentinel API Server running at http://localhost:${PORT}`);
    console.log(`🛡️  Post-Quantum Standard: NIST FIPS 204 ML-DSA-87 (Security Level 5)`);
    console.log(`🌐 Target Network: QoreChain Diana Testnet (Chain ID 9800)`);
    console.log(`🤖 Autonomous Multi-Agent Pipeline: 7 Specialized Agents Ready`);
    console.log("==================================================================");
  });
}

export default app;
