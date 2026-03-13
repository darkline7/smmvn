import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable, ordersTable, servicesTable, categoriesTable, providersTable,
  depositsTable, transactionsTable, ticketsTable, ticketMessagesTable,
  announcementsTable, apiRequestLogsTable, siteSettingsTable, orderLogsTable,
  notificationsTable,
} from "@workspace/db/schema";
import { eq, and, desc, ilike, sql, or, gte, lte } from "drizzle-orm";
import { requireAdmin } from "../lib/auth.js";
import type { AuthRequest } from "../lib/auth.js";
import { z } from "zod";
import { sendTelegramMessage } from "../lib/telegram.js";

const router = Router();
router.use(requireAdmin as any);

// STATS
router.get("/stats", async (req: AuthRequest, res: any) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const [users, orders, revenue, pendingDeposits, openTickets, activeServices, todayOrders, todayRevenue] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(usersTable),
    db.select({ count: sql<number>`count(*)` }).from(ordersTable),
    db.select({ sum: sql<number>`COALESCE(SUM(charge::numeric), 0)` }).from(ordersTable),
    db.select({ count: sql<number>`count(*)` }).from(depositsTable).where(eq(depositsTable.status, "pending")),
    db.select({ count: sql<number>`count(*)` }).from(ticketsTable).where(eq(ticketsTable.status, "open")),
    db.select({ count: sql<number>`count(*)` }).from(servicesTable).where(eq(servicesTable.status, "active")),
    db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(gte(ordersTable.createdAt, todayStart)),
    db.select({ sum: sql<number>`COALESCE(SUM(charge::numeric), 0)` }).from(ordersTable).where(gte(ordersTable.createdAt, todayStart)),
  ]);

  return res.json({
    totalUsers: Number(users[0]?.count || 0),
    totalOrders: Number(orders[0]?.count || 0),
    totalRevenue: Number(revenue[0]?.sum || 0),
    pendingDeposits: Number(pendingDeposits[0]?.count || 0),
    openTickets: Number(openTickets[0]?.count || 0),
    activeServices: Number(activeServices[0]?.count || 0),
    todayOrders: Number(todayOrders[0]?.count || 0),
    todayRevenue: Number(todayRevenue[0]?.sum || 0),
  });
});

// USERS
router.get("/users", async (req: AuthRequest, res: any) => {
  const { search, page = "1", limit = "20", status } = req.query;
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Number(limit));
  const offset = (pageNum - 1) * limitNum;

  let conditions: any[] = [];
  if (search) conditions.push(or(ilike(usersTable.email, `%${search}%`), ilike(usersTable.username, `%${search}%`)));
  if (status === "banned") conditions.push(eq(usersTable.banned, true));
  if (status === "active") conditions.push(eq(usersTable.banned, false));

  const where = conditions.length ? and(...conditions) : undefined;
  
  const [users, total] = await Promise.all([
    db.select({
      id: usersTable.id, email: usersTable.email, username: usersTable.username, role: usersTable.role,
      balance: usersTable.balance, banned: usersTable.banned, createdAt: usersTable.createdAt,
      totalOrders: sql<number>`(SELECT COUNT(*) FROM orders WHERE user_id = users.id)`,
      totalSpend: sql<number>`(SELECT COALESCE(SUM(charge::numeric), 0) FROM orders WHERE user_id = users.id)`,
    }).from(usersTable).where(where).orderBy(desc(usersTable.createdAt)).limit(limitNum).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(usersTable).where(where),
  ]);

  return res.json({ users, total: Number(total[0]?.count || 0), page: pageNum, totalPages: Math.ceil(Number(total[0]?.count || 0) / limitNum) });
});

