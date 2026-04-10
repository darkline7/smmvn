import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// ── Auth endpoints (login, register, password reset) ────────────────────────
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 20,                     // 20 attempts per IP
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: { error: "Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau 15 phút." },
  keyGenerator: (req) => {
    // Rate limit by email (if provided) + IP to prevent email enumeration
    const email = (req.body?.email || "").toLowerCase();
    return email && email.length > 0 ? `auth:${email}` : ipKeyGenerator(req.ip || "127.0.0.1");
  },
});

// ── API v2 / Public API (developers) ──────────────────────────────────────────
export const apiv2RateLimit = rateLimit({
  windowMs: 60 * 1000,    // 1 minute
  max: 120,               // 120 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait before retrying." },
});

// ── Order creation (prevent abuse) ────────────────────────────────────────────
export const orderRateLimit = rateLimit({
  windowMs: 60 * 1000,    // 1 minute
  max: 30,                // Max 30 orders per minute per user
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true,
  message: { error: "Quá nhiều đơn hàng. Vui lòng đợi một chút." },
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise use IP
    return req.body?.userId ? `order:${req.body.userId}` : ipKeyGenerator(req.ip || "127.0.0.1");
  },
});

// ── Password reset (prevent enumeration/brute force) ──────────────────────────
export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,                    // Max 5 reset requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Quá nhiều yêu cầu reset mật khẩu. Vui lòng thử lại sau 1 giờ." },
});

// ── Webhook endpoints (prevent spam) ────────────────────────────────────────
export const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000,    // 1 minute
  max: 100,               // 100 webhooks per minute (generous for payment providers)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Webhook rate limit exceeded" },
});
