import { Router } from "express";
import { db } from "@workspace/db";
import { announcementsTable, notificationsTable, referralsTable, usersTable, siteSettingsTable } from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import type { AuthRequest } from "../lib/auth.js";

const router = Router();

router.get("/announcements", async (req, res) => {
  const announcements = await db.select().from(announcementsTable).where(eq(announcementsTable.active, true)).orderBy(desc(announcementsTable.createdAt)).limit(10);
  return res.json({ announcements });
});

// Public settings — bank info + deposit limits + exchange rate
router.get("/public/settings", async (_req, res) => {
  try {
    const rows = await db.select().from(siteSettingsTable);
    const s: Record<string, string> = {};
    rows.forEach(r => { s[r.key] = r.value || ""; });
    return res.json({
      siteName: s["site_name"] || "SMM Pro",
      bankName: s["bank_name"] || "",
      bankAccountNumber: s["bank_account_number"] || "",
      bankAccountName: s["bank_account_name"] || "",
      bankBin: s["bank_bin"] || "",
      minDeposit: Number(s["min_deposit"] || "1"),
      maxDeposit: Number(s["max_deposit"] || "10000"),
      vndExchangeRate: Number(s["vnd_exchange_rate"] || "24000"),
      sepayEnabled: s["sepay_enabled"] === "true",
    });
  } catch {
    return res.json({
      siteName: "SMM Pro", bankName: "", bankAccountNumber: "",
      bankAccountName: "", bankBin: "", minDeposit: 1,
      maxDeposit: 10000, vndExchangeRate: 24000, sepayEnabled: false,
    });
  }
});

// DB status check (authenticated)
router.get("/admin/db-status", requireAuth as any, async (_req: AuthRequest, res: any) => {
  try {
    const start = Date.now();
    await db.execute(sql`SELECT 1`);
    const ms = Date.now() - start;
    const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(usersTable);
    return res.json({ connected: true, latencyMs: ms, userCount: Number(userCount.count) });
  } catch (e: any) {
    return res.json({ connected: false, error: e.message });
  }
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
  const referralLink = `${process.env.SITE_URL || "https://smmvn.replit.app"}/register?ref=${referralCode}`;
  
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
