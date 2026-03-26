import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import { auditMiddleware } from "./lib/audit.js";
import router from "./routes/index.js";

// ── __dirname shim ─────────────────────────────────────────────────────────────
// Works in both ESM (tsx dev) and CJS bundle (production).
// In production, esbuild's banner+define replaces import.meta.url with:
//   require("url").pathToFileURL(__filename).href
// so fileURLToPath() resolves to the correct on-disk path of dist/index.cjs.
const __appDir = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

// ── Trust proxy — needed behind nginx/Apache/cPanel reverse proxy ─────────────
// Without this, req.ip, req.secure, and rate limiting use the proxy IP.
app.set("trust proxy", 1);

// ── JWT secret — must be set in production ────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "JWT_SECRET environment variable is required in production.\n" +
      "Generate with: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\""
    );
  }
  console.warn(
    "[WARN] JWT_SECRET not set — using insecure dev fallback. " +
    "Set JWT_SECRET in production!"
  );
}
const JWT_SECRET_USED = JWT_SECRET || "smm-dev-secret-DO-NOT-USE-IN-PRODUCTION";
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

// ── CORS — only allow configured origin ──────────────────────────────────────
const ALLOWED_ORIGIN = process.env.SITE_URL || process.env.ALLOWED_ORIGIN || "";
app.use(cors({
  origin: (origin, callback) => {
    // Allow no-origin requests (server-to-server, curl, mobile apps)
    if (!origin) return callback(null, true);
    // If no allowed origin configured, allow all (dev mode only)
    if (!ALLOWED_ORIGIN) return callback(null, true);
    // Exact match or same-site subdomains
    const allowed = ALLOWED_ORIGIN.split(",").map(s => s.trim()).filter(Boolean);
    const originHost = (() => {
      try { return new URL(origin).hostname; } catch { return ""; }
    })();
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

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Vite requires unsafe-inline in dev
      styleSrc: ["'self'", "'unsafe-inline'"],   // Tailwind requires unsafe-inline
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'", process.env.SITE_URL || "http://localhost:5173"],
      frameSrc: ["'none'"],     // No iframes
      objectSrc: ["'none'"],    // No plugins
      mediaSrc: ["'none'"],     // No media
      baseUri: ["'self'"],
      formAction: ["'self'"],   // Forms can only submit to self
      ...(process.env.NODE_ENV === "production" && {
        upgradeInsecureRequests: [],
      }),
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Needed for some CDNs
}));
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});

// ── Body size limits ──────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

// ── CSRF Protection (Simple Origin/Referer check) ──────────────────────────────
// Only check for state-changing requests (POST, PUT, DELETE, PATCH)
app.use((req: Request, res: Response, next: NextFunction) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // Allow requests from API itself (for cron jobs, webhooks)
  if (!req.headers.origin && !req.headers.referer) {
    // Server-to-server requests
    return next();
  }

  const allowedOrigins = [
    ALLOWED_ORIGIN,
    process.env.SITE_URL,
    `http://localhost:5173`,
    `http://localhost:3000`,
  ].filter(Boolean);

  const origin = req.headers.origin || req.headers.referer?.split("/").slice(0, 3).join("/");
  const originHost = (() => {
    try { return origin ? new URL(origin).origin : null; } catch { return null; }
  })();

  const isAllowed = allowedOrigins.some((a) => {
    if (!a) return false;
    try {
      const aOrigin = new URL(a).origin;
      return originHost === aOrigin;
    } catch { return false; }
  });

  if (!isAllowed && req.headers.origin) {
    console.warn(`[CSRF] Rejected request from origin: ${req.headers.origin}`);
    return res.status(403).json({ error: "CSRF validation failed" });
  }

  next();
});

// ── Global rate limiting ──────────────────────────────────────────────────────
app.use("/api", rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Quá nhiều yêu cầu. Vui lòng thử lại sau." },
  skip: (req) =>
    req.path.startsWith("/api/public/") ||
    req.path.startsWith("/api/health"),
}));

// ── Audit middleware (attach IP & user-agent to request) ──────────────────────
app.use(auditMiddleware as any);

// ── JWT session middleware ────────────────────────────────────────────────────
interface SessionData {
  userId: number;
  userRole: string;
}

app.use((req: Request, _res: Response, next: NextFunction) => {
  const token = req.cookies?.sid;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET_USED) as SessionData;
      (req as any)._session = {
        userId: payload.userId,
        userRole: payload.userRole,
      };
    } catch {
      // expired or invalid token — session stays undefined
    }
  }
  next();
});

export function setSession(
  req: Request,
  res: Response,
  data: SessionData | null
) {
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

// ── API routes ────────────────────────────────────────────────────────────────
app.use("/api", router);

// ── Static frontend serving (production / cPanel) ─────────────────────────────
// __appDir in the CJS bundle = dist/ — so publicDir = dist/public/
// In Vite dev mode, the public/ folder doesn't exist; this block is skipped.
const publicDir = path.join(__appDir, "public");
if (existsSync(publicDir)) {
  // Serve static assets with long-lived cache headers
  app.use(
    express.static(publicDir, {
      maxAge: "1y",
      index: false, // SPA fallback below handles /
    })
  );

  // SPA fallback — Express 5 requires a named or regex wildcard (not bare "*")
  // Regex /(.*)/ matches every path, so React Router handles client-side routing.
  app.get(/(.*)/, (_req: Request, res: Response) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

export default app;
