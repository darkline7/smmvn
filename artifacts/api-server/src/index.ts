import app from "./app";
import { db } from "@workspace/db";
import { usersTable, siteSettingsTable } from "@workspace/db/schema";
import { hashPassword, generateApiKey, generateReferralCode } from "./lib/auth.js";
import { runMigrations } from "./lib/migrate.js";
import { count } from "drizzle-orm";

// Default settings seeded on every startup (onConflictDoNothing = safe to repeat)
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
  // Thẻ cào - thesieure.com
  { key: "card_partner_id", value: "" },
  { key: "card_partner_key", value: "" },
  { key: "card_enabled", value: "false" },
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
  // Security / OAuth
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
    console.error("[startup] Settings seed error:", err);
  }
}

async function seedUsersIfEmpty() {
  try {
    const [{ value: userCount }] = await db
      .select({ value: count() })
      .from(usersTable);
    if (Number(userCount) > 0) return;

    console.log("[startup] No users found — seeding default admin + demo accounts...");

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

    console.log("[startup] Seed complete: admin@smmpanel.com / password");
    console.log("[startup] IMPORTANT: Change admin password immediately after first login!");
  } catch (err) {
    console.error("[startup] User seed error:", err);
  }
}

// ── Port resolution ────────────────────────────────────────────────────────────
// cPanel Node.js Selector sets PORT automatically.
// Provide a safe fallback of 3000 for local/direct node execution.
const rawPort = process.env["PORT"];
const port = rawPort ? Number(rawPort) : 3000;

if (Number.isNaN(port) || port <= 0 || port > 65535) {
  console.error(`[startup] Invalid PORT value: "${rawPort}" — must be 1-65535`);
  process.exit(1);
}

if (!rawPort) {
  console.warn(
    `[startup] PORT not set — defaulting to ${port}. Set PORT env var in production.`
  );
}

// ── Main startup sequence ──────────────────────────────────────────────────────
async function main() {
  console.log(`[startup] SMM Panel Pro — Node.js ${process.version}`);
  console.log(`[startup] NODE_ENV=${process.env.NODE_ENV || "development"}`);

  // Step 1: Run DB migrations (creates tables if they don't exist)
  // This MUST succeed before the server accepts any requests.
  try {
    await runMigrations();
  } catch (err) {
    console.error("[startup] FATAL: Database migration failed. Check DATABASE_URL and DB connectivity.");
    console.error(err);
    process.exit(1);
  }

  // Step 2: Start HTTP server
  const server = app.listen(port, async () => {
    console.log(`[startup] Listening on port ${port}`);

    // Step 3: Seed initial data (safe to run on every start)
    await ensureSettings();
    await seedUsersIfEmpty();
    console.log("[startup] Ready ✓");
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  function shutdown(signal: string) {
    console.log(`\n[shutdown] Received ${signal} — closing gracefully...`);
    server.close(() => {
      console.log("[shutdown] HTTP server closed. Exiting.");
      process.exit(0);
    });
    // Force exit after 10s if connections don't drain
    setTimeout(() => {
      console.error("[shutdown] Forced exit after timeout.");
      process.exit(1);
    }, 10_000).unref();
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

// ── Global error handlers ──────────────────────────────────────────────────────
process.on("unhandledRejection", (reason) => {
  console.error("[error] Unhandled Promise Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[error] Uncaught Exception:", err);
  process.exit(1);
});

main().catch((err) => {
  console.error("[startup] Fatal startup error:", err);
  process.exit(1);
});
