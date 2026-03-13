import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, or } from "drizzle-orm";
import { hashPassword, generateApiKey, generateReferralCode } from "../lib/auth.js";
import { setSession, getSession } from "../app.js";
import { z } from "zod";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  username: z.string().min(3).max(30),
  referralCode: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

router.post("/register", async (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);
    const existing = await db.select({ id: usersTable.id }).from(usersTable)
      .where(or(eq(usersTable.email, data.email), eq(usersTable.username, data.username)))
      .limit(1);
    if (existing[0]) {
      return res.status(400).json({ error: "Email or username already exists" });
    }
    const [user] = await db.insert(usersTable).values({
      email: data.email,
      username: data.username,
      passwordHash: hashPassword(data.password),
      apiKey: generateApiKey(),
      referralCode: generateReferralCode(),
    }).returning();
    setSession(req, res, { userId: user.id, userRole: user.role });
    const { passwordHash, ...safeUser } = user;
    return res.status(201).json({ user: safeUser });
  } catch (e: any) {
    return res.status(400).json({ error: e.message || "Invalid request" });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  try {
    const data = loginSchema.parse(req.body);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, data.email)).limit(1);
    if (!user || user.passwordHash !== hashPassword(data.password)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    if (user.banned) {
      return res.status(403).json({ error: "Account is banned" });
    }
    setSession(req, res, { userId: user.id, userRole: user.role });
    const { passwordHash, ...safeUser } = user;
    return res.json({ user: safeUser });
  } catch (e: any) {
    return res.status(400).json({ error: e.message || "Invalid request" });
  }
});

router.post("/logout", (req: Request, res: Response) => {
  setSession(req, res, null);
  return res.json({ success: true, message: "Logged out" });
});

router.get("/me", async (req: Request, res: Response) => {
  const session = getSession(req);
  if (!session?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, session.userId)).limit(1);
  if (!user) return res.status(404).json({ error: "User not found" });
  const { passwordHash, ...safeUser } = user;
  return res.json(safeUser);
});

router.post("/forgot-password", async (_req: Request, res: Response) => {
  return res.json({ success: true, message: "If that email exists, a reset link will be sent" });
});

export default router;
