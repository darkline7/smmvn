import app from "./app";
import { db } from "@workspace/db";
import { usersTable, siteSettingsTable } from "@workspace/db/schema";
import { hashPassword, generateApiKey, generateReferralCode } from "./lib/auth.js";
import { count } from "drizzle-orm";

// Default settings always ensured on startup (upsert logic via onConflictDoNothing)
const DEFAULT_SETTINGS: { key: string; value: string }[] = [
  // General
  { key: "site_name", value: "SMM Pro" },
  { key: "site_url", value: "https://smmvn.replit.app" },
  { key: "site_description", value: "The #1 Premium Social Media Panel" },
  { key: "site_keywords", value: "smm panel, social media marketing, instagram followers" },
  { key: "site_author", value: "SMM Pro" },
  { key: "support_email", value: "support@smmvn.replit.app" },
  { key: "hotline", value: "" },
  { key: "address", value: "" },
  { key: "fanpage_url", value: "" },
  { key: "timezone", value: "Asia/Ho_Chi_Minh" },
  { key: "copyright_left", value: "© 2025 SMM Pro. All rights reserved." },
  { key: "copyright_right", value: "Powered by SMM Pro" },
  // Branding
  { key: "logo_url", value: "" },
  { key: "favicon_url", value: "" },
  // Commerce
  { key: "referral_commission", value: "0.05" },
  { key: "min_order_balance", value: "0.01" },
  { key: "min_deposit", value: "1" },
  { key: "max_deposit", value: "10000" },
  { key: "vnd_exchange_rate", value: "24000" },
  // Payment - SePay
  { key: "sepay_webhook_secret", value: "" },
  { key: "sepay_enabled", value: "false" },
  { key: "bank_name", value: "" },
  { key: "bank_account_number", value: "" },
  { key: "bank_account_name", value: "" },
  { key: "bank_bin", value: "" },
  // Telegram
  { key: "telegram_bot_token", value: "" },
  { key: "telegram_admin_chat_id", value: "" },
  { key: "telegram_notify_new_order", value: "true" },
  { key: "telegram_notify_new_deposit", value: "true" },
  { key: "telegram_notify_new_ticket", value: "true" },
  // SMTP
  { key: "smtp_host", value: "" },
  { key: "smtp_port", value: "587" },
  { key: "smtp_secure", value: "false" },
  { key: "smtp_user", value: "" },
  { key: "smtp_pass", value: "" },
  { key: "smtp_from_name", value: "SMM Pro" },
  { key: "smtp_from_email", value: "" },
  { key: "smtp_enabled", value: "false" },
  // Security
  { key: "google_client_id", value: "" },
  { key: "google_client_secret", value: "" },
  { key: "google_oauth_enabled", value: "false" },
  { key: "turnstile_site_key", value: "" },
  { key: "turnstile_secret_key", value: "" },
  { key: "turnstile_enabled", value: "false" },
  // System
  { key: "maintenance_mode", value: "false" },
  { key: "registration_open", value: "true" },
  { key: "cron_secret", value: "" },
];

async function ensureSettings() {
  try {
    for (const s of DEFAULT_SETTINGS) {
      await db.insert(siteSettingsTable).values(s).onConflictDoNothing();
    }
  } catch (err) {
    console.error("Settings seed error:", err);
  }
}

async function seedUsersIfEmpty() {
  try {
    const [{ value: userCount }] = await db.select({ value: count() }).from(usersTable);
    if (Number(userCount) > 0) return;

    console.log("No users found — seeding initial users...");

    const adminHash = await hashPassword("password");
    const demoHash = await hashPassword("password");
    await db.insert(usersTable).values([
      {
        email: "admin@smmpanel.com",
        username: "admin",
        passwordHash: adminHash,
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
        passwordHash: demoHash,
        role: "user",
        balance: "50.0000",
        currency: "USD",
        apiKey: generateApiKey(),
        referralCode: generateReferralCode(),
        emailVerified: true,
      },
    ]);

    console.log("Seed complete: admin@smmpanel.com / password");
  } catch (err) {
    console.error("User seed error:", err);
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
  await ensureSettings();  // Always run — adds missing settings
  await seedUsersIfEmpty(); // Only runs on fresh DB
});
