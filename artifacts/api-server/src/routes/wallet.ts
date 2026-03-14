import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, transactionsTable, depositsTable, siteSettingsTable, cardChargesTable } from "@workspace/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import type { AuthRequest } from "../lib/auth.js";
import { z } from "zod";
import crypto from "crypto";

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

// ── Thẻ cào (scratch card) top-up ────────────────────────────────────────────
const CARD_TELCOS = ["VIETTEL", "MOBIFONE", "VINAPHONE", "VIETNAMOBILE", "GMOBILE", "REDDI"] as const;
const CARD_AMOUNTS = [10000, 20000, 50000, 100000, 200000, 500000] as const;

const cardSchema = z.object({
  telco: z.enum(CARD_TELCOS),
  serial: z.string().min(5),
  code: z.string().min(5),
  amount: z.number().refine(v => (CARD_AMOUNTS as readonly number[]).includes(v), { message: "Mệnh giá không hợp lệ" }),
});

// Cancel a pending deposit
router.post("/deposits/:id/cancel", requireAuth as any, async (req: AuthRequest, res: any) => {
  try {
    const id = Number(req.params.id);
    const [dep] = await db.select().from(depositsTable)
      .where(and(eq(depositsTable.id, id), eq(depositsTable.userId, req.userId!)))
      .limit(1);
    if (!dep) return res.status(404).json({ error: "Không tìm thấy lệnh nạp" });
    if (dep.status !== "pending") return res.status(400).json({ error: "Chỉ có thể hủy lệnh đang chờ" });
    await db.update(depositsTable).set({ status: "rejected", note: "Người dùng hủy lệnh" }).where(eq(depositsTable.id, id));
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

router.get("/cards", requireAuth as any, async (req: AuthRequest, res: any) => {
  const charges = await db.select().from(cardChargesTable)
    .where(eq(cardChargesTable.userId, req.userId!))
    .orderBy(desc(cardChargesTable.createdAt))
    .limit(30);
  return res.json({ cards: charges });
});

router.post("/cards", requireAuth as any, async (req: AuthRequest, res: any) => {
  try {
    const data = cardSchema.parse(req.body);

    // Get partner credentials from site settings
    const settings = await db.select().from(siteSettingsTable)
      .where(sql`key IN ('card_partner_id', 'card_partner_key', 'vnd_exchange_rate')`);
    const settingsMap: Record<string, string> = {};
    for (const s of settings) settingsMap[s.key] = s.value || "";

    const partnerId = settingsMap["card_partner_id"];
    const partnerKey = settingsMap["card_partner_key"];
    const cardApiUrl = "https://thesieure.com/chargingws/v2";
    if (!partnerId || !partnerKey) {
      return res.status(400).json({ error: "Nạp thẻ cào chưa được cấu hình. Vui lòng liên hệ admin." });
    }

    const requestId = crypto.randomUUID();
    // Save charge record first (status=2=pending)
    const [charge] = await db.insert(cardChargesTable).values({
      userId: req.userId!,
      telco: data.telco,
      serial: data.serial,
      code: data.code,
      declaredAmount: data.amount,
      requestId,
      status: 2,
    }).returning();

    // Determine site URL for callback
    const siteUrl = (await db.select({ value: siteSettingsTable.value }).from(siteSettingsTable).where(sql`key = 'site_url'`).limit(1))[0]?.value || "";
    const callbackUrl = siteUrl ? `${siteUrl}/api/wallet/cards/callback` : "";

    // Call gachthevip.vn API
    let apiResult: any = null;
    try {
      const body = new URLSearchParams({
        partner_id: partnerId,
        partner_key: partnerKey,
        telco: data.telco,
        code: data.code,
        serial: data.serial,
        amount: String(data.amount),
        request_id: requestId,
        ...(callbackUrl ? { callback_url: callbackUrl } : {}),
      });
      const resp = await fetch(cardApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        signal: AbortSignal.timeout(30000),
      });
      apiResult = await resp.json();
    } catch (fetchErr: any) {
      await db.update(cardChargesTable).set({ status: 3, message: `Lỗi kết nối: ${fetchErr.message}`, updatedAt: new Date() }).where(eq(cardChargesTable.id, charge.id));
      return res.json({ id: charge.id, status: 3, message: "Không thể kết nối đến cổng thanh toán. Vui lòng thử lại sau." });
    }

    // status 1=success, 2=pending, 3=fail, 99=maintenance
    const cardStatus = apiResult?.status ?? 3;
    const cardMessage = apiResult?.message || "Không xác định";
    const actualAmount = apiResult?.amount ? Number(apiResult.amount) : null;

    let usdCredited: string | null = null;
    if (cardStatus === 1 && actualAmount) {
      // Credit user balance
      const vndRate = Number(settingsMap["vnd_exchange_rate"] || "24000");
      const usd = actualAmount / vndRate;
      const user = await db.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
      const newBalance = Number(user[0]?.balance || 0) + usd;
      usdCredited = usd.toFixed(4);
      await Promise.all([
        db.update(usersTable).set({ balance: newBalance.toFixed(4) }).where(eq(usersTable.id, req.userId!)),
        db.insert(transactionsTable).values({
          userId: req.userId!,
          type: "deposit",
          amount: usd.toFixed(4),
          balanceAfter: newBalance.toFixed(4),
          description: `Nạp thẻ ${data.telco} ${data.amount.toLocaleString("vi-VN")}đ`,
          referenceId: charge.id,
        }),
      ]);
    }

    await db.update(cardChargesTable).set({
      status: cardStatus,
      message: cardMessage,
      actualAmount: actualAmount ? String(actualAmount) : null,
      usdCredited,
      updatedAt: new Date(),
    }).where(eq(cardChargesTable.id, charge.id));

    const statusLabels: Record<number, string> = { 1: "Thành công", 2: "Đang xử lý", 3: "Thẻ lỗi / không hợp lệ", 99: "Hệ thống đang bảo trì" };
    return res.json({ id: charge.id, status: cardStatus, message: statusLabels[cardStatus] || cardMessage, usdCredited });
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

// ── Callback endpoint for thesieure.com (POST after card processed) ──────────
router.post("/cards/callback", async (req: any, res: any) => {
  try {
    const { request_id, status, amount, declared_value, message, sign } = req.body;
    if (!request_id) return res.status(400).json({ error: "Missing request_id" });

    // Verify HMAC signature from thesieure.com
    // sign = md5(partner_id + partner_key + request_id)
    const settingsForAuth = await db.select().from(siteSettingsTable)
      .where(sql`key IN ('card_partner_id', 'card_partner_key')`);
    const sMap: Record<string, string> = {};
    for (const s of settingsForAuth) sMap[s.key] = s.value || "";
    const partnerId = sMap["card_partner_id"];
    const partnerKey = sMap["card_partner_key"];

    if (partnerId && partnerKey) {
      if (!sign) {
        return res.status(401).json({ error: "Missing signature" });
      }
      const expectedSign = crypto.createHash("md5")
        .update(partnerId + partnerKey + request_id)
        .digest("hex");
      if (sign !== expectedSign) {
        return res.status(401).json({ error: "Invalid signature" });
      }
    }

    const [charge] = await db.select().from(cardChargesTable)
      .where(eq(cardChargesTable.requestId, request_id)).limit(1);
    if (!charge) return res.status(404).json({ error: "Charge not found" });

    // Already finalized? skip (idempotent)
    if (charge.status === 1 || charge.status === 3) {
      return res.json({ success: true, message: "Already processed" });
    }

    const cardStatus = Number(status) || 3;
    const actualAmount = amount ? Number(amount) : null;

    let usdCredited: string | null = null;
    if (cardStatus === 1 && actualAmount) {
      const rateSetting = await db.select({ value: siteSettingsTable.value })
        .from(siteSettingsTable).where(sql`key = 'vnd_exchange_rate'`).limit(1);
      const vndRate = Number(rateSetting[0]?.value || "24000");
      const usd = actualAmount / vndRate;
      usdCredited = usd.toFixed(4);

      // Use DB transaction to prevent race conditions
      await db.transaction(async (tx) => {
        const [user] = await tx.select({ balance: usersTable.balance })
          .from(usersTable).where(eq(usersTable.id, charge.userId)).limit(1);
        const newBalance = Number(user?.balance || 0) + usd;
        await tx.update(usersTable)
          .set({ balance: newBalance.toFixed(4) })
          .where(eq(usersTable.id, charge.userId));
        await tx.insert(transactionsTable).values({
          userId: charge.userId,
          type: "deposit",
          amount: usd.toFixed(4),
          balanceAfter: newBalance.toFixed(4),
          description: `Nạp thẻ ${charge.telco} ${Number(charge.declaredAmount).toLocaleString("vi-VN")}đ (callback)`,
          referenceId: charge.id,
        });
        await tx.update(cardChargesTable).set({
          status: cardStatus,
          message: message || null,
          actualAmount: actualAmount ? String(actualAmount) : null,
          usdCredited,
          updatedAt: new Date(),
        }).where(eq(cardChargesTable.id, charge.id));
      });
    } else {
      await db.update(cardChargesTable).set({
        status: cardStatus,
        message: message || null,
        actualAmount: actualAmount ? String(actualAmount) : null,
        usdCredited: null,
        updatedAt: new Date(),
      }).where(eq(cardChargesTable.id, charge.id));
    }

    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: "Internal error" });
  }
});

export default router;
