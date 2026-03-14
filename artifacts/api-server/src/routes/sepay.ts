import { Router } from "express";
import { db } from "@workspace/db";
import { depositsTable, transactionsTable, usersTable, notificationsTable, siteSettingsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { notifyAutoDepositApproved } from "../lib/telegram.js";

const router = Router();

async function getSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(siteSettingsTable);
  const s: Record<string, string> = {};
  rows.forEach(r => { s[r.key] = r.value || ""; });
  return s;
}

router.post("/sepay", async (req: any, res: any) => {
  try {
    const settings = await getSettings();
    const webhookSecret = process.env.SEPAY_WEBHOOK_SECRET || settings["sepay_webhook_secret"] || "";

    // Always require webhook secret — never allow unauthenticated webhooks
    if (!webhookSecret) {
      console.warn("[SePay] Webhook received but SEPAY_WEBHOOK_SECRET not configured — rejecting");
      return res.status(401).json({ success: false, message: "Webhook secret not configured" });
    }
    const apiKey = req.headers["authorization"] || req.body.apikey || "";
    if (apiKey !== webhookSecret && apiKey !== `Apikey ${webhookSecret}`) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { transferType, content, transferAmount, amount, in: inAmount } = req.body;

    if (transferType !== "in") {
      return res.json({ success: true, message: "Ignored: outgoing transfer" });
    }

    const txAmount = Number(transferAmount || amount || inAmount || 0);
    if (txAmount <= 0) {
      return res.json({ success: true, message: "Invalid amount" });
    }

    const contentStr = String(content || "").toUpperCase();

    const match = contentStr.match(/SMM(\d+)/);
    if (!match) {
      return res.json({ success: true, message: "No matching reference in content" });
    }

    const depositId = parseInt(match[1], 10);
    const [deposit] = await db.select().from(depositsTable).where(
      and(eq(depositsTable.id, depositId), eq(depositsTable.status, "pending"))
    ).limit(1);

    if (!deposit) {
      return res.json({ success: true, message: "Deposit not found or already processed" });
    }

    const exchangeRate = Number(settings["vnd_exchange_rate"] || "24000");
    const depositAmountUSD = Number(deposit.amount);
    const receivedUSD = txAmount / exchangeRate;

    if (Math.abs(receivedUSD - depositAmountUSD) > depositAmountUSD * 0.02) {
      return res.json({ success: false, message: `Amount mismatch: expected ${depositAmountUSD} USD, received ${receivedUSD.toFixed(2)} USD` });
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, deposit.userId)).limit(1);
    if (!user) return res.json({ success: false, message: "User not found" });

    const newBalance = Number(user.balance) + depositAmountUSD;

    await db.transaction(async (tx) => {
      await tx.update(depositsTable).set({ status: "approved", adminNote: `Auto-approved by SePay. Received ${txAmount} VND`, updatedAt: new Date() }).where(eq(depositsTable.id, deposit.id));
      await tx.update(usersTable).set({ balance: newBalance.toFixed(4) }).where(eq(usersTable.id, user.id));
      await tx.insert(transactionsTable).values({
        userId: user.id,
        type: "deposit",
        amount: deposit.amount,
        balanceAfter: newBalance.toFixed(4),
        description: `Nạp tiền qua SePay - ${content}`,
        referenceId: deposit.id,
      });
      await tx.insert(notificationsTable).values({
        userId: user.id,
        type: "deposit",
        title: "Nạp tiền thành công",
        message: `Tài khoản của bạn đã được cộng $${depositAmountUSD.toFixed(2)}. Số dư mới: $${newBalance.toFixed(2)}`,
      });
    });

    await notifyAutoDepositApproved({ id: deposit.id, userId: user.id, amount: deposit.amount, reference: `SMM${depositId}` });

    return res.json({ success: true, message: "Deposit approved successfully" });
  } catch (err: any) {
    console.error("SePay webhook error:", err);
    return res.status(500).json({ success: false, message: "Internal error" });
  }
});

export default router;
