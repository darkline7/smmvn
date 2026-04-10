export const ORDER_STATUSES = [
  "pending",
  "processing",
  "active",
  "completed",
  "partial",
  "cancelled",
  "failed",
] as const;

export const TICKET_STATUSES = ["open", "pending", "closed"] as const;

const ORDER_STATUS_SET = new Set<string>(ORDER_STATUSES);
const TICKET_STATUS_SET = new Set<string>(TICKET_STATUSES);

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && ORDER_STATUS_SET.has(value);
}

export function isTicketStatus(value: unknown): value is TicketStatus {
  return typeof value === "string" && TICKET_STATUS_SET.has(value);
}