router.get("/users/:id", async (req: AuthRequest, res: any) => {
  const user = await db.select().from(usersTable).where(eq(usersTable.id, Number(req.params.id))).limit(1);
  if (!user[0]) return res.status(404).json({ error: "Not found" });
  const { passwordHash, ...safeUser } = user[0];
  const [recentOrders, recentTransactions] = await Promise.all([
    db.select({
      id: ordersTable.id, serviceId: ordersTable.serviceId,
      serviceName: sql<string>`(SELECT name FROM services WHERE id = orders.service_id)`,
      link: ordersTable.link, quantity: ordersTable.quantity, charge: ordersTable.charge, status: ordersTable.status, createdAt: ordersTable.createdAt,
    }).from(ordersTable).where(eq(ordersTable.userId, Number(req.params.id))).orderBy(desc(ordersTable.createdAt)).limit(5),
    db.select().from(transactionsTable).where(eq(transactionsTable.userId, Number(req.params.id))).orderBy(desc(transactionsTable.createdAt)).limit(5),
  ]);
  return res.json({ ...safeUser, recentOrders, recentTransactions });
});

router.patch("/users/:id", async (req: AuthRequest, res: any) => {
  const { username, role, banned } = req.body;
  const updates: any = { updatedAt: new Date() };
  if (username !== undefined) updates.username = username;
  if (role !== undefined) updates.role = role;
  if (banned !== undefined) updates.banned = banned;
  const updated = await db.update(usersTable).set(updates).where(eq(usersTable.id, Number(req.params.id))).returning();
  if (!updated[0]) return res.status(404).json({ error: "Not found" });
  const { passwordHash, ...safeUser } = updated[0];
  return res.json(safeUser);
});

router.post("/users/:id/balance", async (req: AuthRequest, res: any) => {
  const { amount, note } = req.body;
  if (typeof amount !== "number") return res.status(400).json({ error: "amount required" });
  const user = await db.select().from(usersTable).where(eq(usersTable.id, Number(req.params.id))).limit(1);
  if (!user[0]) return res.status(404).json({ error: "Not found" });
  const newBalance = Number(user[0].balance) + amount;
  if (newBalance < 0) return res.status(400).json({ error: "Balance cannot go negative" });
  await Promise.all([
    db.update(usersTable).set({ balance: newBalance.toFixed(4) }).where(eq(usersTable.id, Number(req.params.id))),
    db.insert(transactionsTable).values({ userId: Number(req.params.id), type: "adjustment", amount: amount.toFixed(4), balanceAfter: newBalance.toFixed(4), description: note || "Admin adjustment" }),
  ]);
  return res.json({ success: true, message: "Balance adjusted" });
});

// ORDERS
router.get("/orders", async (req: AuthRequest, res: any) => {
  const { status, userId, serviceId, page = "1", limit = "20", search, dateFrom, dateTo } = req.query;
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Number(limit));
  const offset = (pageNum - 1) * limitNum;

  let conditions: any[] = [];
  if (status) conditions.push(eq(ordersTable.status, status as any));
  if (userId) conditions.push(eq(ordersTable.userId, Number(userId)));
  if (serviceId) conditions.push(eq(ordersTable.serviceId, Number(serviceId)));
  if (search) conditions.push(ilike(ordersTable.link, `%${search}%`));
  if (dateFrom) conditions.push(gte(ordersTable.createdAt, new Date(dateFrom as string)));
  if (dateTo) conditions.push(lte(ordersTable.createdAt, new Date(dateTo as string)));

  const where = conditions.length ? and(...conditions) : undefined;

  const [orders, total] = await Promise.all([
    db.select({
      id: ordersTable.id, serviceId: ordersTable.serviceId,
      serviceName: sql<string>`(SELECT name FROM services WHERE id = orders.service_id)`,
      userId: ordersTable.userId,
      username: sql<string>`(SELECT username FROM users WHERE id = orders.user_id)`,
      link: ordersTable.link, quantity: ordersTable.quantity, startCount: ordersTable.startCount,
      remains: ordersTable.remains, charge: ordersTable.charge, status: ordersTable.status,
      createdAt: ordersTable.createdAt, updatedAt: ordersTable.updatedAt,
    }).from(ordersTable).where(where).orderBy(desc(ordersTable.createdAt)).limit(limitNum).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(where),
  ]);

  return res.json({ orders, total: Number(total[0]?.count || 0), page: pageNum, totalPages: Math.ceil(Number(total[0]?.count || 0) / limitNum) });
});

