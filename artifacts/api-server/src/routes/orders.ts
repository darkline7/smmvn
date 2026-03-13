import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, orderLogsTable, servicesTable, usersTable, transactionsTable, notificationsTable, providersTable } from "@workspace/db/schema";
import { eq, and, desc, ilike, sql, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import type { AuthRequest } from "../lib/auth.js";
import { callProviderApi } from "../lib/provider.js";
import { z } from "zod";

const router = Router();

router.get("/", requireAuth as any, async (req: AuthRequest, res: any) => {
  const { status, serviceId, page = "1", limit = "20", search } = req.query;
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));
  const offset = (pageNum - 1) * limitNum;

  let conditions: any[] = [eq(ordersTable.userId, req.userId!)];
  if (status) conditions.push(eq(ordersTable.status, status as any));
  if (serviceId) conditions.push(eq(ordersTable.serviceId, Number(serviceId)));
  if (search) conditions.push(ilike(ordersTable.link, `%${search}%`));

  const [orders, total] = await Promise.all([
    db.select({
      id: ordersTable.id,
      serviceId: ordersTable.serviceId,
      serviceName: sql<string>`(SELECT name FROM services WHERE id = orders.service_id)`,
      link: ordersTable.link,
      quantity: ordersTable.quantity,
      startCount: ordersTable.startCount,
      remains: ordersTable.remains,
      charge: ordersTable.charge,
      status: ordersTable.status,
      createdAt: ordersTable.createdAt,
      updatedAt: ordersTable.updatedAt,
    }).from(ordersTable)
      .where(and(...conditions))
      .orderBy(desc(ordersTable.createdAt))
      .limit(limitNum)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(and(...conditions)),
  ]);

  const totalCount = Number(total[0]?.count || 0);
  return res.json({
    orders,
    total: totalCount,
    page: pageNum,
    totalPages: Math.ceil(totalCount / limitNum),
  });
});

const createOrderSchema = z.object({
  serviceId: z.number().int().positive(),
  link: z.string().url(),
  quantity: z.number().int().positive(),
  runs: z.number().int().positive().optional(),
  interval: z.number().int().positive().optional(),
  comments: z.string().optional(),
  username: z.string().optional(),
});

router.post("/", requireAuth as any, async (req: AuthRequest, res: any) => {
  try {
    const data = createOrderSchema.parse(req.body);
    
    const service = await db.select().from(servicesTable).where(and(eq(servicesTable.id, data.serviceId), eq(servicesTable.status, "active"))).limit(1);
    if (!service[0]) return res.status(400).json({ error: "Service not found or inactive" });

    if (data.quantity < service[0].min || data.quantity > service[0].max) {
      return res.status(400).json({ error: `Quantity must be between ${service[0].min} and ${service[0].max}` });
    }

    const charge = (Number(service[0].rate) * data.quantity) / 1000;
    
    const user = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    if (!user[0] || Number(user[0].balance) < charge) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    const newBalance = Number(user[0].balance) - charge;
    
    const [order] = await db.insert(ordersTable).values({
      userId: req.userId!,
      serviceId: data.serviceId,
      link: data.link,
      quantity: data.quantity,
      charge: charge.toFixed(4),
      status: "pending",
      runs: data.runs,
      interval: data.interval,
      comments: data.comments,
      username: data.username,
    }).returning();

    await Promise.all([
      db.update(usersTable).set({ balance: newBalance.toFixed(4) }).where(eq(usersTable.id, req.userId!)),
      db.insert(transactionsTable).values({
        userId: req.userId!,
        type: "order",
        amount: (-charge).toFixed(4),
        balanceAfter: newBalance.toFixed(4),
        description: `Order #${order.id} - ${service[0].name}`,
        referenceId: order.id,
      }),
      db.insert(orderLogsTable).values({ orderId: order.id, status: "pending", note: "Order created" }),
    ]);

    // Forward order to provider API if service has a provider
    if (service[0].providerId && service[0].providerServiceId) {
      try {
        const provider = await db.select().from(providersTable).where(eq(providersTable.id, service[0].providerId)).limit(1);
        if (provider[0]?.baseUrl && provider[0]?.apiKey) {
          const params: Record<string, string> = {
            action: "add",
            service: service[0].providerServiceId,
            link: data.link,
            quantity: String(data.quantity),
          };
          if (data.runs) params.runs = String(data.runs);
          if (data.interval) params.interval = String(data.interval);
          if (data.comments) params.comments = data.comments;
          if (data.username) params.username = data.username;

          const resp = await callProviderApi(provider[0].baseUrl, provider[0].apiKey, params, 30000);
          const json = await resp.json() as any;

          if (json?.order) {
            await Promise.all([
              db.update(ordersTable).set({ providerOrderId: String(json.order), status: "processing", updatedAt: new Date() }).where(eq(ordersTable.id, order.id)),
              db.insert(orderLogsTable).values({ orderId: order.id, status: "processing", note: `Provider order ID: ${json.order}` }),
            ]);
          } else if (json?.error) {
            await db.insert(orderLogsTable).values({ orderId: order.id, status: "pending", note: `Provider error: ${json.error}` });
          }
        }
      } catch (provErr: any) {
        // Log but don't fail the order — it stays "pending" for manual review
        await db.insert(orderLogsTable).values({ orderId: order.id, status: "pending", note: `Provider call failed: ${provErr.message}` });
      }
    }

    const finalOrder = await db.select().from(ordersTable).where(eq(ordersTable.id, order.id)).limit(1);
    return res.status(201).json({
      ...finalOrder[0],
      serviceName: service[0].name,
    });
  } catch (e: any) {
    return res.status(400).json({ error: e.message || "Invalid request" });
  }
});

