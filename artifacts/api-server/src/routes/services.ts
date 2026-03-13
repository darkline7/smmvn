import { Router } from "express";
import { db } from "@workspace/db";
import { servicesTable, categoriesTable } from "@workspace/db/schema";
import { eq, and, ilike, sql } from "drizzle-orm";

const router = Router();

router.get("/categories", async (req, res) => {
  const categories = await db.select({
    id: categoriesTable.id,
    name: categoriesTable.name,
    description: categoriesTable.description,
    sortOrder: categoriesTable.sortOrder,
    active: categoriesTable.active,
    serviceCount: sql<number>`(SELECT COUNT(*) FROM services WHERE services.category_id = categories.id AND services.status = 'active')`,
  }).from(categoriesTable)
    .where(eq(categoriesTable.active, true))
    .orderBy(categoriesTable.sortOrder, categoriesTable.name);
  return res.json({ categories });
});

router.get("/services", async (req, res) => {
  const { categoryId, search } = req.query;
  let query = db.select({
    id: servicesTable.id,
    categoryId: servicesTable.categoryId,
    categoryName: sql<string>`(SELECT name FROM categories WHERE id = services.category_id)`,
    name: servicesTable.name,
    type: servicesTable.type,
    rate: servicesTable.rate,
    min: servicesTable.min,
    max: servicesTable.max,
    description: servicesTable.description,
    averageTime: servicesTable.averageTime,
    refill: servicesTable.refill,
    cancel: servicesTable.cancel,
    dripfeed: servicesTable.dripfeed,
    subscriptions: servicesTable.subscriptions,
    status: servicesTable.status,
  }).from(servicesTable)
    .where(eq(servicesTable.status, "active"))
    .orderBy(servicesTable.sortOrder, servicesTable.name)
    .$dynamic();

  if (categoryId) {
    query = query.where(and(eq(servicesTable.status, "active"), eq(servicesTable.categoryId, Number(categoryId))));
  }
  if (search) {
    query = query.where(and(eq(servicesTable.status, "active"), ilike(servicesTable.name, `%${search}%`)));
  }

  const services = await query;
  return res.json({ services });
});

router.get("/services/:id", async (req, res) => {
  const service = await db.select({
    id: servicesTable.id,
    categoryId: servicesTable.categoryId,
    categoryName: sql<string>`(SELECT name FROM categories WHERE id = services.category_id)`,
    name: servicesTable.name,
    type: servicesTable.type,
    rate: servicesTable.rate,
    min: servicesTable.min,
    max: servicesTable.max,
    description: servicesTable.description,
    averageTime: servicesTable.averageTime,
    refill: servicesTable.refill,
    cancel: servicesTable.cancel,
    dripfeed: servicesTable.dripfeed,
    subscriptions: servicesTable.subscriptions,
    status: servicesTable.status,
  }).from(servicesTable).where(eq(servicesTable.id, Number(req.params.id))).limit(1);
  
  if (!service[0]) return res.status(404).json({ error: "Service not found" });
  return res.json(service[0]);
});

export default router;
