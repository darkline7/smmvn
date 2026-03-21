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

// POST /api/webhooks/thueapibank
// Validates header: signature
// Body format: { status, message, transactions: [{ type, transactionID, amount, description }] }
router.post("/thueapibank", async (req: any, res: any) => {
  try {
    const settings = await getSettings();
    const configuredSignature = process.env.THUEAPIBANK_SIGNATURE || settings["thueapibank_signature"] || "";

    if (!configuredSignature) {
      console.warn("[ThueApiBank] Webhook received but signature not configured — rejecting");
      return res.status(401).json({ status: false, msg: "Webhook signature not configured" });
    }

    const receivedSignature = req.headers["signature"] || req.headers["Signature"] || "";
    if (receivedSignature !== configuredSignature) {
      console.warn("[ThueApiBank] Invalid signature:", receivedSignature);
      return res.status(401).json({ status: false, msg: "Chữ ký không hợp lệ" });
    }

    const { transactions } = req.body;
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.json({ status: true, msg: "OK — no transactions" });
    }

    const settings2 = settings;
    const exchangeRate = Number(settings2["vnd_exchange_rate"] || "24000");
    const processed: string[] = [];
    const errors: string[] = [];

    for (const tx of transactions) {
      try {
        if (tx.type !== "IN") continue;

        const txAmount = Number(tx.amount || 0);
        if (txAmount <= 0) continue;

        const description = String(tx.description || "").toUpperCase();
        const transactionID = String(tx.transactionID || "");

        // Match deposit by reference code SMM{id} or NAP{id} in description
        const match = description.match(/SMM(\d+)/) || description.match(/NAP(\d+)/);
        if (!match) {
          console.log(`[ThueApiBank] No reference code in description: ${description}`);
          continue;
        }

        const depositId = parseInt(match[1], 10);
        const [deposit] = await db.select().from(depositsTable).where(
          and(eq(depositsTable.id, depositId), eq(depositsTable.status, "pending"))
        ).limit(1);

        if (!deposit) {
          console.log(`[ThueApiBank] Deposit #${depositId} not found or already processed`);
          continue;
        }

        const [user] = await db.select().from(usersTable).where(eq(usersTable.id, deposit.userId)).limit(1);
        if (!user) { errors.push(`User not found for deposit #${depositId}`); continue; }

        const depositAmountUSD = Number(deposit.amount);
        const receivedUSD = txAmount / exchangeRate;

        if (Math.abs(receivedUSD - depositAmountUSD) > depositAmountUSD * 0.05) {
          console.warn(`[ThueApiBank] Amount mismatch for #${depositId}: expected ${depositAmountUSD}, got ${receivedUSD.toFixed(2)}`);
          errors.push(`Amount mismatch #${depositId}`);
          continue;
        }

        const newBalance = Number(user.balance) + depositAmountUSD;

        await db.transaction(async (trx) => {
          await trx.update(depositsTable).set({
            status: "approved",
            adminNote: `Auto-approved by ThueApiBank. Received ${txAmount} VND (TxID: ${transactionID})`,
            updatedAt: new Date(),
          }).where(eq(depositsTable.id, deposit.id));

          await trx.update(usersTable).set({ balance: newBalance.toFixed(4) }).where(eq(usersTable.id, user.id));

          await trx.insert(transactionsTable).values({
            userId: user.id,
            type: "deposit",
            amount: deposit.amount,
            balanceAfter: newBalance.toFixed(4),
            description: `Nạp tiền qua ThueApiBank - ${tx.description}`,
            referenceId: deposit.id,
          });

          await trx.insert(notificationsTable).values({
            userId: user.id,
            type: "deposit",
            title: "Nạp tiền thành công",
            message: `Tài khoản của bạn đã được cộng $${depositAmountUSD.toFixed(2)}. Số dư mới: $${newBalance.toFixed(2)}`,
          });
        });

        await notifyAutoDepositApproved({
          id: deposit.id,
          userId: user.id,
          amount: deposit.amount,
          reference: `SMM${depositId} (ThueApiBank TxID: ${transactionID})`,
        });

        processed.push(`#${depositId}`);
        console.log(`[ThueApiBank] ✅ Approved deposit #${depositId} for user #${user.id} — ${txAmount} VND`);
      } catch (txErr: any) {
        console.error("[ThueApiBank] Error processing transaction:", txErr.message);
        errors.push(txErr.message);
      }
    }

    return res.json({ status: true, msg: "OK", processed, errors: errors.length ? errors : undefined });
  } catch (err: any) {
    console.error("[ThueApiBank] Webhook error:", err);
    return res.status(500).json({ status: false, msg: "Internal error" });
  }
});

export default router;
