import { pgTable, serial, text, boolean, integer, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const serviceTypeEnum = pgEnum("service_type", ["default", "custom_comments", "packages", "subscriptions"]);
export const serviceStatusEnum = pgEnum("service_status", ["active", "inactive"]);

export const servicesTable = pgTable("services", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull(),
  name: text("name").notNull(),
  providerId: integer("provider_id"),
  providerServiceId: text("provider_service_id"),
  type: serviceTypeEnum("type").notNull().default("default"),
  rate: numeric("rate", { precision: 10, scale: 4 }).notNull(),
  min: integer("min").notNull(),
  max: integer("max").notNull(),
  description: text("description"),
  averageTime: text("average_time"),
  refill: boolean("refill").notNull().default(false),
  cancel: boolean("cancel").notNull().default(false),
  dripfeed: boolean("dripfeed").notNull().default(false),
  subscriptions: boolean("subscriptions").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  status: serviceStatusEnum("status").notNull().default("active"),
  tags: text("tags").array(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertServiceSchema = createInsertSchema(servicesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof servicesTable.$inferSelect;
