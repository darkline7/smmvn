import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { getSession } from "../app.js";

export interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
}

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + (process.env.SECRET_SALT || "smm-panel-salt-2024")).digest("hex");
}

export function generateApiKey(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function generateReferralCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const session = getSession(req);
  if (!session?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.userId = session.userId;
  req.userRole = session.userRole;
  next();
}

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const session = getSession(req);
  if (!session?.userId || session.userRole !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  req.userId = session.userId;
  req.userRole = session.userRole;
  next();
}

export async function requireApiKey(req: AuthRequest, res: Response, next: NextFunction) {
  const apiKey = req.body?.key || req.headers["x-api-key"];
  if (!apiKey) {
    return res.status(401).json({ error: "API key required" });
  }
  const user = await db.select().from(usersTable).where(eq(usersTable.apiKey, apiKey)).limit(1);
  if (!user[0] || user[0].banned) {
    return res.status(401).json({ error: "Invalid API key" });
  }
  req.userId = user[0].id;
  req.userRole = user[0].role;
  next();
}
