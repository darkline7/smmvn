import { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAdminListTickets, useAdminGetTicket } from "@workspace/api-client-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Ticket, MessageCircle, RefreshCw, Send, CheckCircle2 } from "lucide-react";

const statusColors: Record<string, string> = {
  open: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  closed: "bg-gray-100 text-gray-600",
};

function TicketChat({ ticketId, onClose }: { ticketId: number; onClose: () => void }) {
  const { toast } = useToast();
  const { data, refetch } = useAdminGetTicket(ticketId);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const ticket = (data as any)?.ticket || data;
  const messages = (data as any)?.messages || [];

  const sendReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
      await fetch(`${BASE}/api/admin/tickets/${ticketId}/reply`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ message: reply }),
      });
      setReply(""); refetch();
      toast({ title: "Đã gửi phản hồi" });
    } catch { toast({ title: "Lỗi gửi", variant: "destructive" }); }
    finally { setSending(false); }
  };

  const updateStatus = async (status: string) => {
    const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
    await fetch(`${BASE}/api/admin/tickets/${ticketId}/status`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      credentials: "include", body: JSON.stringify({ status }),
    });
    refetch(); toast({ title: `Cập nhật trạng thái: ${status}` });
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle className="flex items-center justify-between">
          <span className="truncate">{ticket?.subject}</span>
          <Select defaultValue={ticket?.status} onValueChange={updateStatus}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-3 max-h-[50vh] flex flex-col">
        <div className="text-xs text-muted-foreground">User ID: {ticket?.userId} · #{ticket?.id} · Priority: {ticket?.priority}</div>
        <div className="flex-1 overflow-y-auto space-y-2 min-h-[200px]">
          {messages.map((msg: any) => (
            <div key={msg.id} className={`flex ${msg.isAdmin ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[80%] p-3 rounded-xl text-sm ${msg.isAdmin ? "bg-primary text-primary-foreground rounded-tl-none" : "bg-muted rounded-tr-none"}`}>
                <p className="text-xs opacity-70 mb-1">{msg.isAdmin ? "Admin" : `User #${ticket?.userId}`} · {format(new Date(msg.createdAt), "HH:mm dd/MM")}</p>
                <p className="whitespace-pre-wrap">{msg.message}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-2 border-t">
          <Textarea value={reply} onChange={e => setReply(e.target.value)} placeholder="Nhập phản hồi..." rows={2} className="resize-none" />
          <Button size="sm" disabled={sending || !reply.trim()} onClick={sendReply} className="self-end gap-1">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

export default function AdminTickets() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { data, isLoading, refetch } = useAdminListTickets({ ...(statusFilter !== "all" ? { status: statusFilter } : {}), limit: 50 });
  const tickets = data?.tickets || [];

  return (
    <DashboardLayout isAdminLayout>
      <div className="space-y-6 pb-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold font-display">Hỗ trợ khách hàng</h2>
            <p className="text-muted-foreground mt-1">{tickets.length} tickets</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={() => refetch()}><RefreshCw className="w-4 h-4" /></Button>
          </div>
        </div>

        <Dialog>
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl"></div>)}</div>
              ) : !tickets.length ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Ticket className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Không có ticket nào</p>
                </div>
              ) : (
                <div className="divide-y">
                  {tickets.map((t: any) => (
                    <DialogTrigger key={t.id} asChild>
                      <div className="flex items-center gap-4 p-4 hover:bg-muted/20 cursor-pointer" onClick={() => setSelectedId(t.id)}>
                        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                          <Ticket className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{t.subject}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${statusColors[t.status] || ""}`}>{t.status}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">User #{t.userId} · #{t.id} · {format(new Date(t.createdAt), "dd/MM/yyyy HH:mm")}</p>
                        </div>
                        <MessageCircle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      </div>
                    </DialogTrigger>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          {selectedId && <TicketChat ticketId={selectedId} onClose={() => setSelectedId(null)} />}
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
