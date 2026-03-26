import { Router } from "express";
import { db } from "@workspace/db";
import { ticketsTable, ticketMessagesTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import type { AuthRequest } from "../lib/auth.js";
import { z } from "zod";
import { notifyNewTicket } from "../lib/telegram.js";
import { toUserMessage } from "../lib/errors.js";

const router = Router();

router.get("/", requireAuth as any, async (req: AuthRequest, res: any) => {
  const { status } = req.query;
  let conditions: any[] = [eq(ticketsTable.userId, req.userId!)];
  if (status) conditions.push(eq(ticketsTable.status, status as any));
  
  const tickets = await db.select().from(ticketsTable).where(and(...conditions)).orderBy(desc(ticketsTable.updatedAt));
  return res.json({ tickets });
});

const createTicketSchema = z.object({
  subject: z.string().min(5).max(200),
  message: z.string().min(10),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
});

router.post("/", requireAuth as any, async (req: AuthRequest, res: any) => {
  try {
    const data = createTicketSchema.parse(req.body);
    const [ticket] = await db.insert(ticketsTable).values({
      userId: req.userId!,
      subject: data.subject,
      status: "open",
      priority: data.priority,
    }).returning();
    
    await db.insert(ticketMessagesTable).values({
      ticketId: ticket.id,
      userId: req.userId!,
      message: data.message,
      isAdmin: false,
    });

    // Notify admin via Telegram (fire-and-forget)
    notifyNewTicket({ id: ticket.id, userId: req.userId!, subject: data.subject }).catch(() => {});
    
    return res.status(201).json(ticket);
  } catch (e: any) {
    return res.status(400).json({ error: toUserMessage(e) });
  }
});

router.get("/:id", requireAuth as any, async (req: AuthRequest, res: any) => {
  const ticket = await db.select().from(ticketsTable).where(and(eq(ticketsTable.id, Number(req.params.id)), eq(ticketsTable.userId, req.userId!))).limit(1);
  if (!ticket[0]) return res.status(404).json({ error: "Ticket not found" });
  const messages = await db.select().from(ticketMessagesTable).where(eq(ticketMessagesTable.ticketId, ticket[0].id)).orderBy(ticketMessagesTable.createdAt);
  return res.json({ ...ticket[0], messages });
});

router.post("/:id/messages", requireAuth as any, async (req: AuthRequest, res: any) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Message is required" });
  const ticket = await db.select().from(ticketsTable).where(and(eq(ticketsTable.id, Number(req.params.id)), eq(ticketsTable.userId, req.userId!))).limit(1);
  if (!ticket[0]) return res.status(404).json({ error: "Ticket not found" });
  if (ticket[0].status === "closed") return res.status(400).json({ error: "Ticket is closed" });
  
  const [msg] = await db.insert(ticketMessagesTable).values({
    ticketId: ticket[0].id,
    userId: req.userId!,
    message,
    isAdmin: false,
  }).returning();
  await db.update(ticketsTable).set({ status: "pending", updatedAt: new Date() }).where(eq(ticketsTable.id, ticket[0].id));
  return res.status(201).json(msg);
});

export default router;
