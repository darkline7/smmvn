import { Router } from "express";
import { db } from "@workspace/db";
import { announcementsTable, notificationsTable, referralsTable, usersTable, siteSettingsTable, providersTable, servicesTable, categoriesTable, ordersTable, orderLogsTable } from "@workspace/db/schema";
import { eq, desc, sql, and, inArray, isNotNull } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth.js";
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
      siteDescription: s["site_description"] || "",
      siteKeywords: s["site_keywords"] || "",
      logoUrl: s["logo_url"] || "",
      faviconUrl: s["favicon_url"] || "",
      hotline: s["hotline"] || "",
      address: s["address"] || "",
      fanpageUrl: s["fanpage_url"] || "",
      copyrightLeft: s["copyright_left"] || "",
      copyrightRight: s["copyright_right"] || "",
      bankName: s["bank_name"] || "",
      bankAccountNumber: s["bank_account_number"] || "",
      bankAccountName: s["bank_account_name"] || "",
      bankBin: s["bank_bin"] || "",
      minDeposit: Number(s["min_deposit"] || "1"),
      maxDeposit: Number(s["max_deposit"] || "10000"),
      vndExchangeRate: Number(s["vnd_exchange_rate"] || "24000"),
      sepayEnabled: s["sepay_enabled"] === "true",
      maintenanceMode: s["maintenance_mode"] === "true",
      registrationOpen: s["registration_open"] !== "false",
    });
  } catch {
    return res.json({
      siteName: "SMM Pro", bankName: "", bankAccountNumber: "",
      bankAccountName: "", bankBin: "", minDeposit: 1,
      maxDeposit: 10000, vndExchangeRate: 24000, sepayEnabled: false,
    });
  }
});

