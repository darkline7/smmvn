import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { getSession } from "../app.js";

export interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
}

const BCRYPT_ROUNDS = 12;

// Legacy SHA-256 hash for migration (detects old hashes on login)
function legacyHash(password: string): string {
  return crypto.createHash("sha256")
    .update(password + (process.env.SECRET_SALT || "smm-panel-salt-2024"))
    .digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

// Synchronous wrapper kept for non-login use cases (API key gen etc.)
// NOTE: Do not use for password hashing — always use the async version
export function hashPasswordSync(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

/**
 * Verify password — handles both bcrypt (new) and legacy SHA-256 (old).
 * On successful legacy login, transparently upgrades to bcrypt.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
  userId?: number,
): Promise<boolean> {
  // Bcrypt hashes always start with $2a$ or $2b$
  if (storedHash.startsWith("$2")) {
    return bcrypt.compare(password, storedHash);
  }

  // Legacy SHA-256 hash — verify and upgrade in-place
  const legacyDigest = legacyHash(password);
  // Use constant-time comparison to prevent timing attacks
  const legacyBuf = Buffer.from(legacyDigest);
  const storedBuf = Buffer.from(storedHash);
  if (legacyBuf.length !== storedBuf.length) return false;
  const match = crypto.timingSafeEqual(legacyBuf, storedBuf);

  if (match && userId) {
    // Upgrade to bcrypt silently — non-blocking
    const newHash = await hashPassword(password);
    db.update(usersTable)
      .set({ passwordHash: newHash })
      .where(eq(usersTable.id, userId))
      .catch(e => console.error("[auth] password upgrade failed:", e.message));
  }

  return match;
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
  return next();
}

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const session = getSession(req);
  if (!session?.userId || session.userRole !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  req.userId = session.userId;
  req.userRole = session.userRole;
  return next();
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
  return next();
}