router.post("/mass", requireAuth as any, async (req: AuthRequest, res: any) => {
  const { orders } = req.body;
  if (!Array.isArray(orders)) return res.status(400).json({ error: "orders must be an array" });
  
  const results = [];
  for (let i = 0; i < orders.length; i++) {
    try {
      const data = createOrderSchema.parse(orders[i]);
      const service = await db.select().from(servicesTable).where(and(eq(servicesTable.id, data.serviceId), eq(servicesTable.status, "active"))).limit(1);
      if (!service[0]) { results.push({ index: i, success: false, error: "Service not found" }); continue; }
      if (data.quantity < service[0].min || data.quantity > service[0].max) { results.push({ index: i, success: false, error: `Qty must be ${service[0].min}-${service[0].max}` }); continue; }
      const charge = (Number(service[0].rate) * data.quantity) / 1000;
      const user = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
      if (!user[0] || Number(user[0].balance) < charge) { results.push({ index: i, success: false, error: "Insufficient balance" }); continue; }
      const newBalance = Number(user[0].balance) - charge;
      const [order] = await db.insert(ordersTable).values({ userId: req.userId!, serviceId: data.serviceId, link: data.link, quantity: data.quantity, charge: charge.toFixed(4), status: "pending" }).returning();
      await Promise.all([
        db.update(usersTable).set({ balance: newBalance.toFixed(4) }).where(eq(usersTable.id, req.userId!)),
        db.insert(transactionsTable).values({ userId: req.userId!, type: "order", amount: (-charge).toFixed(4), balanceAfter: newBalance.toFixed(4), description: `Order #${order.id}`, referenceId: order.id }),
      ]);
      results.push({ index: i, success: true, orderId: order.id });
    } catch (e: any) {
      results.push({ index: i, success: false, error: e.message });
    }
  }
  return res.json({ results });
});

router.get("/:id", requireAuth as any, async (req: AuthRequest, res: any) => {
  const order = await db.select({
    id: ordersTable.id,
    serviceId: ordersTable.serviceId,
    serviceName: sql<string>`(SELECT name FROM services WHERE id = orders.service_id)`,
    link: ordersTable.link,
    quantity: ordersTable.quantity,
    startCount: ordersTable.startCount,
    remains: ordersTable.remains,
    charge: ordersTable.charge,
    status: ordersTable.status,
    createdAt: ordersTable.createdAt,
    updatedAt: ordersTable.updatedAt,
  }).from(ordersTable).where(and(eq(ordersTable.id, Number(req.params.id)), eq(ordersTable.userId, req.userId!))).limit(1);
  if (!order[0]) return res.status(404).json({ error: "Order not found" });

  const logs = await db.select().from(orderLogsTable).where(eq(orderLogsTable.orderId, order[0].id)).orderBy(orderLogsTable.createdAt);
  return res.json({ ...order[0], logs });
});

router.post("/:id/refill", requireAuth as any, async (req: AuthRequest, res: any) => {
  const order = await db.select().from(ordersTable).where(and(eq(ordersTable.id, Number(req.params.id)), eq(ordersTable.userId, req.userId!))).limit(1);
  if (!order[0]) return res.status(404).json({ error: "Order not found" });
  const service = await db.select().from(servicesTable).where(eq(servicesTable.id, order[0].serviceId)).limit(1);
  if (!service[0]?.refill) return res.status(400).json({ error: "This service does not support refill" });
  await db.insert(orderLogsTable).values({ orderId: order[0].id, status: "refill_requested", note: "Refill requested by user" });
  return res.json({ success: true, message: "Refill requested" });
});

router.post("/:id/cancel", requireAuth as any, async (req: AuthRequest, res: any) => {
  const order = await db.select().from(ordersTable).where(and(eq(ordersTable.id, Number(req.params.id)), eq(ordersTable.userId, req.userId!))).limit(1);
  if (!order[0]) return res.status(404).json({ error: "Order not found" });
  if (!["pending", "processing"].includes(order[0].status)) return res.status(400).json({ error: "Order cannot be cancelled" });
  const service = await db.select().from(servicesTable).where(eq(servicesTable.id, order[0].serviceId)).limit(1);
  if (!service[0]?.cancel) return res.status(400).json({ error: "This service does not support cancellation" });
  await db.update(ordersTable).set({ status: "cancelled", updatedAt: new Date() }).where(eq(ordersTable.id, order[0].id));
  await db.insert(orderLogsTable).values({ orderId: order[0].id, status: "cancelled", note: "Cancelled by user" });
  return res.json({ success: true, message: "Order cancelled" });
});

export default router;
