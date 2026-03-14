import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, servicesTable, ordersTable, transactionsTable, orderLogsTable, apiRequestLogsTable } from "@workspace/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import type { Request, Response } from "express";

const router = Router();

async function logRequest(userId: number | null, action: string, requestBody: any, responseBody: any, status: "success" | "error", ipAddress: string) {
  try {
    await db.insert(apiRequestLogsTable).values({ userId, action, requestBody, responseBody, status, ipAddress });
  } catch {}
}

async function getUser(key: string) {
  const users = await db.select().from(usersTable).where(eq(usersTable.apiKey, key)).limit(1);
  return users[0] || null;
}

router.post("/", async (req: Request, res: Response) => {
  const body = req.body || {};
  const { key, action } = body;
  const ip = req.ip || "";

  if (!key) {
    const resp = { error: "API key is required" };
    return res.status(401).json(resp);
  }
  if (!action) {
    const resp = { error: "Action is required" };
    return res.status(400).json(resp);
  }

  const user = await getUser(key);
  if (!user || user.banned) {
    const resp = { error: "Invalid API key" };
    await logRequest(null, action, body, resp, "error", ip);
    return res.status(401).json(resp);
  }

  let responseData: any = null;
  let isError = false;

  try {
    switch (action) {
      case "services": {
        const services = await db.select({
          service: servicesTable.id,
          name: servicesTable.name,
          type: servicesTable.type,
          rate: servicesTable.rate,
          min: servicesTable.min,
          max: servicesTable.max,
          category: sql<string>`(SELECT name FROM categories WHERE id = services.category_id)`,
          refill: servicesTable.refill,
          cancel: servicesTable.cancel,
          dripfeed: servicesTable.dripfeed,
        }).from(servicesTable).where(eq(servicesTable.status, "active")).orderBy(servicesTable.sortOrder, servicesTable.name);
        responseData = services;
        break;
      }
      
      case "balance": {
        responseData = { balance: Number(user.balance), currency: user.currency };
        break;
      }
      
      case "add": {
        const { service: serviceId, link, quantity } = body;
        if (!serviceId || !link || !quantity) {
          throw new Error("service, link, and quantity are required");
        }
        const svc = await db.select().from(servicesTable).where(and(eq(servicesTable.id, Number(serviceId)), eq(servicesTable.status, "active"))).limit(1);
        if (!svc[0]) throw new Error("Service not found or inactive");
        const qty = Number(quantity);
        if (qty < svc[0].min || qty > svc[0].max) throw new Error(`Quantity must be between ${svc[0].min} and ${svc[0].max}`);
        const charge = (Number(svc[0].rate) * qty) / 1000;
        // Atomic balance deduction inside transaction to prevent race conditions
        const order = await db.transaction(async (tx) => {
          const [freshUser] = await tx.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
          if (!freshUser || Number(freshUser.balance) < charge) throw new Error("Insufficient balance");
          const newBalance = Number(freshUser.balance) - charge;
          const [newOrder] = await tx.insert(ordersTable).values({
            userId: user.id, serviceId: Number(serviceId), link, quantity: qty,
            charge: charge.toFixed(4), status: "pending",
            runs: body.runs ? Number(body.runs) : undefined,
            interval: body.interval ? Number(body.interval) : undefined,
            comments: body.comments,
            username: body.username,
          }).returning();
          await tx.update(usersTable).set({ balance: newBalance.toFixed(4) }).where(eq(usersTable.id, user.id));
          await tx.insert(transactionsTable).values({ userId: user.id, type: "order", amount: (-charge).toFixed(4), balanceAfter: newBalance.toFixed(4), description: `API Order #${newOrder.id}`, referenceId: newOrder.id });
          await tx.insert(orderLogsTable).values({ orderId: newOrder.id, status: "pending", note: "Order created via API" });
          return newOrder;
        });
        responseData = { order: order.id };
        break;
      }
      
      case "status": {
        const { order: orderId } = body;
        if (!orderId) throw new Error("order is required");
        const order = await db.select({
          charge: ordersTable.charge,
          startCount: ordersTable.startCount,
          status: ordersTable.status,
          remains: ordersTable.remains,
          currency: sql<string>`(SELECT currency FROM users WHERE id = orders.user_id)`,
        }).from(ordersTable).where(and(eq(ordersTable.id, Number(orderId)), eq(ordersTable.userId, user.id))).limit(1);
        if (!order[0]) throw new Error("Order not found");
        responseData = { charge: order[0].charge, start_count: order[0].startCount, status: order[0].status, remains: order[0].remains, currency: order[0].currency };
        break;
      }
      
      case "multiple_status": {
        const { orders: orderIds } = body;
        if (!orderIds) throw new Error("orders is required");
        const ids = String(orderIds).split(",").map(id => Number(id.trim())).filter(n => !isNaN(n));
        const ordersData = await db.select({
          id: ordersTable.id, charge: ordersTable.charge, startCount: ordersTable.startCount,
          status: ordersTable.status, remains: ordersTable.remains,
        }).from(ordersTable).where(and(eq(ordersTable.userId, user.id), inArray(ordersTable.id, ids)));
        const result: Record<string, any> = {};
        ordersData.forEach(o => { result[String(o.id)] = { charge: o.charge, start_count: o.startCount, status: o.status, remains: o.remains }; });
        responseData = result;
        break;
      }
      
      case "refill": {
        const { order: orderId } = body;
        if (!orderId) throw new Error("order is required");
        const order = await db.select().from(ordersTable).where(and(eq(ordersTable.id, Number(orderId)), eq(ordersTable.userId, user.id))).limit(1);
        if (!order[0]) throw new Error("Order not found");
        const svc = await db.select().from(servicesTable).where(eq(servicesTable.id, order[0].serviceId)).limit(1);
        if (!svc[0]?.refill) throw new Error("This service does not support refill");
        await db.insert(orderLogsTable).values({ orderId: order[0].id, status: "refill_requested", note: "Refill requested via API" });
        responseData = { refill: order[0].id };
        break;
      }
      
      case "refill_status": {
        const { refill } = body;
        if (!refill) throw new Error("refill is required");
        const order = await db.select({ status: ordersTable.status }).from(ordersTable).where(and(eq(ordersTable.id, Number(refill)), eq(ordersTable.userId, user.id))).limit(1);
        if (!order[0]) throw new Error("Order not found");
        responseData = { status: "In progress" };
        break;
      }
      
      case "cancel": {
        const { order: orderId } = body;
        if (!orderId) throw new Error("order is required");
        const order = await db.select().from(ordersTable).where(and(eq(ordersTable.id, Number(orderId)), eq(ordersTable.userId, user.id))).limit(1);
        if (!order[0]) throw new Error("Order not found");
        if (!["pending", "processing"].includes(order[0].status)) throw new Error("Order cannot be cancelled");
        await db.update(ordersTable).set({ status: "cancelled", updatedAt: new Date() }).where(eq(ordersTable.id, order[0].id));
        await db.insert(orderLogsTable).values({ orderId: order[0].id, status: "cancelled", note: "Cancelled via API" });
        responseData = { cancel: [{ id: order[0].id, cancel: 1 }] };
        break;
      }
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (e: any) {
    isError = true;
    responseData = { error: e.message };
  }

  await logRequest(user.id, action, { ...body, key: "***" }, responseData, isError ? "error" : "success", ip);
  return res.json(responseData);
});

export default router;
