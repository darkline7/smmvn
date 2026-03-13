import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, usersTable, announcementsTable } from "@workspace/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import type { AuthRequest } from "../lib/auth.js";

const router = Router();

router.get("/stats", requireAuth as any, async (req: AuthRequest, res: any) => {
  const user = await db.select({ balance: usersTable.balance, currency: usersTable.currency }).from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalOrders, pendingOrders, completedOrders, monthlySpend] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(eq(ordersTable.userId, req.userId!)),
    db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(and(eq(ordersTable.userId, req.userId!), eq(ordersTable.status, "pending"))),
    db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(and(eq(ordersTable.userId, req.userId!), eq(ordersTable.status, "completed"))),
    db.select({ total: sql<number>`COALESCE(SUM(ABS(charge::numeric)), 0)` }).from(ordersTable).where(and(eq(ordersTable.userId, req.userId!), gte(ordersTable.createdAt, monthStart))),
  ]);

  return res.json({
    balance: Number(user[0]?.balance || 0),
    currency: user[0]?.currency || "USD",
    totalOrders: Number(totalOrders[0]?.count || 0),
    pendingOrders: Number(pendingOrders[0]?.count || 0),
    completedOrders: Number(completedOrders[0]?.count || 0),
    monthlySpend: Number(monthlySpend[0]?.total || 0),
  });
});

router.get("/chart", requireAuth as any, async (req: AuthRequest, res: any) => {
  const { period = "30d" } = req.query;
  const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const data = await db.select({
    date: sql<string>`DATE(orders.created_at)::text`,
    orders: sql<number>`COUNT(*)`,
    spend: sql<number>`COALESCE(SUM(charge::numeric), 0)`,
  }).from(ordersTable)
    .where(and(eq(ordersTable.userId, req.userId!), gte(ordersTable.createdAt, startDate)))
    .groupBy(sql`DATE(orders.created_at)`)
    .orderBy(sql`DATE(orders.created_at)`);

  return res.json({ data });
});

export default router;
