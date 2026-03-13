import https from "https";
import { db } from "@workspace/db";
import { siteSettingsTable } from "@workspace/db/schema";

async function getSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(siteSettingsTable);
  const s: Record<string, string> = {};
  rows.forEach(r => { s[r.key] = r.value || ""; });
  return s;
}

export async function sendTelegramMessage(botToken: string, chatId: string, message: string): Promise<boolean> {
  try {
    const body = JSON.stringify({ chat_id: chatId, text: message, parse_mode: "Markdown" });
    return new Promise<boolean>((resolve) => {
      const req = https.request(
        { hostname: "api.telegram.org", path: `/bot${botToken}/sendMessage`, method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } },
        (res) => {
          let data = "";
          res.on("data", (chunk) => { data += chunk; });
          res.on("end", () => {
            try { const parsed = JSON.parse(data); resolve(parsed.ok === true); } catch { resolve(false); }
          });
        }
      );
      req.on("error", () => resolve(false));
      req.setTimeout(8000, () => { req.destroy(); resolve(false); });
      req.write(body);
      req.end();
    });
  } catch {
    return false;
  }
}

export async function sendTelegram(message: string): Promise<void> {
  try {
    const settings = await getSettings();
    const botToken = process.env.TELEGRAM_BOT_TOKEN || settings["telegram_bot_token"] || "";
    const chatId = process.env.TELEGRAM_CHAT_ID || settings["telegram_admin_chat_id"] || "";
    if (!botToken || !chatId) return;

    const body = JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" });
    await new Promise<void>((resolve, reject) => {
      const req = https.request(
        { hostname: "api.telegram.org", path: `/bot${botToken}/sendMessage`, method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } },
        (res) => { res.resume(); res.on("end", () => resolve()); }
      );
      req.on("error", reject);
      req.setTimeout(8000, () => { req.destroy(); resolve(); });
      req.write(body);
      req.end();
    });
  } catch {
  }
}

export async function notifyNewOrder(order: { id: number; userId: number; serviceName: string; link: string; quantity: number; charge: string }) {
  await sendTelegram(
    `🛒 <b>Đơn hàng mới #${order.id}</b>\n` +
    `👤 User ID: ${order.userId}\n` +
    `📦 Dịch vụ: ${order.serviceName}\n` +
    `🔗 Link: ${order.link}\n` +
    `🔢 SL: ${order.quantity}\n` +
    `💵 Giá: $${order.charge}`
  );
}

export async function notifyNewDeposit(deposit: { id: number; userId: number; amount: string; method: string }) {
  await sendTelegram(
    `💰 <b>Yêu cầu nạp tiền mới #${deposit.id}</b>\n` +
    `👤 User ID: ${deposit.userId}\n` +
    `💵 Số tiền: $${deposit.amount}\n` +
    `🏦 Phương thức: ${deposit.method}`
  );
}

export async function notifyDepositApproved(deposit: { id: number; userId: number; amount: string }) {
  await sendTelegram(
    `✅ <b>Duyệt nạp tiền #${deposit.id}</b>\n` +
    `👤 User ID: ${deposit.userId}\n` +
    `💵 Số tiền: $${deposit.amount}`
  );
}

export async function notifyDepositRejected(deposit: { id: number; userId: number; amount: string }) {
  await sendTelegram(
    `❌ <b>Từ chối nạp tiền #${deposit.id}</b>\n` +
    `👤 User ID: ${deposit.userId}\n` +
    `💵 Số tiền: $${deposit.amount}`
  );
}

export async function notifyNewTicket(ticket: { id: number; userId: number; subject: string }) {
  await sendTelegram(
    `🎫 <b>Ticket hỗ trợ mới #${ticket.id}</b>\n` +
    `👤 User ID: ${ticket.userId}\n` +
    `📝 Tiêu đề: ${ticket.subject}`
  );
}

export async function notifyAutoDepositApproved(deposit: { id: number; userId: number; amount: string; reference: string }) {
  await sendTelegram(
    `🤖 <b>Auto-duyệt nạp tiền #${deposit.id}</b>\n` +
    `👤 User ID: ${deposit.userId}\n` +
    `💵 Số tiền: $${deposit.amount}\n` +
    `🔑 Mã: ${deposit.reference}`
  );
}
