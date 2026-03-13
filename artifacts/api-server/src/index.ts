import app from "./app";
import { db } from "@workspace/db";
import { usersTable, siteSettingsTable } from "@workspace/db/schema";
import { hashPassword, generateApiKey, generateReferralCode } from "./lib/auth.js";
import { count } from "drizzle-orm";

async function seedIfEmpty() {
  try {
    const [{ value: userCount }] = await db.select({ value: count() }).from(usersTable);
    if (Number(userCount) > 0) return;

    console.log("No users found — seeding initial data...");

    await db.insert(usersTable).values([
      {
        email: "admin@smmpanel.com",
        username: "admin",
        passwordHash: hashPassword("password"),
        role: "admin",
        balance: "999999.0000",
        currency: "USD",
        apiKey: generateApiKey(),
        referralCode: generateReferralCode(),
        emailVerified: true,
      },
      {
        email: "demo@smmpanel.com",
        username: "demo",
        passwordHash: hashPassword("password"),
        role: "user",
        balance: "50.0000",
        currency: "USD",
        apiKey: generateApiKey(),
        referralCode: generateReferralCode(),
        emailVerified: true,
      },
    ]);

    const defaultSettings: { key: string; value: string }[] = [
      { key: "site_name", value: "SMM Pro" },
      { key: "site_url", value: "https://smmpanel.com" },
      { key: "min_deposit", value: "1" },
      { key: "vnd_exchange_rate", value: "24000" },
      { key: "sepay_webhook_secret", value: "" },
      { key: "bank_name", value: "MB Bank" },
      { key: "bank_account_number", value: "0397700999" },
      { key: "bank_account_name", value: "SMM PRO" },
      { key: "telegram_bot_token", value: "" },
      { key: "telegram_chat_id", value: "" },
      { key: "telegram_notify_orders", value: "true" },
      { key: "telegram_notify_deposits", value: "true" },
      { key: "telegram_notify_tickets", value: "true" },
    ];

    for (const s of defaultSettings) {
      await db.insert(siteSettingsTable).values(s).onConflictDoNothing();
    }

    console.log("Seed complete: admin@smmpanel.com / password");
  } catch (err) {
    console.error("Seed error:", err);
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async () => {
  console.log(`Server listening on port ${port}`);
  await seedIfEmpty();
});
