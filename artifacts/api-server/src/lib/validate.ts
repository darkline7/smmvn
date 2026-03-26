/**
 * Input validation & sanitization utilities
 * Prevents: XSS, SQL injection, path traversal, invalid formats
 */

import { z } from "zod";

// ── Basic validators ──────────────────────────────────────────────────────────

/**
 * Validate URL (social media links)
 * Allows: https://instagram.com/username, https://tiktok.com/@user, etc
 * Rejects: javascript://, file://, data:URIs
 */
export const urlSchema = z
  .string()
  .url()
  .refine((url) => {
    const u = new URL(url);
    // Only allow http/https
    return ["http:", "https:"].includes(u.protocol);
  }, "Only HTTP/HTTPS URLs allowed")
  .refine((url) => {
    // Reject suspicious domains (localhost, internal IPs)
    const u = new URL(url);
    const host = u.hostname;
    return !(
      host === "localhost" ||
      host.startsWith("127.") ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      host === "0.0.0.0"
    );
  }, "Local/internal URLs not allowed");

/**
 * Validate email
 */
export const emailSchema = z
  .string()
  .email()
  .toLowerCase()
  .max(254); // RFC 5321

/**
 * Validate password
 */
export const passwordSchema = z
  .string()
  .min(8, "Mật khẩu tối thiểu 8 ký tự")
  .max(128)
  .refine(
    (pwd) => /[A-Z]/.test(pwd),
    "Mật khẩu phải chứa ít nhất 1 chữ hoa"
  )
  .refine(
    (pwd) => /[a-z]/.test(pwd),
    "Mật khẩu phải chứa ít nhất 1 chữ thường"
  )
  .refine(
    (pwd) => /[0-9]/.test(pwd),
    "Mật khẩu phải chứa ít nhất 1 chữ số"
  );

/**
 * Validate username
 */
export const usernameSchema = z
  .string()
  .min(3)
  .max(30)
  .regex(/^[a-zA-Z0-9_]+$/, "Username chỉ chứa chữ, số và dấu gạch chân");

/**
 * Validate API key
 */
export const apiKeySchema = z
  .string()
  .min(32)
  .max(256)
  .regex(/^[a-f0-9]+$/, "Invalid API key format");

/**
 * Validate quantity (for orders)
 */
export const quantitySchema = z
  .number()
  .int()
  .positive()
  .max(1_000_000, "Số lượng quá lớn");

/**
 * Validate positive numeric value (balance, price, etc)
 */
export const positiveNumberSchema = z
  .number()
  .nonnegative()
  .max(999_999_999, "Giá trị quá lớn");

/**
 * Validate status enum
 */
export const orderStatusSchema = z.enum([
  "pending",
  "processing",
  "active",
  "completed",
  "partial",
  "cancelled",
  "failed",
]);

/**
 * Validate user role
 */
export const userRoleSchema = z.enum(["user", "admin", "reseller"]);

// ── Sanitization ──────────────────────────────────────────────────────────────

/**
 * Remove HTML tags and dangerous characters
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/[<>"'&]/g, (char) => {
      const map: Record<string, string> = {
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#x27;",
        "&": "&amp;",
      };
      return map[char];
    })
    .trim();
}

/**
 * Safe JSON parse with fallback
 */
export function safeParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

/**
 * Validate phone number (basic)
 */
export function isValidPhone(phone: string): boolean {
  return /^[0-9+\-().\s]{7,20}$/.test(phone.replace(/\s/g, ""));
}

/**
 * Validate social media username (very basic)
 */
export function isValidSocialUsername(username: string): boolean {
  // Allow alphanumeric, dots, underscores, hyphens
  return /^[a-zA-Z0-9._-]{2,}$/.test(username);
}
