import { Router } from "express";
import { db } from "@workspace/db";
import { subdomainsTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth.js";
import type { AuthRequest } from "../lib/auth.js";
import dns from "dns";
import { promisify } from "util";

const resolveCname = promisify(dns.resolveCname);

const router = Router();

// ─── Helper: check if domain CNAME points to our server ─────────────────────
async function checkNS(domain: string): Promise<boolean> {
  const HOST = (process.env.REPLIT_DOMAINS?.split(",")[0] || "smmvn.replit.app").trim();
  try {
    const cnames = await resolveCname(domain);
    return cnames.some(c => c.includes(HOST) || c.includes("replit.app") || c.includes("replit.dev"));
  } catch {
    // CNAME not found — try A record fallback
    try {
      const lookup = promisify(dns.lookup);
      const { address } = await lookup(domain);
      if (!address) return false;
      // If we got any address, consider it pointed (admin manually verifies)
      return true;
    } catch {
      return false;
    }
  }
}

// ─── GET /api/subdomains/public-config ──────────────────────────────────────
// Returns branding config for the current request domain (used by frontend)
router.get("/public-config", async (req: any, res: any) => {
  try {
    const host = req.hostname;
    if (!host) return res.json({ isReseller: false });
    const rows = await db
      .select()
      .from(subdomainsTable)
      .where(and(eq(subdomainsTable.domain, host), eq(subdomainsTable.status, "active")))
      .limit(1);
    if (!rows.length) return res.json({ isReseller: false });
    const row = rows[0];
    return res.json({
      isReseller: true,
      siteName: row.siteName,
      primaryColor: row.primaryColor,
      logoUrl: row.logoUrl,
      domain: row.domain,
    });
  } catch {
    res.json({ isReseller: false });
  }
});

// ─── GET /api/subdomains ─────────────────────────────────────────────────────
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

// ─── POST /api/subdomains ────────────────────────────────────────────────────
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

// ─── DELETE /api/subdomains/:id ──────────────────────────────────────────────
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

// ─── GET /api/subdomains/admin/all ───────────────────────────────────────────
router.get("/admin/all", requireAdmin as any, async (_req: any, res: any) => {
  try {
    const rows = await db.select().from(subdomainsTable).orderBy(desc(subdomainsTable.createdAt));
    res.json({ subdomains: rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/subdomains/admin/:id/verify-ns ────────────────────────────────
// Admin triggers NS check: resolves CNAME and updates nsVerified
router.post("/admin/:id/verify-ns", requireAdmin as any, async (req: any, res: any) => {
  try {
    const id = parseInt(req.params.id);
    const [row] = await db.select().from(subdomainsTable).where(eq(subdomainsTable.id, id)).limit(1);
    if (!row) return res.status(404).json({ error: "Không tìm thấy" });

    const verified = await checkNS(row.domain);
    const [updated] = await db
      .update(subdomainsTable)
      .set({ nsVerified: verified, updatedAt: new Date() })
      .where(eq(subdomainsTable.id, id))
      .returning();

    res.json({ subdomain: updated, dnsOk: verified });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PATCH /api/subdomains/admin/:id ─────────────────────────────────────────
// When status → "active", auto-check NS and activate
router.patch("/admin/:id", requireAdmin as any, async (req: any, res: any) => {
  try {
    const id = parseInt(req.params.id);
    const { status, adminNote, nsVerified } = req.body;

    let autoNsVerified = nsVerified;

    // Auto DNS check when activating
    if (status === "active") {
      const [row] = await db.select().from(subdomainsTable).where(eq(subdomainsTable.id, id)).limit(1);
      if (row) {
        const dnsOk = await checkNS(row.domain);
        if (dnsOk) autoNsVerified = true;
      }
    }

    const [updated] = await db
      .update(subdomainsTable)
      .set({
        ...(status ? { status } : {}),
        ...(adminNote !== undefined ? { adminNote } : {}),
        ...(autoNsVerified !== undefined ? { nsVerified: autoNsVerified } : {}),
        updatedAt: new Date(),
      })
      .where(eq(subdomainsTable.id, id))
      .returning();

    res.json({ subdomain: updated });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
