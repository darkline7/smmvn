CREATE TYPE "public"."user_role" AS ENUM('user', 'admin', 'reseller');--> statement-breakpoint
CREATE TYPE "public"."provider_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."service_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."service_type" AS ENUM('default', 'custom_comments', 'packages', 'subscriptions');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'processing', 'active', 'completed', 'partial', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."deposit_method" AS ENUM('bank_transfer', 'qr_payment', 'crypto');--> statement-breakpoint
CREATE TYPE "public"."deposit_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('deposit', 'order', 'refund', 'adjustment', 'commission');--> statement-breakpoint
CREATE TYPE "public"."ticket_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'pending', 'closed');--> statement-breakpoint
CREATE TYPE "public"."announcement_type" AS ENUM('info', 'warning', 'maintenance', 'success');--> statement-breakpoint
CREATE TYPE "public"."api_log_status" AS ENUM('success', 'error');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('system', 'order', 'ticket', 'deposit');--> statement-breakpoint
CREATE TYPE "public"."subdomain_status" AS ENUM('pending', 'active', 'suspended', 'rejected');--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"balance" numeric(12, 4) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"api_key" text,
	"referral_code" text,
	"referred_by" serial NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_api_key_unique" UNIQUE("api_key"),
	CONSTRAINT "users_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"base_url" text NOT NULL,
	"api_key" text NOT NULL,
	"status" "provider_status" DEFAULT 'active' NOT NULL,
	"markup_percent" text DEFAULT '25' NOT NULL,
	"notes" text,
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"name" text NOT NULL,
	"provider_id" integer,
	"provider_service_id" text,
	"type" "service_type" DEFAULT 'default' NOT NULL,
	"rate" numeric(10, 4) NOT NULL,
	"min" integer NOT NULL,
	"max" integer NOT NULL,
	"description" text,
	"average_time" text,
	"refill" boolean DEFAULT false NOT NULL,
	"cancel" boolean DEFAULT false NOT NULL,
	"dripfeed" boolean DEFAULT false NOT NULL,
	"subscriptions" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "service_status" DEFAULT 'active' NOT NULL,
	"tags" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"status" text NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"service_id" integer NOT NULL,
	"link" text NOT NULL,
	"quantity" integer NOT NULL,
	"start_count" integer,
	"remains" integer,
	"charge" numeric(10, 4) NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"provider_order_id" text,
	"runs" integer,
	"interval" integer,
	"comments" text,
	"username" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deposits" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"amount" numeric(10, 4) NOT NULL,
	"method" "deposit_method" NOT NULL,
	"status" "deposit_status" DEFAULT 'pending' NOT NULL,
	"proof_url" text,
	"note" text,
	"admin_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" "transaction_type" NOT NULL,
	"amount" numeric(10, 4) NOT NULL,
	"balance_after" numeric(12, 4) NOT NULL,
	"description" text,
	"reference_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"message" text NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"subject" text NOT NULL,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"priority" "ticket_priority" DEFAULT 'medium' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"type" "announcement_type" DEFAULT 'info' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_request_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"action" text NOT NULL,
	"request_body" jsonb,
	"response_body" jsonb,
	"status" "api_log_status" NOT NULL,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_charges" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"telco" text NOT NULL,
	"serial" text NOT NULL,
	"code" text NOT NULL,
	"declared_amount" integer NOT NULL,
	"actual_amount" numeric(12, 2),
	"request_id" text NOT NULL,
	"status" integer DEFAULT 2 NOT NULL,
	"message" text,
	"usd_credited" numeric(10, 4),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "card_charges_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" serial PRIMARY KEY NOT NULL,
	"referrer_id" integer NOT NULL,
	"referred_user_id" integer NOT NULL,
	"commission" numeric(10, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "site_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "subdomains" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"domain" text NOT NULL,
	"status" "subdomain_status" DEFAULT 'pending' NOT NULL,
	"site_name" text,
	"logo_url" text,
	"primary_color" text,
	"ns_verified" boolean DEFAULT false NOT NULL,
	"ns_target" text,
	"admin_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subdomains_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
ALTER TABLE "subdomains" ADD CONSTRAINT "subdomains_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;