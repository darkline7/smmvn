import { ZodError } from "zod";

/**
 * Convert any caught error into a user-safe message.
 * - ZodError: show validation details (safe, user-facing)
 * - Everything else: generic message (hides DB/internal stack traces)
 */
export function toUserMessage(err: unknown, fallback = "Có lỗi xảy ra. Vui lòng thử lại sau."): string {
  if (err instanceof ZodError) {
    const first = err.errors[0];
    if (first) return `${first.path.join(".") ? first.path.join(".") + ": " : ""}${first.message}`;
    return err.message;
  }
  if (err instanceof Error) {
    // Allow explicitly "safe" errors thrown intentionally (usually from route logic)
    if ((err as any)._safe === true) return err.message;
  }
  return fallback;
}

/** Create an error that is safe to expose directly to users */
export function safeError(message: string): Error & { _safe: true } {
  const err = new Error(message) as Error & { _safe: true };
  err._safe = true;
  return err;
}
