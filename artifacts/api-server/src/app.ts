import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import router from "./routes/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

// ── JWT secret — must be set in production ──────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET environment variable is required in production");
  }
  console.warn("[WARN] JWT_SECRET not set — using insecure dev fallback. Set JWT_SECRET in production!");
}
const JWT_SECRET_USED = JWT_SECRET || "smm-dev-secret-DO-NOT-USE-IN-PRODUCTION";
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

// ── CORS — only allow configured origin ─────────────────────────────────────
const ALLOWED_ORIGIN = process.env.SITE_URL || process.env.ALLOWED_ORIGIN || "";
app.use(cors({
  origin: (origin, callback) => {
    // Allow no-origin requests (server-to-server, curl, mobile apps)
    if (!origin) return callback(null, true);
    // If no allowed origin configured, allow all (dev mode only)
    if (!ALLOWED_ORIGIN) return callback(null, true);
    // Exact match or same-site subdomains
    const allowed = ALLOWED_ORIGIN.split(",").map(s => s.trim()).filter(Boolean);
    const originHost = (() => { try { return new URL(origin).hostname; } catch { return ""; } })();
    const ok = allowed.some(a => {
      try {
        const aHost = new URL(a).hostname;
        return originHost === aHost || originHost.endsWith("." + aHost);
      } catch { return false; }
    });
    if (ok) return callback(null, true);
    return callback(new Error("CORS: Origin not allowed"), false);
  },
  credentials: true,
}));

// ── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Managed separately / by reverse proxy
  crossOriginEmbedderPolicy: false,
}));
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

// ── Body size limits ─────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

// ── Global rate limiting ─────────────────────────────────────────────────────
app.use("/api", rateLimit({
  windowMs: 60 * 1000,         // 1 minute
  max: 300,                     // 300 requests/min per IP (global)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Quá nhiều yêu cầu. Vui lòng thử lại sau." },
  skip: (req) => req.path.startsWith("/api/public/") || req.path.startsWith("/api/health"),
}));

// ── JWT session middleware ───────────────────────────────────────────────────
interface SessionData {
  userId: number;
  userRole: string;
}

app.use((req: Request, _res: Response, next: NextFunction) => {
  const token = req.cookies?.sid;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET_USED) as SessionData;
      (req as any)._session = { userId: payload.userId, userRole: payload.userRole };
    } catch {
      // expired or invalid token — session stays undefined
    }
  }
  next();
});

export function setSession(req: Request, res: Response, data: SessionData | null) {
  if (data === null) {
    res.clearCookie("sid", { httpOnly: true, sameSite: "lax", path: "/" });
    (req as any)._session = undefined;
  } else {
    const token = jwt.sign(
      { userId: data.userId, userRole: data.userRole },
      JWT_SECRET_USED,
      { expiresIn: COOKIE_MAX_AGE_SECONDS }
    );
    res.cookie("sid", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: req.secure || req.headers["x-forwarded-proto"] === "https",
      maxAge: COOKIE_MAX_AGE_SECONDS * 1000,
    });
    (req as any)._session = { userId: data.userId, userRole: data.userRole };
  }
}

export function getSession(req: Request): SessionData | undefined {
  return (req as any)._session;
}

app.use("/api", router);

// ── Static frontend serving (production / cPanel mode) ───────────────────────
// Serves the React build from the `public/` directory next to the server file.
// In dev mode (Vite dev server), this folder won't exist and is skipped.
const publicDir = path.join(__dirname, "public");
if (existsSync(publicDir)) {
  app.use(express.static(publicDir, {
    maxAge: "1y",
    index: false, // let the catch-all below handle it
  }));
  // SPA fallback — all non-API routes serve index.html
  app.get("*", (_req: Request, res: Response) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

export default app;