router.patch("/orders/:id", async (req: AuthRequest, res: any) => {
  const { status, startCount, remains, note } = req.body;
  if (!status) return res.status(400).json({ error: "status required" });
  const updates: any = { status, updatedAt: new Date() };
  if (startCount !== undefined) updates.startCount = startCount;
  if (remains !== undefined) updates.remains = remains;
  const updated = await db.update(ordersTable).set(updates).where(eq(ordersTable.id, Number(req.params.id))).returning();
  if (!updated[0]) return res.status(404).json({ error: "Not found" });
  await db.insert(orderLogsTable).values({ orderId: Number(req.params.id), status, note: note || `Status changed to ${status} by admin` });
  return res.json({ ...updated[0], serviceName: "" });
});

// SERVICES
router.get("/services", async (req: AuthRequest, res: any) => {
  const { categoryId, providerId, search, status } = req.query;
  let conditions: any[] = [];
  if (categoryId) conditions.push(eq(servicesTable.categoryId, Number(categoryId)));
  if (providerId) conditions.push(eq(servicesTable.providerId, Number(providerId)));
  if (search) conditions.push(ilike(servicesTable.name, `%${search}%`));
  if (status) conditions.push(eq(servicesTable.status, status as any));
  const where = conditions.length ? and(...conditions) : undefined;
  const services = await db.select({
    ...servicesTable,
    categoryName: sql<string>`(SELECT name FROM categories WHERE id = services.category_id)`,
    providerName: sql<string>`(SELECT name FROM providers WHERE id = services.provider_id)`,
  }).from(servicesTable).where(where).orderBy(servicesTable.sortOrder, servicesTable.name);
  return res.json({ services });
});

