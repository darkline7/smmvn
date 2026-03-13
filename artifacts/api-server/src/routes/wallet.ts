import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, transactionsTable, depositsTable } from "@workspace/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import type { AuthRequest } from "../lib/auth.js";
import { z } from "zod";

const router = Router();

router.get("/balance", requireAuth as any, async (req: AuthRequest, res: any) => {
  const user = await db.select({ balance: usersTable.balance, currency: usersTable.currency }).from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user[0]) return res.status(404).json({ error: "User not found" });
  return res.json({ balance: Number(user[0].balance), currency: user[0].currency });
});

router.get("/transactions", requireAuth as any, async (req: AuthRequest, res: any) => {
  const { type, page = "1", limit = "20" } = req.query;
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));
  const offset = (pageNum - 1) * limitNum;

  let conditions: any[] = [eq(transactionsTable.userId, req.userId!)];
  if (type) conditions.push(eq(transactionsTable.type, type as any));

  const [transactions, total] = await Promise.all([
    db.select().from(transactionsTable).where(and(...conditions)).orderBy(desc(transactionsTable.createdAt)).limit(limitNum).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(transactionsTable).where(and(...conditions)),
  ]);

  const totalCount = Number(total[0]?.count || 0);
  return res.json({ transactions, total: totalCount, page: pageNum, totalPages: Math.ceil(totalCount / limitNum) });
});

const depositSchema = z.object({
  amount: z.number().positive().min(1),
  method: z.enum(["bank_transfer", "qr_payment", "crypto"]),
  note: z.string().optional(),
});

router.get("/deposits", requireAuth as any, async (req: AuthRequest, res: any) => {
  const deposits = await db.select().from(depositsTable).where(eq(depositsTable.userId, req.userId!)).orderBy(desc(depositsTable.createdAt));
  return res.json({ deposits });
});

router.post("/deposits", requireAuth as any, async (req: AuthRequest, res: any) => {
  try {
    const data = depositSchema.parse(req.body);
    const [deposit] = await db.insert(depositsTable).values({
      userId: req.userId!,
      amount: data.amount.toFixed(4),
      method: data.method,
      status: "pending",
      note: data.note,
    }).returning();
    return res.status(201).json(deposit);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

export default router;
