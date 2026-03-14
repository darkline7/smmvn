import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, hashPassword, verifyPassword, generateApiKey } from "../lib/auth.js";
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
    username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, "Username chỉ chứa chữ, số và _").optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8).optional(),
    timezone: z.string().max(50).optional(),
  });
  try {
    const data = schema.parse(req.body);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    if (!user) return res.status(404).json({ error: "Not found" });

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (data.username) updates.username = data.username;
    if (data.timezone) updates.timezone = data.timezone;
    if (data.newPassword && data.currentPassword) {
      const valid = await verifyPassword(data.currentPassword, user.passwordHash, user.id);
      if (!valid) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }
      updates.passwordHash = await hashPassword(data.newPassword);
    }

    const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, req.userId!)).returning();
    const { passwordHash, ...safeUser } = updated;
    return res.json(safeUser);
  } catch (e: any) {
    return res.status(400).json({ error: toUserMessage(e) });
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
  if (newPassword.length < 8) return res.status(400).json({ error: "Mật khẩu mới tối thiểu 8 ký tự" });
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) return res.status(404).json({ error: "Not found" });
  const valid = await verifyPassword(currentPassword, user.passwordHash, user.id);
  if (!valid) return res.status(400).json({ error: "Mật khẩu hiện tại không đúng" });
  await db.update(usersTable).set({ passwordHash: await hashPassword(newPassword), updatedAt: new Date() }).where(eq(usersTable.id, req.userId!));
  return res.json({ success: true });
});

export default router;
