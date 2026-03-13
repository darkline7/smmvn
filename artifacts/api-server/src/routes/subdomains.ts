import { Router } from "express";
import { db } from "@workspace/db";
import { subdomainsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth.js";
import type { AuthRequest } from "../lib/auth.js";

const router = Router();

// GET /api/subdomains — user's subdomains
router.get("/", requireAuth as any, async (req: AuthRequest, res: any) => {
  try {
    const rows = await db
      .select()
      .from(subdomainsTable)
      .where(eq(subdomainsTable.userId, req.userId!))
      .orderBy(desc(subdomainsTable.createdAt));
    res.json({ subdomains: rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/subdomains — register domain
router.post("/", requireAuth as any, async (req: AuthRequest, res: any) => {
  try {
    const { domain, siteName, logoUrl, primaryColor } = req.body;
    if (!domain) return res.status(400).json({ error: "Domain là bắt buộc" });

    const clean = domain.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z]{2,})+$/.test(clean)) {
      return res.status(400).json({ error: "Tên miền không hợp lệ" });
    }

    const existing = await db.select().from(subdomainsTable).where(eq(subdomainsTable.domain, clean)).limit(1);
    if (existing.length > 0) return res.status(409).json({ error: "Tên miền đã được đăng ký" });

    const HOST = process.env.REPLIT_DOMAINS?.split(",")[0] || "smmvn.replit.app";
    const [row] = await db.insert(subdomainsTable).values({
      userId: req.userId!,
      domain: clean,
      siteName: siteName || clean,
      logoUrl: logoUrl || null,
      primaryColor: primaryColor || null,
      nsTarget: HOST,
      status: "pending",
    }).returning();

    res.json({ subdomain: row });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/subdomains/:id
router.delete("/:id", requireAuth as any, async (req: AuthRequest, res: any) => {
  try {
    const id = parseInt(req.params.id);
    const [row] = await db.select().from(subdomainsTable).where(eq(subdomainsTable.id, id)).limit(1);
    if (!row) return res.status(404).json({ error: "Không tìm thấy" });
    if (row.userId !== req.userId) return res.status(403).json({ error: "Không có quyền" });
    await db.delete(subdomainsTable).where(eq(subdomainsTable.id, id));
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/subdomains/admin/all
router.get("/admin/all", requireAdmin as any, async (_req: any, res: any) => {
  try {
    const rows = await db.select().from(subdomainsTable).orderBy(desc(subdomainsTable.createdAt));
    res.json({ subdomains: rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/subdomains/admin/:id
router.patch("/admin/:id", requireAdmin as any, async (req: any, res: any) => {
  try {
    const id = parseInt(req.params.id);
    const { status, adminNote, nsVerified } = req.body;
    const [row] = await db
      .update(subdomainsTable)
      .set({
        ...(status ? { status } : {}),
        ...(adminNote !== undefined ? { adminNote } : {}),
        ...(nsVerified !== undefined ? { nsVerified } : {}),
        updatedAt: new Date(),
      })
      .where(eq(subdomainsTable.id, id))
      .returning();
    res.json({ subdomain: row });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
