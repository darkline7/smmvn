import { Router } from "express";
import { db } from "@workspace/db";
import { announcementsTable, notificationsTable, referralsTable, usersTable, siteSettingsTable, providersTable, servicesTable, categoriesTable } from "@workspace/db/schema";
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

// ---- CRON endpoints (no auth — protected by cron_secret query param) ----

async function getSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(siteSettingsTable);
  const s: Record<string, string> = {};
  rows.forEach(r => { s[r.key] = r.value || ""; });
  return s;
}

async function syncOneProvider(provider: typeof providersTable.$inferSelect): Promise<{ added: number; updated: number; total: number; error?: string }> {
  const markup = 1 + (Number(provider.markupPercent) || 25) / 100;
  try {
    const resp = await fetch(`${provider.baseUrl}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `key=${encodeURIComponent(provider.apiKey)}&action=services`,
      signal: AbortSignal.timeout(30000),
    });
    const services: any[] = await resp.json();
    if (!Array.isArray(services)) return { added: 0, updated: 0, total: 0, error: "Provider không trả về danh sách" };

    let cat = await db.select().from(categoriesTable).where(eq(categoriesTable.name, provider.name)).limit(1);
    if (!cat[0]) {
      const [newCat] = await db.insert(categoriesTable).values({ name: provider.name, description: `Dịch vụ từ ${provider.name}`, sortOrder: 99 }).returning();
      cat = [newCat];
    }
    const categoryId = cat[0].id;

    let added = 0;
    let updated = 0;
    for (const s of services.slice(0, 2000)) {
      try {
        const providerServiceId = String(s.service);
        const newRate = Number((Number(s.rate) * markup).toFixed(6)).toString();
        const min = Number(s.min) || 10;
        const max = Number(s.max) || 100000;
        const existing = await db.select({ id: servicesTable.id }).from(servicesTable)
          .where(eq(servicesTable.providerServiceId, providerServiceId)).limit(1);
        if (existing[0]) {
          await db.update(servicesTable).set({ rate: newRate, min, max, updatedAt: new Date() }).where(eq(servicesTable.id, existing[0].id));
          updated++;
        } else {
          await db.insert(servicesTable).values({
            categoryId, name: s.name || `Service #${s.service}`, description: s.category || "",
            providerId: provider.id, providerServiceId, type: "default",
            rate: newRate, min, max, status: "inactive",
          });
          added++;
        }
      } catch {}
    }
    await db.update(providersTable).set({ lastSyncAt: new Date(), status: "active", updatedAt: new Date() }).where(eq(providersTable.id, provider.id));
    return { added, updated, total: added + updated };
  } catch (e: any) {
    return { added: 0, updated: 0, total: 0, error: e.message };
  }
}

// GET /api/cron/sync-all?secret=xxx  — sync all active providers
router.get("/cron/sync-all", async (req, res) => {
  try {
    const settings = await getSettings();
    const cronSecret = settings["cron_secret"] || "";
    if (!cronSecret || req.query.secret !== cronSecret) {
      return res.status(401).json({ error: "Invalid cron secret" });
    }
    const providers = await db.select().from(providersTable).where(eq(providersTable.status, "active"));
    const results = await Promise.allSettled(providers.map(p => syncOneProvider(p)));
    const summary = results.map((r, i) => ({
      provider: providers[i].name,
      ...(r.status === "fulfilled" ? r.value : { error: String(r.reason) }),
    }));
    return res.json({ success: true, synced: providers.length, results: summary, timestamp: new Date().toISOString() });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// GET /api/cron/sync/:id?secret=xxx  — sync single provider by ID
router.get("/cron/sync/:id", async (req, res) => {
  try {
    const settings = await getSettings();
    const cronSecret = settings["cron_secret"] || "";
    if (!cronSecret || req.query.secret !== cronSecret) {
      return res.status(401).json({ error: "Invalid cron secret" });
    }
    const [provider] = await db.select().from(providersTable).where(eq(providersTable.id, Number(req.params.id))).limit(1);
    if (!provider) return res.status(404).json({ error: "Provider not found" });
    const result = await syncOneProvider(provider);
    return res.json({ success: !result.error, provider: provider.name, ...result, timestamp: new Date().toISOString() });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

export default router;
