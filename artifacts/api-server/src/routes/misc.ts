import { Router } from "express";
import { db } from "@workspace/db";
import { announcementsTable, notificationsTable, referralsTable, usersTable } from "@workspace/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import type { AuthRequest } from "../lib/auth.js";

const router = Router();

router.get("/announcements", async (req, res) => {
  const announcements = await db.select().from(announcementsTable).where(eq(announcementsTable.active, true)).orderBy(desc(announcementsTable.createdAt)).limit(10);
  return res.json({ announcements });
});

router.get("/notifications", requireAuth as any, async (req: AuthRequest, res: any) => {
  const notifications = await db.select().from(notificationsTable)
    .where(eq(notificationsTable.userId, req.userId!))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);
  const unread = notifications.filter(n => !n.read).length;
  return res.json({ notifications, unread });
});

router.post("/notifications/read-all", requireAuth as any, async (req: AuthRequest, res: any) => {
  await db.update(notificationsTable).set({ read: true }).where(eq(notificationsTable.userId, req.userId!));
  return res.json({ success: true, message: "All notifications marked as read" });
});

router.get("/referrals", requireAuth as any, async (req: AuthRequest, res: any) => {
  const user = await db.select({ referralCode: usersTable.referralCode }).from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  const referralCode = user[0]?.referralCode || "";
  const referralLink = `${process.env.SITE_URL || "https://smmpanel.com"}/register?ref=${referralCode}`;
  
  const history = await db.select({
    userId: referralsTable.referredUserId,
    username: sql<string>`(SELECT username FROM users WHERE id = referrals.referred_user_id)`,
    commission: referralsTable.commission,
    createdAt: referralsTable.createdAt,
  }).from(referralsTable).where(eq(referralsTable.referrerId, req.userId!)).orderBy(desc(referralsTable.createdAt));

  const totalCommission = history.reduce((sum, r) => sum + Number(r.commission), 0);
  return res.json({
    referralCode,
    referralLink,
    totalReferrals: history.length,
    totalCommission,
    commissionRate: 0.05,
    history,
  });
});

export default router;
