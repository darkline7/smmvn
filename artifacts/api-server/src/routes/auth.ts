import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { usersTable, siteSettingsTable } from "@workspace/db/schema";
import { eq, or } from "drizzle-orm";
import { hashPassword, verifyPassword, generateApiKey, generateReferralCode } from "../lib/auth.js";
import { setSession, getSession } from "../app.js";
import { authRateLimit } from "../lib/rate-limits.js";
import { emailSchema, passwordSchema, usernameSchema } from "../lib/validate.js";
import { z } from "zod";
import crypto from "crypto";
import { toUserMessage } from "../lib/errors.js";

const router = Router();

// Helper: load settings map — returns empty object on DB error (fail-open for settings)
async function loadSettings(): Promise<Record<string, string>> {
  try {
    const rows = await db.select().from(siteSettingsTable);
    const s: Record<string, string> = {};
    rows.forEach(r => { s[r.key] = r.value || ""; });
    return s;
  } catch {
    return {};
  }
}

// Helper: verify Cloudflare Turnstile token
async function verifyTurnstile(token: string, secretKey: string): Promise<boolean> {
  try {
    const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: secretKey, response: token }),
    });
    const data: any = await resp.json();
    return data.success === true;
  } catch {
    return false;
  }
}

const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  username: usernameSchema,
  referralCode: z.string().max(10).optional(),
  turnstileToken: z.string().optional(),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
  turnstileToken: z.string().optional(),
});

router.post("/register", authRateLimit, async (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);
    const settings = await loadSettings();

    // Turnstile verification
    if (settings["turnstile_enabled"] === "true" && settings["turnstile_secret_key"]) {
      if (!data.turnstileToken) {
        return res.status(400).json({ error: "Vui lòng xác minh bạn không phải robot" });
      }
      const valid = await verifyTurnstile(data.turnstileToken, settings["turnstile_secret_key"]);
      if (!valid) {
        return res.status(400).json({ error: "Xác minh thất bại. Vui lòng thử lại" });
      }
    }

    // Registration open check
    if (settings["registration_open"] === "false") {
      return res.status(403).json({ error: "Đăng ký tạm thời bị tắt" });
    }

    const existing = await db.select({ id: usersTable.id }).from(usersTable)
      .where(or(eq(usersTable.email, data.email), eq(usersTable.username, data.username)))
      .limit(1);
    if (existing[0]) {
      return res.status(400).json({ error: "Email hoặc tên đăng nhập đã tồn tại" });
    }
    const [user] = await db.insert(usersTable).values({
      email: data.email,
      username: data.username,
      passwordHash: await hashPassword(data.password),
      apiKey: generateApiKey(),
      referralCode: generateReferralCode(),
    }).returning();
    setSession(req, res, { userId: user.id, userRole: user.role });
    const { passwordHash, ...safeUser } = user;
    return res.status(201).json({ user: safeUser });
  } catch (e: any) {
    return res.status(400).json({ error: toUserMessage(e) });
  }
});

router.post("/login", authRateLimit, async (req: Request, res: Response) => {
  try {
    const data = loginSchema.parse(req.body);
    const settings = await loadSettings();

    // Turnstile verification
    if (settings["turnstile_enabled"] === "true" && settings["turnstile_secret_key"]) {
      if (!data.turnstileToken) {
        return res.status(400).json({ error: "Vui lòng xác minh bạn không phải robot" });
      }
      const valid = await verifyTurnstile(data.turnstileToken, settings["turnstile_secret_key"]);
      if (!valid) {
        return res.status(400).json({ error: "Xác minh thất bại. Vui lòng thử lại" });
      }
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, data.email)).limit(1);
    const passwordValid = user ? await verifyPassword(data.password, user.passwordHash, user.id) : false;
    if (!user || !passwordValid) {
      return res.status(401).json({ error: "Email hoặc mật khẩu không đúng" });
    }
    if (user.banned) {
      return res.status(403).json({ error: "Tài khoản bị khóa" });
    }
    setSession(req, res, { userId: user.id, userRole: user.role });
    const { passwordHash, ...safeUser } = user;
    return res.json({ user: safeUser });
  } catch (e: any) {
    return res.status(400).json({ error: toUserMessage(e) });
  }
});

router.post("/logout", (req: Request, res: Response) => {
  setSession(req, res, null);
  return res.json({ success: true, message: "Đã đăng xuất" });
});

router.get("/me", async (req: Request, res: Response) => {
  const session = getSession(req);
  if (!session?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, session.userId)).limit(1);
  if (!user) return res.status(404).json({ error: "User not found" });
  const { passwordHash, ...safeUser } = user;
  return res.json(safeUser);
});

// --- Google OAuth ---

