import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, hashPassword, generateApiKey } from "../lib/auth.js";
import type { AuthRequest } from "../lib/auth.js";
import { z } from "zod";

const router = Router();

router.get("/", requireAuth as any, async (req: AuthRequest, res: Response) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) return res.status(404).json({ error: "Not found" });
  const { passwordHash, ...safeUser } = user;
  return res.json(safeUser);
});

router.patch("/", requireAuth as any, async (req: AuthRequest, res: Response) => {
  const schema = z.object({
    username: z.string().min(3).optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().min(6).optional(),
    timezone: z.string().optional(),
  });
  try {
    const data = schema.parse(req.body);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    if (!user) return res.status(404).json({ error: "Not found" });

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (data.username) updates.username = data.username;
    if (data.timezone) updates.timezone = data.timezone;
    if (data.newPassword && data.currentPassword) {
      if (user.passwordHash !== hashPassword(data.currentPassword)) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }
      updates.passwordHash = hashPassword(data.newPassword);
    }

    const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, req.userId!)).returning();
    const { passwordHash, ...safeUser } = updated;
    return res.json(safeUser);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

router.post("/api-key", requireAuth as any, async (req: AuthRequest, res: Response) => {
  const newKey = generateApiKey();
  await db.update(usersTable).set({ apiKey: newKey, updatedAt: new Date() }).where(eq(usersTable.id, req.userId!));
  return res.json({ apiKey: newKey });
});

router.post("/password", requireAuth as any, async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: "currentPassword and newPassword required" });
  if (newPassword.length < 6) return res.status(400).json({ error: "Mật khẩu mới tối thiểu 6 ký tự" });
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) return res.status(404).json({ error: "Not found" });
  if (user.passwordHash !== hashPassword(currentPassword)) return res.status(400).json({ error: "Mật khẩu hiện tại không đúng" });
  await db.update(usersTable).set({ passwordHash: hashPassword(newPassword), updatedAt: new Date() }).where(eq(usersTable.id, req.userId!));
  return res.json({ success: true });
});

export default router;
