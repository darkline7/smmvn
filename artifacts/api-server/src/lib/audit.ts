/**
 * Audit logging utility
 * Tracks admin actions for security & compliance
 */

import { Request } from "express";
import { db } from "@workspace/db";
import * as schema from "@workspace/db/schema";

export interface AuditAction {
  resource: string;      // e.g., "user", "order", "settings"
  action: string;        // e.g., "create", "update", "delete"
  resourceId?: string | string[];   // e.g., user_id, order_id
  details?: Record<string, any>;  // e.g., { oldValue, newValue }
  status: "success" | "failed";
  errorMessage?: string;
}

/**
 * Log audit event to database
 */
export async function auditLog(
  userId: number,
  action: AuditAction,
  ip?: string,
  userAgent?: string,
) {
  try {
    // Ensure resourceId is a string (handle Express route params which can be string[])
    const resourceId = Array.isArray(action.resourceId) 
      ? action.resourceId[0] 
      : action.resourceId || null;

    await db.insert(schema.auditLogsTable).values({
      userId,
      resource: action.resource,
      action: action.action,
      resourceId: resourceId,
      details: action.details ? JSON.stringify(action.details) : null,
      status: action.status,
      errorMessage: action.errorMessage || null,
      ip: ip || null,
      userAgent: userAgent || null,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error("[audit] Failed to log action:", err);
    // Don't throw — audit logging should not break the main operation
  }
}

/**
 * Middleware: attach client IP & user agent to request
 */
export function auditMiddleware(req: Request, res: any, next: Function) {
  const ip = req.ip || req.headers["x-forwarded-for"] || "";
  const userAgent = req.headers["user-agent"] || "";
  (req as any)._audit = { ip, userAgent };
  next();
}

/**
 * Example usage in route:
 * 
 * router.post("/users/:id/ban", requireAdmin, async (req: AuthRequest, res) => {
 *   try {
 *     // ... do operation ...
 *     await auditLog(req.userId!, {
 *       resource: "user",
 *       action: "ban",
 *       resourceId: req.params.id,
 *       details: { reason: req.body.reason },
 *       status: "success",
 *     }, (req as any)._audit?.ip);
 *   } catch (err) {
 *     await auditLog(req.userId!, {
 *       resource: "user",
 *       action: "ban",
 *       resourceId: req.params.id,
 *       status: "failed",
 *       errorMessage: err.message,
 *     });
 *   }
 * });
 */
