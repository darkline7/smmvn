import { pgTable, serial, integer, text, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const transactionTypeEnum = pgEnum("transaction_type", ["deposit", "order", "refund", "adjustment", "commission"]);
export const depositStatusEnum = pgEnum("deposit_status", ["pending", "approved", "rejected"]);
export const depositMethodEnum = pgEnum("deposit_method", ["bank_transfer", "qr_payment", "crypto"]);

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: transactionTypeEnum("type").notNull(),
  amount: numeric("amount", { precision: 10, scale: 4 }).notNull(),
  balanceAfter: numeric("balance_after", { precision: 12, scale: 4 }).notNull(),
  description: text("description"),
  referenceId: integer("reference_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const depositsTable = pgTable("deposits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  amount: numeric("amount", { precision: 10, scale: 4 }).notNull(),
  method: depositMethodEnum("method").notNull(),
  status: depositStatusEnum("status").notNull().default("pending"),
  proofUrl: text("proof_url"),
  note: text("note"),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true, createdAt: true });
export const insertDepositSchema = createInsertSchema(depositsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type InsertDeposit = z.infer<typeof insertDepositSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
export type Deposit = typeof depositsTable.$inferSelect;