// DB status check (admin only)
router.get("/admin/db-status", requireAdmin as any, async (_req: AuthRequest, res: any) => {
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
  const referralLink = `${process.env.SITE_URL || "https://vietool.cc"}/register?ref=${referralCode}`;
  
  const history = await db.select({
    userId: referralsTable.referredUserId,
    username: sql<string>`(SELECT username FROM users WHERE id = referrals.referred_user_id)`,
    commission: referralsTable.commission,
    createdAt: referralsTable.createdAt,
  }).from(referralsTable).where(eq(referralsTable.referrerId, req.userId!)).orderBy(desc(referralsTable.createdAt));

  const totalCommission = history.reduce((sum, r) => sum + Number(r.commission), 0);
  const commissionSetting = await db.select({ value: siteSettingsTable.value }).from(siteSettingsTable).where(sql`key = 'referral_commission'`).limit(1);
  const commissionRate = Number(commissionSetting[0]?.value || "5") / 100;
  return res.json({
    referralCode,
    referralLink,
    totalReferrals: history.length,
    totalCommission,
    commissionRate,
    referrals: history,
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

async function callProviderApi(baseUrl: string, apiKey: string, params: Record<string, string>, timeoutMs = 60000): Promise<Response> {
  const body = new URLSearchParams({ key: apiKey, ...params });
  return fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      "Origin": baseUrl.replace(/\/api.*/, ""),
      "Referer": baseUrl.replace(/\/api.*/, "") + "/",
    },
    body: body.toString(),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function syncOneProvider(provider: typeof providersTable.$inferSelect): Promise<{ added: number; updated: number; total: number; error?: string }> {
  const markup = 1 + (Number(provider.markupPercent) || 25) / 100;
  try {
    const resp = await callProviderApi(provider.baseUrl, provider.apiKey, { action: "services" }, 90000);
    const services: any[] = await resp.json();
    if (!Array.isArray(services)) return { added: 0, updated: 0, total: 0, error: "Provider không trả về danh sách" };

    // Category cache by name — creates from provider's own category field
    const categoryCache: Record<string, number> = {};
    const getOrCreateCategory = async (catName: string): Promise<number> => {
      const key = catName.trim() || "General";
      if (categoryCache[key]) return categoryCache[key];
      const existing = await db.select({ id: categoriesTable.id }).from(categoriesTable).where(eq(categoriesTable.name, key)).limit(1);
      if (existing[0]) { categoryCache[key] = existing[0].id; return existing[0].id; }
      const [{ count: catCount }] = await db.select({ count: sql<number>`count(*)` }).from(categoriesTable);
      const [newCat] = await db.insert(categoriesTable).values({ name: key, description: "", sortOrder: Number(catCount) + 1 }).returning();
      categoryCache[key] = newCat.id;
      return newCat.id;
    };

    let added = 0;
    let updated = 0;
    for (const s of services) {  // No limit
      try {
        const providerServiceId = String(s.service);
        const newRate = Number((Number(s.rate) * markup).toFixed(6)).toString();
        const min = Number(s.min) || 10;
        const max = Number(s.max) || 100000;
        const name = s.name || `Service #${s.service}`;
        const categoryId = await getOrCreateCategory(s.category || "General");

        const existing = await db.select({ id: servicesTable.id }).from(servicesTable)
          .where(and(eq(servicesTable.providerServiceId, providerServiceId), eq(servicesTable.providerId, provider.id))).limit(1);
        if (existing[0]) {
          await db.update(servicesTable).set({ rate: newRate, min, max, name, categoryId, status: "active", updatedAt: new Date() }).where(eq(servicesTable.id, existing[0].id));
          updated++;
        } else {
          await db.insert(servicesTable).values({
            categoryId, name, description: "",
            providerId: provider.id, providerServiceId, type: "default",
            rate: newRate, min, max, status: "active",
            refill: s.refill === true || s.refill === "true",
            cancel: s.cancel === true || s.cancel === "true",
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

function verifyCronSecret(provided: unknown, expected: string): boolean {
  if (!expected || !provided || typeof provided !== "string") return false;
  try {
    const a = Buffer.from(provided.padEnd(expected.length));
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return require("crypto").timingSafeEqual(a, b);
  } catch { return false; }
}

// GET /api/cron/sync-all?secret=xxx — returns DB stats immediately, syncs in background
router.get("/cron/sync-all", async (req, res) => {
  try {
    const settings = await getSettings();
    const cronSecret = settings["cron_secret"] || "";
    if (!verifyCronSecret(req.query.secret, cronSecret)) {
      return res.status(401).json({ error: "Invalid cron secret" });
    }

    const providers = await db.select().from(providersTable).where(eq(providersTable.status, "active"));
    const [{ catCount }] = await db.select({ catCount: sql<number>`count(*)` }).from(categoriesTable);
    const [{ svcCount }] = await db.select({ svcCount: sql<number>`count(*)` }).from(servicesTable);

    // Fetch provider balances quickly (short timeout)
    const balances = await Promise.allSettled(providers.map(async (p) => {
      try {
        const resp = await callProviderApi(p.baseUrl, p.apiKey, { action: "balance" }, 10000);
        const data = await resp.json() as any;
        return { provider: p.name, balance: data.balance ?? data.Balance ?? "-", currency: data.currency ?? "USD" };
      } catch {
        return { provider: p.name, balance: "-", currency: "USD" };
      }
    }));

    // Return immediately — sync runs in background
    res.json({
      success: true,
      message: `Đồng bộ đang chạy nền cho ${providers.length} provider(s)`,
      stats: {
        totalCategories: Number(catCount),
        totalServices: Number(svcCount),
        providerBalances: balances.map(r => r.status === "fulfilled" ? r.value : { balance: "-" }),
      },
      timestamp: new Date().toISOString(),
    });

    // Background sync (does not block the response)
    setImmediate(async () => {
      try {
        for (const p of providers) {
          await syncOneProvider(p).catch((e: any) => console.error(`[sync] ${p.name}:`, e.message));
        }
        console.log(`[cron/sync-all] Done syncing ${providers.length} providers`);
      } catch (e: any) {
        console.error("[cron/sync-all] background error:", e.message);
      }
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// GET /api/cron/sync/:id?secret=xxx  — sync single provider by ID
router.get("/cron/sync/:id", async (req, res) => {
  try {
    const settings = await getSettings();
    const cronSecret = settings["cron_secret"] || "";
    if (!verifyCronSecret(req.query.secret, cronSecret)) {
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

// GET /api/cron/update-orders?secret=xxx  — update order statuses from providers
router.get("/cron/update-orders", async (req, res) => {
  try {
    const settings = await getSettings();
    const cronSecret = settings["cron_secret"] || "";
    if (!verifyCronSecret(req.query.secret, cronSecret)) {
      return res.status(401).json({ error: "Invalid cron secret" });
    }

    // Fetch pending/processing orders with providerOrderId
    const pendingOrders = await db.select({
      id: ordersTable.id,
      providerId: servicesTable.providerId,
      providerOrderId: ordersTable.providerOrderId,
      status: ordersTable.status,
    })
      .from(ordersTable)
      .innerJoin(servicesTable, eq(servicesTable.id, ordersTable.serviceId))
      .where(and(
        inArray(ordersTable.status, ["pending", "processing"]),
        isNotNull(ordersTable.providerOrderId),
      ))
      .limit(200);

    if (!pendingOrders.length) {
      return res.json({ success: true, message: "No pending orders to update", updated: 0 });
    }

    // Group by provider
    const byProvider: Record<number, typeof pendingOrders> = {};
    for (const o of pendingOrders) {
      if (!o.providerId) continue;
      if (!byProvider[o.providerId]) byProvider[o.providerId] = [];
      byProvider[o.providerId].push(o);
    }

    const STATUS_MAP: Record<string, string> = {
      "Pending": "pending", "Processing": "processing", "In progress": "processing",
      "Active": "active", "Completed": "completed", "Partial": "partial",
      "Cancelled": "cancelled", "Canceled": "cancelled", "Failed": "failed",
    };

    let updated = 0;
    for (const [providerIdStr, orders] of Object.entries(byProvider)) {
      try {
        const [provider] = await db.select().from(providersTable).where(eq(providersTable.id, Number(providerIdStr))).limit(1);
        if (!provider?.baseUrl || !provider?.apiKey) continue;

        // Batch up to 100 order IDs per call
        const chunks: typeof orders[] = [];
        for (let i = 0; i < orders.length; i += 100) chunks.push(orders.slice(i, i + 100));

        for (const chunk of chunks) {
          const ids = chunk.map(o => o.providerOrderId!).join(",");
          const resp = await callProviderApi(provider.baseUrl, provider.apiKey, { action: "status", orders: ids }, 30000);
          const data = await resp.json() as Record<string, any>;

          for (const o of chunk) {
            const info = data[o.providerOrderId!];
            if (!info) continue;
            const newStatus = STATUS_MAP[info.status] || o.status;
            const startCount = info.start_count != null ? Number(info.start_count) : undefined;
            const remains = info.remains != null ? Number(info.remains) : undefined;
            if (newStatus !== o.status || startCount !== undefined || remains !== undefined) {
              await db.update(ordersTable).set({
                status: newStatus as any,
                ...(startCount !== undefined ? { startCount } : {}),
                ...(remains !== undefined ? { remains } : {}),
                updatedAt: new Date(),
              }).where(eq(ordersTable.id, o.id));
              if (newStatus !== o.status) {
                await db.insert(orderLogsTable).values({ orderId: o.id, status: newStatus, note: `Auto-updated from provider` });
              }
              updated++;
            }
          }
        }
      } catch (provErr: any) {
        console.error(`[cron/update-orders] Provider ${providerIdStr} error:`, provErr.message);
      }
    }

    return res.json({ success: true, checked: pendingOrders.length, updated, timestamp: new Date().toISOString() });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

export default router;
