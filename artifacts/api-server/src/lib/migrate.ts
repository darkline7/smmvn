import { pool } from "@workspace/db";

/**
 * Idempotent database migration — runs on every startup.
 * Creates all ENUMs and tables if they don't exist yet.
 * Safe to run multiple times (IF NOT EXISTS everywhere).
 */
export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log("[migrate] Running schema migrations...");

    // ── Step 1: Create ENUM types (idempotent via DO/EXCEPTION) ───────────────
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE "user_role" AS ENUM('user', 'admin', 'reseller');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE "provider_status" AS ENUM('active', 'inactive');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE "service_status" AS ENUM('active', 'inactive');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE "service_type" AS ENUM('default', 'custom_comments', 'packages', 'subscriptions');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE "order_status" AS ENUM('pending', 'processing', 'active', 'completed', 'partial', 'cancelled', 'failed');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE "deposit_method" AS ENUM('bank_transfer', 'qr_payment', 'crypto');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE "deposit_status" AS ENUM('pending', 'approved', 'rejected');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE "transaction_type" AS ENUM('deposit', 'order', 'refund', 'adjustment', 'commission');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE "ticket_priority" AS ENUM('low', 'medium', 'high');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE "ticket_status" AS ENUM('open', 'pending', 'closed');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE "announcement_type" AS ENUM('info', 'warning', 'maintenance', 'success');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE "api_log_status" AS ENUM('success', 'error');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE "notification_type" AS ENUM('system', 'order', 'ticket', 'deposit');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE "subdomain_status" AS ENUM('pending', 'active', 'suspended', 'rejected');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // ── Step 2: Create tables (all IF NOT EXISTS) ──────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id"             serial       PRIMARY KEY NOT NULL,
        "email"          text         NOT NULL,
        "username"       text         NOT NULL,
        "password_hash"  text         NOT NULL,
        "role"           "user_role"  NOT NULL DEFAULT 'user',
        "balance"        numeric(12,4) NOT NULL DEFAULT '0',
        "currency"       text         NOT NULL DEFAULT 'USD',
        "api_key"        text,
        "referral_code"  text,
        "referred_by"    integer,
        "timezone"       text         NOT NULL DEFAULT 'UTC',
        "banned"         boolean      NOT NULL DEFAULT false,
        "email_verified" boolean      NOT NULL DEFAULT false,
        "created_at"     timestamp    NOT NULL DEFAULT now(),
        "updated_at"     timestamp    NOT NULL DEFAULT now(),
        CONSTRAINT "users_email_unique"         UNIQUE("email"),
        CONSTRAINT "users_username_unique"      UNIQUE("username"),
        CONSTRAINT "users_api_key_unique"       UNIQUE("api_key"),
        CONSTRAINT "users_referral_code_unique" UNIQUE("referral_code")
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "site_settings" (
        "id"         serial    PRIMARY KEY NOT NULL,
        "key"        text      NOT NULL,
        "value"      text,
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "site_settings_key_unique" UNIQUE("key")
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "categories" (
        "id"          serial    PRIMARY KEY NOT NULL,
        "name"        text      NOT NULL,
        "description" text,
        "sort_order"  integer   NOT NULL DEFAULT 0,
        "active"      boolean   NOT NULL DEFAULT true,
        "created_at"  timestamp NOT NULL DEFAULT now(),
        "updated_at"  timestamp NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "providers" (
        "id"             serial            PRIMARY KEY NOT NULL,
        "name"           text              NOT NULL,
        "base_url"       text              NOT NULL,
        "api_key"        text              NOT NULL,
        "status"         "provider_status" NOT NULL DEFAULT 'active',
        "markup_percent" text              NOT NULL DEFAULT '25',
        "notes"          text,
        "last_sync_at"   timestamp,
        "created_at"     timestamp         NOT NULL DEFAULT now(),
        "updated_at"     timestamp         NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "services" (
        "id"                  serial           PRIMARY KEY NOT NULL,
        "category_id"         integer          NOT NULL,
        "name"                text             NOT NULL,
        "provider_id"         integer,
        "provider_service_id" text,
        "type"                "service_type"   NOT NULL DEFAULT 'default',
        "rate"                numeric(10,4)    NOT NULL,
        "min"                 integer          NOT NULL,
        "max"                 integer          NOT NULL,
        "description"         text,
        "average_time"        text,
        "refill"              boolean          NOT NULL DEFAULT false,
        "cancel"              boolean          NOT NULL DEFAULT false,
        "dripfeed"            boolean          NOT NULL DEFAULT false,
        "subscriptions"       boolean          NOT NULL DEFAULT false,
        "sort_order"          integer          NOT NULL DEFAULT 0,
        "status"              "service_status" NOT NULL DEFAULT 'active',
        "tags"                text[],
        "created_at"          timestamp        NOT NULL DEFAULT now(),
        "updated_at"          timestamp        NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "orders" (
        "id"                  serial         PRIMARY KEY NOT NULL,
        "user_id"             integer        NOT NULL,
        "service_id"          integer        NOT NULL,
        "link"                text           NOT NULL,
        "quantity"            integer        NOT NULL,
        "start_count"         integer,
        "remains"             integer,
        "charge"              numeric(10,4)  NOT NULL,
        "status"              "order_status" NOT NULL DEFAULT 'pending',
        "provider_order_id"   text,
        "runs"                integer,
        "interval"            integer,
        "comments"            text,
        "username"            text,
        "created_at"          timestamp      NOT NULL DEFAULT now(),
        "updated_at"          timestamp      NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "order_logs" (
        "id"         serial    PRIMARY KEY NOT NULL,
        "order_id"   integer   NOT NULL,
        "status"     text      NOT NULL,
        "note"       text,
        "created_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "transactions" (
        "id"             serial              PRIMARY KEY NOT NULL,
        "user_id"        integer             NOT NULL,
        "type"           "transaction_type"  NOT NULL,
        "amount"         numeric(10,4)       NOT NULL,
        "balance_after"  numeric(12,4)       NOT NULL,
        "description"    text,
        "reference_id"   integer,
        "created_at"     timestamp           NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "deposits" (
        "id"          serial           PRIMARY KEY NOT NULL,
        "user_id"     integer          NOT NULL,
        "amount"      numeric(10,4)    NOT NULL,
        "method"      "deposit_method" NOT NULL,
        "status"      "deposit_status" NOT NULL DEFAULT 'pending',
        "proof_url"   text,
        "note"        text,
        "admin_note"  text,
        "created_at"  timestamp        NOT NULL DEFAULT now(),
        "updated_at"  timestamp        NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "tickets" (
        "id"          serial            PRIMARY KEY NOT NULL,
        "user_id"     integer           NOT NULL,
        "subject"     text              NOT NULL,
        "status"      "ticket_status"   NOT NULL DEFAULT 'open',
        "priority"    "ticket_priority" NOT NULL DEFAULT 'medium',
        "created_at"  timestamp         NOT NULL DEFAULT now(),
        "updated_at"  timestamp         NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "ticket_messages" (
        "id"         serial    PRIMARY KEY NOT NULL,
        "ticket_id"  integer   NOT NULL,
        "user_id"    integer   NOT NULL,
        "message"    text      NOT NULL,
        "is_admin"   boolean   NOT NULL DEFAULT false,
        "created_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "announcements" (
        "id"          serial               PRIMARY KEY NOT NULL,
        "title"       text                 NOT NULL,
        "content"     text                 NOT NULL,
        "type"        "announcement_type"  NOT NULL DEFAULT 'info',
        "active"      boolean              NOT NULL DEFAULT true,
        "created_at"  timestamp            NOT NULL DEFAULT now(),
        "updated_at"  timestamp            NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id"          serial              PRIMARY KEY NOT NULL,
        "user_id"     integer             NOT NULL,
        "type"        "notification_type" NOT NULL,
        "title"       text                NOT NULL,
        "message"     text                NOT NULL,
        "read"        boolean             NOT NULL DEFAULT false,
        "created_at"  timestamp           NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "referrals" (
        "id"               serial        PRIMARY KEY NOT NULL,
        "referrer_id"      integer       NOT NULL,
        "referred_user_id" integer       NOT NULL,
        "commission"       numeric(10,4) NOT NULL DEFAULT '0',
        "created_at"       timestamp     NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "api_request_logs" (
        "id"            serial           PRIMARY KEY NOT NULL,
        "user_id"       integer,
        "action"        text             NOT NULL,
        "request_body"  jsonb,
        "response_body" jsonb,
        "status"        "api_log_status" NOT NULL,
        "ip_address"    text,
        "created_at"    timestamp        NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "card_charges" (
        "id"               serial        PRIMARY KEY NOT NULL,
        "user_id"          integer       NOT NULL,
        "telco"            text          NOT NULL,
        "serial"           text          NOT NULL,
        "code"             text          NOT NULL,
        "declared_amount"  integer       NOT NULL,
        "actual_amount"    numeric(12,2),
        "request_id"       text          NOT NULL,
        "status"           integer       NOT NULL DEFAULT 2,
        "message"          text,
        "usd_credited"     numeric(10,4),
        "created_at"       timestamp     NOT NULL DEFAULT now(),
        "updated_at"       timestamp     NOT NULL DEFAULT now(),
        CONSTRAINT "card_charges_request_id_unique" UNIQUE("request_id")
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "subdomains" (
        "id"            serial             PRIMARY KEY NOT NULL,
        "user_id"       integer            NOT NULL,
        "domain"        text               NOT NULL,
        "status"        "subdomain_status" NOT NULL DEFAULT 'pending',
        "site_name"     text,
        "logo_url"      text,
        "primary_color" text,
        "ns_verified"   boolean            NOT NULL DEFAULT false,
        "ns_target"     text,
        "admin_note"    text,
        "created_at"    timestamp          NOT NULL DEFAULT now(),
        "updated_at"    timestamp          NOT NULL DEFAULT now(),
        CONSTRAINT "subdomains_domain_unique" UNIQUE("domain")
      );
    `);

    // ── Step 3: Add FK constraints (safe — skip if already exists) ─────────────
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE "subdomains"
          ADD CONSTRAINT "subdomains_user_id_users_id_fk"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    console.log("[migrate] Schema ready ✓");
  } catch (err: any) {
    console.error("[migrate] Migration error:", err.message);
    // Re-throw to prevent server starting with broken schema
    throw err;
  } finally {
    client.release();
  }
}
