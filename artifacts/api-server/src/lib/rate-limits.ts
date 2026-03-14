import rateLimit from "express-rate-limit";

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau 15 phút." },
});

// API v2 rate limit: 120 requests / minute per IP
export const apiv2RateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait before retrying." },
});