router.post("/services", async (req: AuthRequest, res: any) => {
  try {
    const [service] = await db.insert(servicesTable).values(req.body).returning();
    return res.status(201).json(service);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

router.patch("/services/:id", async (req: AuthRequest, res: any) => {
  const updated = await db.update(servicesTable).set({ ...req.body, updatedAt: new Date() }).where(eq(servicesTable.id, Number(req.params.id))).returning();
  if (!updated[0]) return res.status(404).json({ error: "Not found" });
  return res.json(updated[0]);
});

router.delete("/services/:id", async (req: AuthRequest, res: any) => {
  await db.update(servicesTable).set({ status: "inactive" }).where(eq(servicesTable.id, Number(req.params.id)));
  return res.json({ success: true, message: "Service deactivated" });
});

// CATEGORIES
router.get("/categories", async (req: AuthRequest, res: any) => {
  const categories = await db.select({
    id: categoriesTable.id, name: categoriesTable.name, description: categoriesTable.description,
    sortOrder: categoriesTable.sortOrder, active: categoriesTable.active, createdAt: categoriesTable.createdAt,
    serviceCount: sql<number>`(SELECT COUNT(*) FROM services WHERE category_id = categories.id)`,
  }).from(categoriesTable).orderBy(categoriesTable.sortOrder, categoriesTable.name);
  return res.json({ categories });
});

router.post("/categories", async (req: AuthRequest, res: any) => {
  try {
    const [cat] = await db.insert(categoriesTable).values(req.body).returning();
    return res.status(201).json(cat);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

router.patch("/categories/:id", async (req: AuthRequest, res: any) => {
  const updated = await db.update(categoriesTable).set({ ...req.body, updatedAt: new Date() }).where(eq(categoriesTable.id, Number(req.params.id))).returning();
  if (!updated[0]) return res.status(404).json({ error: "Not found" });
  return res.json(updated[0]);
});

router.delete("/categories/:id", async (req: AuthRequest, res: any) => {
  await db.update(categoriesTable).set({ active: false }).where(eq(categoriesTable.id, Number(req.params.id)));
  return res.json({ success: true, message: "Category deactivated" });
});

// PROVIDERS
router.get("/providers", async (req: AuthRequest, res: any) => {
  const rows = await db.select({
    id: providersTable.id,
    name: providersTable.name,
    baseUrl: providersTable.baseUrl,
    status: providersTable.status,
    markupPercent: providersTable.markupPercent,
    lastSyncAt: providersTable.lastSyncAt,
    notes: providersTable.notes,
    createdAt: providersTable.createdAt,
    serviceCount: sql<number>`(SELECT COUNT(*) FROM services WHERE provider_id = providers.id)`,
  }).from(providersTable).orderBy(providersTable.name);
  const providers = rows.map(({ baseUrl, ...rest }) => ({ ...rest, url: baseUrl }));
  return res.json({ providers });
});

router.post("/providers", async (req: AuthRequest, res: any) => {
  try {
    const { url, apiKey, name, notes, markupPercent } = req.body;
    const [provider] = await db.insert(providersTable).values({
      name, baseUrl: url, apiKey, notes: notes || "",
      markupPercent: markupPercent ? String(markupPercent) : "25",
    }).returning();
    const { apiKey: _ak, baseUrl: _bu, ...safe } = provider;
    return res.status(201).json({ ...safe, url });
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

router.patch("/providers/:id", async (req: AuthRequest, res: any) => {
  const { url, apiKey, name, notes, status, markupPercent } = req.body;
  const updateData: any = { updatedAt: new Date() };
  if (name !== undefined) updateData.name = name;
  if (url !== undefined) updateData.baseUrl = url;
  if (apiKey && apiKey.trim()) updateData.apiKey = apiKey;
  if (notes !== undefined) updateData.notes = notes;
  if (status !== undefined) updateData.status = status;
  if (markupPercent !== undefined) updateData.markupPercent = String(markupPercent);
  const updated = await db.update(providersTable).set(updateData).where(eq(providersTable.id, Number(req.params.id))).returning();
  if (!updated[0]) return res.status(404).json({ error: "Not found" });
  const { apiKey: _ak, baseUrl, ...safe } = updated[0];
  return res.json({ ...safe, url: baseUrl });
});

router.delete("/providers/:id", async (req: AuthRequest, res: any) => {
  await db.delete(providersTable).where(eq(providersTable.id, Number(req.params.id)));
  return res.json({ success: true });
});

router.post("/providers/:id/test", async (req: AuthRequest, res: any) => {
  const provider = await db.select().from(providersTable).where(eq(providersTable.id, Number(req.params.id))).limit(1);
  if (!provider[0]) return res.status(404).json({ error: "Not found" });
  try {
    const resp = await fetch(`${provider[0].baseUrl}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `key=${encodeURIComponent(provider[0].apiKey)}&action=balance`,
      signal: AbortSignal.timeout(12000),
    });
    const data: any = await resp.json();
    if (data?.balance !== undefined) {
      await db.update(providersTable).set({ status: "active", updatedAt: new Date() }).where(eq(providersTable.id, provider[0].id));
      return res.json({ success: true, balance: data.balance });
    }
    return res.json({ success: false, error: data?.error || "Không nhận được số dư từ provider" });
  } catch (e: any) {
    return res.json({ success: false, error: e.message });
  }
});

// Shared sync logic — groups services by their own category name, no limit
async function syncProviderServices(provider: any): Promise<{ added: number; updated: number; total: number; error?: string }> {
  const markup = 1 + (Number(provider.markupPercent) || 25) / 100;
  try {
    const resp = await fetch(`${provider.baseUrl}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `key=${encodeURIComponent(provider.apiKey)}&action=services`,
      signal: AbortSignal.timeout(60000),
    });
    const services: any[] = await resp.json();
    if (!Array.isArray(services)) return { added: 0, updated: 0, total: 0, error: "Provider không trả về danh sách dịch vụ" };

    // Cache category IDs by category name to avoid N+1 queries
    const categoryCache: Record<string, number> = {};
    const getOrCreateCategory = async (catName: string): Promise<number> => {
      const key = catName.trim() || "General";
      if (categoryCache[key]) return categoryCache[key];
      const existing = await db.select({ id: categoriesTable.id }).from(categoriesTable).where(eq(categoriesTable.name, key)).limit(1);
      if (existing[0]) {
        categoryCache[key] = existing[0].id;
        return existing[0].id;
      }
      // Count existing categories for sort order
      const [{ count: catCount }] = await db.select({ count: sql<number>`count(*)` }).from(categoriesTable);
      const [newCat] = await db.insert(categoriesTable).values({
        name: key,
        description: "",
        sortOrder: Number(catCount) + 1,
      }).returning();
      categoryCache[key] = newCat.id;
      return newCat.id;
    };

    let added = 0;
    let updated = 0;
    for (const s of services) {  // No limit — import ALL services
      try {
        const providerServiceId = String(s.service);
        const newRate = Number((Number(s.rate) * markup).toFixed(6)).toString();
        const min = Number(s.min) || 10;
        const max = Number(s.max) || 100000;
        const name = s.name || `Service #${s.service}`;
        // Use provider's category name — hides source from users
        const categoryId = await getOrCreateCategory(s.category || "General");

        const existing = await db.select({ id: servicesTable.id })
          .from(servicesTable)
          .where(and(eq(servicesTable.providerServiceId, providerServiceId), eq(servicesTable.providerId, provider.id)))
          .limit(1);

        if (existing[0]) {
          await db.update(servicesTable).set({
            rate: newRate, min, max, name, categoryId,
            status: "active", // Re-activate if previously inactive
            updatedAt: new Date(),
          }).where(eq(servicesTable.id, existing[0].id));
          updated++;
        } else {
          await db.insert(servicesTable).values({
            categoryId, name, description: "",
            providerId: provider.id, providerServiceId, type: "default",
            rate: newRate, min, max,
            status: "active",  // Active immediately so users can see and order
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

router.post("/providers/:id/sync", async (req: AuthRequest, res: any) => {
  const [provider] = await db.select().from(providersTable).where(eq(providersTable.id, Number(req.params.id))).limit(1);
  if (!provider) return res.status(404).json({ error: "Not found" });
  const result = await syncProviderServices(provider);
  if (result.error) return res.json({ success: false, ...result });
  return res.json({ success: true, ...result, message: `Thêm ${result.added} mới, cập nhật giá ${result.updated} dịch vụ từ ${provider.name}` });
});

// Activate all inactive services for a provider instantly (no re-sync needed)
router.post("/providers/:id/activate", async (req: AuthRequest, res: any) => {
  const id = Number(req.params.id);
  const result = await db.update(servicesTable)
    .set({ status: "active", updatedAt: new Date() })
    .where(and(eq(servicesTable.providerId, id), eq(servicesTable.status, "inactive")));
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(servicesTable).where(eq(servicesTable.providerId, id));
  return res.json({ success: true, activated: Number(count), message: `Đã kích hoạt dịch vụ. Tổng: ${count}` });
});

// Sync all active providers — for cron
router.post("/providers/sync-all", async (req: AuthRequest, res: any) => {
  const providers = await db.select().from(providersTable).where(eq(providersTable.status, "active"));
  const results = await Promise.allSettled(providers.map(p => syncProviderServices(p)));
  const summary = results.map((r, i) => ({
    provider: providers[i].name,
    ...(r.status === "fulfilled" ? r.value : { error: String(r.reason) }),
  }));
  return res.json({ success: true, results: summary });
});

// PAYMENTS
router.get("/payments", async (req: AuthRequest, res: any) => {
  const { status, page = "1", limit = "20" } = req.query;
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Number(limit));
  const offset = (pageNum - 1) * limitNum;
  
  let conditions: any[] = [];
  if (status) conditions.push(eq(depositsTable.status, status as any));
  const where = conditions.length ? and(...conditions) : undefined;

  const [deposits, total] = await Promise.all([
    db.select({
      id: depositsTable.id, userId: depositsTable.userId, amount: depositsTable.amount,
      method: depositsTable.method, status: depositsTable.status, proofUrl: depositsTable.proofUrl,
      note: depositsTable.note, createdAt: depositsTable.createdAt,
      username: sql<string>`(SELECT username FROM users WHERE id = deposits.user_id)`,
      email: sql<string>`(SELECT email FROM users WHERE id = deposits.user_id)`,
    }).from(depositsTable).where(where).orderBy(desc(depositsTable.createdAt)).limit(limitNum).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(depositsTable).where(where),
  ]);

  return res.json({ deposits, total: Number(total[0]?.count || 0), page: pageNum, totalPages: Math.ceil(Number(total[0]?.count || 0) / limitNum) });
});

router.post("/payments/:id/approve", async (req: AuthRequest, res: any) => {
  const deposit = await db.select().from(depositsTable).where(eq(depositsTable.id, Number(req.params.id))).limit(1);
  if (!deposit[0]) return res.status(404).json({ error: "Not found" });
  if (deposit[0].status !== "pending") return res.status(400).json({ error: "Deposit already processed" });
  
  const amount = req.body?.amount ? Number(req.body.amount) : Number(deposit[0].amount);
  const user = await db.select().from(usersTable).where(eq(usersTable.id, deposit[0].userId)).limit(1);
  if (!user[0]) return res.status(404).json({ error: "User not found" });
  
  const newBalance = Number(user[0].balance) + amount;
  await Promise.all([
    db.update(depositsTable).set({ status: "approved", adminNote: req.body?.note, updatedAt: new Date() }).where(eq(depositsTable.id, deposit[0].id)),
    db.update(usersTable).set({ balance: newBalance.toFixed(4) }).where(eq(usersTable.id, deposit[0].userId)),
    db.insert(transactionsTable).values({ userId: deposit[0].userId, type: "deposit", amount: amount.toFixed(4), balanceAfter: newBalance.toFixed(4), description: `Deposit approved #${deposit[0].id}`, referenceId: deposit[0].id }),
  ]);
  return res.json({ success: true, message: "Deposit approved" });
});

router.post("/payments/:id/reject", async (req: AuthRequest, res: any) => {
  const deposit = await db.select().from(depositsTable).where(eq(depositsTable.id, Number(req.params.id))).limit(1);
  if (!deposit[0]) return res.status(404).json({ error: "Not found" });
  if (deposit[0].status !== "pending") return res.status(400).json({ error: "Deposit already processed" });
  await db.update(depositsTable).set({ status: "rejected", adminNote: req.body?.reason, updatedAt: new Date() }).where(eq(depositsTable.id, deposit[0].id));
  return res.json({ success: true, message: "Deposit rejected" });
});

// TICKETS
router.get("/tickets", async (req: AuthRequest, res: any) => {
  const { status, page = "1", limit = "20" } = req.query;
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Number(limit));
  const offset = (pageNum - 1) * limitNum;
  
  let conditions: any[] = [];
  if (status) conditions.push(eq(ticketsTable.status, status as any));
  const where = conditions.length ? and(...conditions) : undefined;

  const [tickets, total] = await Promise.all([
    db.select({
      id: ticketsTable.id, subject: ticketsTable.subject, status: ticketsTable.status,
      priority: ticketsTable.priority, createdAt: ticketsTable.createdAt, updatedAt: ticketsTable.updatedAt,
      userId: ticketsTable.userId,
      username: sql<string>`(SELECT username FROM users WHERE id = tickets.user_id)`,
      messageCount: sql<number>`(SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = tickets.id)`,
    }).from(ticketsTable).where(where).orderBy(desc(ticketsTable.updatedAt)).limit(limitNum).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(ticketsTable).where(where),
  ]);

  return res.json({ tickets, total: Number(total[0]?.count || 0), page: pageNum, totalPages: Math.ceil(Number(total[0]?.count || 0) / limitNum) });
});

router.get("/tickets/:id", async (req: AuthRequest, res: any) => {
  const ticket = await db.select().from(ticketsTable).where(eq(ticketsTable.id, Number(req.params.id))).limit(1);
  if (!ticket[0]) return res.status(404).json({ error: "Not found" });
  const messages = await db.select().from(ticketMessagesTable).where(eq(ticketMessagesTable.ticketId, ticket[0].id)).orderBy(ticketMessagesTable.createdAt);
  return res.json({ ...ticket[0], messages });
});

router.patch("/tickets/:id/status", async (req: AuthRequest, res: any) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: "status required" });
  await db.update(ticketsTable).set({ status, updatedAt: new Date() }).where(eq(ticketsTable.id, Number(req.params.id)));
  return res.json({ success: true, message: "Ticket updated" });
});

router.post("/tickets/:id/reply", async (req: AuthRequest, res: any) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "message required" });
  const [msg] = await db.insert(ticketMessagesTable).values({
    ticketId: Number(req.params.id),
    userId: req.userId!,
    message,
    isAdmin: true,
  }).returning();
  await db.update(ticketsTable).set({ status: "open", updatedAt: new Date() }).where(eq(ticketsTable.id, Number(req.params.id)));
  return res.status(201).json(msg);
});

// ANNOUNCEMENTS
router.get("/announcements", async (req: AuthRequest, res: any) => {
  const announcements = await db.select().from(announcementsTable).orderBy(desc(announcementsTable.createdAt));
  return res.json({ announcements });
});

router.post("/announcements", async (req: AuthRequest, res: any) => {
  try {
    const [ann] = await db.insert(announcementsTable).values(req.body).returning();
    return res.status(201).json(ann);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

router.patch("/announcements/:id", async (req: AuthRequest, res: any) => {
  const updated = await db.update(announcementsTable).set({ ...req.body, updatedAt: new Date() }).where(eq(announcementsTable.id, Number(req.params.id))).returning();
  if (!updated[0]) return res.status(404).json({ error: "Not found" });
  return res.json(updated[0]);
});

router.delete("/announcements/:id", async (req: AuthRequest, res: any) => {
  await db.delete(announcementsTable).where(eq(announcementsTable.id, Number(req.params.id)));
  return res.json({ success: true, message: "Deleted" });
});

// API LOGS
router.get("/api-logs", async (req: AuthRequest, res: any) => {
  const { userId, action, status, page = "1", limit = "50" } = req.query;
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(200, Number(limit));
  const offset = (pageNum - 1) * limitNum;

  let conditions: any[] = [];
  if (userId) conditions.push(eq(apiRequestLogsTable.userId, Number(userId)));
  if (action) conditions.push(eq(apiRequestLogsTable.action, action as string));
  if (status) conditions.push(eq(apiRequestLogsTable.status, status as any));
  const where = conditions.length ? and(...conditions) : undefined;

  const [logs, total] = await Promise.all([
    db.select({
      id: apiRequestLogsTable.id, userId: apiRequestLogsTable.userId, action: apiRequestLogsTable.action,
      requestBody: apiRequestLogsTable.requestBody, responseBody: apiRequestLogsTable.responseBody,
      status: apiRequestLogsTable.status, ipAddress: apiRequestLogsTable.ipAddress, createdAt: apiRequestLogsTable.createdAt,
      username: sql<string>`(SELECT username FROM users WHERE id = api_request_logs.user_id)`,
    }).from(apiRequestLogsTable).where(where).orderBy(desc(apiRequestLogsTable.createdAt)).limit(limitNum).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(apiRequestLogsTable).where(where),
  ]);

  return res.json({ logs, total: Number(total[0]?.count || 0), page: pageNum, totalPages: Math.ceil(Number(total[0]?.count || 0) / limitNum) });
});

// SETTINGS
router.get("/settings", async (req: AuthRequest, res: any) => {
  const settings = await db.select().from(siteSettingsTable);
  const result: Record<string, string> = {};
  settings.forEach(s => { result[s.key] = s.value || ""; });
  return res.json(result);
});

router.patch("/settings", async (req: AuthRequest, res: any) => {
  const entries = Object.entries(req.body);
  for (const [key, value] of entries) {
    await db.insert(siteSettingsTable).values({ key, value: String(value) }).onConflictDoUpdate({ target: siteSettingsTable.key, set: { value: String(value), updatedAt: new Date() } });
  }
  return res.json(req.body);
});

// Aliases for admin payments page URL format
router.post("/deposits/:id/approved", async (req: AuthRequest, res: any) => {
  const deposit = await db.select().from(depositsTable).where(eq(depositsTable.id, Number(req.params.id))).limit(1);
  if (!deposit[0]) return res.status(404).json({ error: "Not found" });
  if (deposit[0].status !== "pending") return res.status(400).json({ error: "Already processed" });
  const user = await db.select().from(usersTable).where(eq(usersTable.id, deposit[0].userId)).limit(1);
  if (!user[0]) return res.status(404).json({ error: "User not found" });
  const amount = Number(deposit[0].amount);
  const newBalance = Number(user[0].balance) + amount;
  await db.transaction(async tx => {
    await tx.update(depositsTable).set({ status: "approved", adminNote: req.body?.adminNote || "Approved by admin", updatedAt: new Date() }).where(eq(depositsTable.id, deposit[0].id));
    await tx.update(usersTable).set({ balance: newBalance.toFixed(4) }).where(eq(usersTable.id, deposit[0].userId));
    await tx.insert(transactionsTable).values({ userId: deposit[0].userId, type: "deposit", amount: amount.toFixed(4), balanceAfter: newBalance.toFixed(4), description: `Deposit approved #${deposit[0].id}`, referenceId: deposit[0].id });
    await tx.insert(notificationsTable).values({ userId: deposit[0].userId, type: "deposit", title: "Nạp tiền thành công", message: `Tài khoản của bạn đã được cộng $${amount.toFixed(2)}. Số dư mới: $${newBalance.toFixed(2)}` });
  });
  return res.json({ success: true });
});

router.post("/deposits/:id/rejected", async (req: AuthRequest, res: any) => {
  const deposit = await db.select().from(depositsTable).where(eq(depositsTable.id, Number(req.params.id))).limit(1);
  if (!deposit[0]) return res.status(404).json({ error: "Not found" });
  if (deposit[0].status !== "pending") return res.status(400).json({ error: "Already processed" });
  await db.update(depositsTable).set({ status: "rejected", adminNote: req.body?.adminNote || "Rejected by admin", updatedAt: new Date() }).where(eq(depositsTable.id, deposit[0].id));
  return res.json({ success: true });
});

// Alias for orders status update
router.patch("/orders/:id/status", async (req: AuthRequest, res: any) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: "status required" });
  const updated = await db.update(ordersTable).set({ status, updatedAt: new Date() }).where(eq(ordersTable.id, Number(req.params.id))).returning();
  if (!updated[0]) return res.status(404).json({ error: "Not found" });
  await db.insert(orderLogsTable).values({ orderId: Number(req.params.id), status, note: `Status changed to ${status} by admin` });
  return res.json(updated[0]);
});

// Test Telegram
router.post("/test-telegram", async (req: AuthRequest, res: any) => {
  try {
    const settings = await db.select().from(siteSettingsTable);
    const s: Record<string, string> = {};
    settings.forEach(r => { s[r.key] = r.value || ""; });
    const token = s["telegram_bot_token"];
    const chatId = s["telegram_admin_chat_id"];
    if (!token || !chatId) return res.status(400).json({ ok: false, error: "Telegram bot token and chat ID not configured" });
    const result = await sendTelegramMessage(token, chatId, "🧪 *Test Telegram* từ SMM Pro Admin Panel\n\nCấu hình Telegram hoạt động tốt! ✅");
    return res.json({ ok: result, error: result ? null : "Failed to send message" });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