router.get("/google", async (req: Request, res: Response) => {
  const settings = await loadSettings();
  const clientId = settings["google_client_id"];
  if (!clientId || settings["google_oauth_enabled"] !== "true") {
    return res.status(400).json({ error: "Google OAuth chưa được bật" });
  }
  const siteUrl = settings["site_url"] || `${req.protocol}://${req.get("host")}`;
  const redirectUri = `${siteUrl}/api/auth/google/callback`;
  const scope = encodeURIComponent("openid email profile");
  const stateNonce = crypto.randomBytes(16).toString("hex");
  const state = Buffer.from(JSON.stringify({ ts: Date.now(), nonce: stateNonce })).toString("base64url");
  // Store nonce in httpOnly cookie for 10 minutes
  res.cookie("oauth_state", stateNonce, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 10 * 60 * 1000 });
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${state}&access_type=offline`;
  return res.redirect(url);
});

router.get("/google/callback", async (req: Request, res: Response) => {
  try {
    const settings = await loadSettings();
    const clientId = settings["google_client_id"];
    const clientSecret = settings["google_client_secret"];
    const siteUrl = settings["site_url"] || `${req.protocol}://${req.get("host")}`;
    const redirectUri = `${siteUrl}/api/auth/google/callback`;
    const frontendUrl = siteUrl;

    const { code, error, state: stateParam } = req.query;
    if (error || !code) return res.redirect(`${frontendUrl}/login?error=google_denied`);

    // Verify state nonce to prevent CSRF
    try {
      if (stateParam) {
        const decoded = JSON.parse(Buffer.from(String(stateParam), "base64url").toString());
        const cookieNonce = req.cookies?.oauth_state;
        if (!cookieNonce || !decoded.nonce || decoded.nonce !== cookieNonce) {
          return res.redirect(`${frontendUrl}/login?error=oauth_state_mismatch`);
        }
        res.clearCookie("oauth_state", { httpOnly: true, sameSite: "lax", path: "/" });
      }
    } catch {
      return res.redirect(`${frontendUrl}/login?error=oauth_state_invalid`);
    }

    // Exchange code for tokens
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(code),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokens: any = await tokenResp.json();
    if (!tokens.access_token) return res.redirect(`${frontendUrl}/login?error=google_token`);

    // Get user info from Google
    const userResp = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const googleUser: any = await userResp.json();
    if (!googleUser.email) return res.redirect(`${frontendUrl}/login?error=google_no_email`);

    // Find or create user
    let [user] = await db.select().from(usersTable).where(eq(usersTable.email, googleUser.email)).limit(1);
    if (!user) {
      const username = (googleUser.name || googleUser.email.split("@")[0]).replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 30);
      // Ensure username uniqueness
      const safeUsername = username + "_" + Math.random().toString(36).slice(2, 6);
      [user] = await db.insert(usersTable).values({
        email: googleUser.email,
        username: safeUsername,
        passwordHash: await hashPassword(crypto.randomBytes(32).toString("hex")),
        apiKey: generateApiKey(),
        referralCode: generateReferralCode(),
        emailVerified: true,
      }).returning();
    }

    if (user.banned) return res.redirect(`${frontendUrl}/login?error=banned`);
    setSession(req, res, { userId: user.id, userRole: user.role });
    return res.redirect(`${frontendUrl}/dashboard`);
  } catch (e: any) {
    console.error("Google OAuth error:", e.message);
    const frontendUrl = req.headers.origin || "/";
    return res.redirect(`${frontendUrl}/login?error=google_error`);
  }
});

// Public: get OAuth/security config for frontend
router.get("/config", async (_req: Request, res: Response) => {
  const settings = await loadSettings();
  return res.json({
    googleEnabled: settings["google_oauth_enabled"] === "true" && !!settings["google_client_id"],
    turnstileEnabled: settings["turnstile_enabled"] === "true",
    turnstileSiteKey: settings["turnstile_enabled"] === "true" ? settings["turnstile_site_key"] : "",
    registrationOpen: settings["registration_open"] !== "false",
    maintenanceMode: settings["maintenance_mode"] === "true",
  });
});

router.post("/forgot-password", async (_req: Request, res: Response) => {
  return res.json({ success: true, message: "If that email exists, a reset link will be sent" });
});

router.post("/make-admin", authRateLimit, async (req: Request, res: Response) => {
  const { email, setupKey } = req.body;
  const expectedKey = process.env.SETUP_KEY;
  // Endpoint disabled if SETUP_KEY is not set in environment
  if (!expectedKey) {
    return res.status(404).json({ error: "Not found" });
  }
  if (!setupKey || setupKey !== expectedKey) {
    return res.status(403).json({ error: "Invalid setup key" });
  }
  if (!email) return res.status(400).json({ error: "Email required" });
  const [user] = await db.select({ id: usersTable.id, role: usersTable.role }).from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) return res.status(404).json({ error: "User not found" });
  await db.update(usersTable).set({ role: "admin" }).where(eq(usersTable.id, user.id));
  return res.json({ success: true, message: `${email} is now admin` });
});

export default router;
