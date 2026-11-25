import { Router, Request, Response } from "express";
import { db } from "../database/db.js";

export const auditRouter = Router();

auditRouter.get("/", (req: Request, res: Response) => {
  res.json(db.auditLogs);
});

auditRouter.get("/:applicationId", (req: Request, res: Response) => {
  const logs = db.auditLogs.filter((l) => l.applicationId === req.params.applicationId);
  res.json(logs);
});
