import { useState } from "react";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useListTickets, useGetTicket } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Ticket, Plus, Clock, CheckCircle2, XCircle, MessageCircle, Send, RefreshCw } from "lucide-react";

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  open:       { label: "Đang mở",      color: "bg-green-100 text-green-700 border-green-200", icon: Clock },
  pending:    { label: "Chờ phản hồi", color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: Clock },
  answered:   { label: "Đã trả lời",   color: "bg-blue-100 text-blue-700 border-blue-200", icon: MessageCircle },
  closed:     { label: "Đóng",         color: "bg-gray-100 text-gray-600 border-gray-200", icon: XCircle },
};

const ticketSchema = z.object({
  subject: z.string().min(5, "Tiêu đề tối thiểu 5 ký tự"),
  message: z.string().min(20, "Nội dung tối thiểu 20 ký tự"),
  priority: z.enum(["low", "medium", "high"]),
});

function TicketDetail({ ticketId }: { ticketId: number }) {
  const { data, isLoading, refetch } = useGetTicket(ticketId);
  const { toast } = useToast();
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const sendReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
      const res = await fetch(`${BASE}/api/tickets/${ticketId}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ message: reply }),
      });
      if (!res.ok) throw new Error();
      setReply("");
      refetch();
      toast({ title: "Gửi phản hồi thành công" });
    } catch {
      toast({ title: "Lỗi gửi phản hồi", variant: "destructive" });
    } finally { setSending(false); }
  };

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Đang tải...</div>;
  const ticket = data?.ticket || data;
  const messages = data?.messages || [];

  return (
    <div className="space-y-4 max-h-[60vh] flex flex-col">
      <div className="flex-1 overflow-y-auto space-y-3">
        {messages.map((msg: any) => (
          <div key={msg.id} className={`flex ${msg.isAdmin ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[80%] p-3 rounded-xl text-sm ${msg.isAdmin ? "bg-muted text-foreground rounded-tl-none" : "bg-primary text-primary-foreground rounded-tr-none"}`}>
              <p className={`text-xs font-medium mb-1 ${msg.isAdmin ? "text-muted-foreground" : "text-primary-foreground/70"}`}>
                {msg.isAdmin ? "Hỗ trợ" : "Bạn"} · {format(new Date(msg.createdAt), "HH:mm dd/MM")}
              </p>
              <p className="whitespace-pre-wrap">{msg.message}</p>
            </div>
          </div>
        ))}
      </div>
      {ticket?.status !== "closed" && (
        <div className="flex gap-2 pt-2 border-t">
          <Textarea value={reply} onChange={e => setReply(e.target.value)} placeholder="Nhập phản hồi..." className="resize-none" rows={2} />
          <Button onClick={sendReply} disabled={sending || !reply.trim()} size="sm" className="self-end gap-1">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function Tickets() {
  const [open, setOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<number | null>(null);
  const { toast } = useToast();
  const { data, isLoading, refetch } = useListTickets();

  const form = useForm<z.infer<typeof ticketSchema>>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { subject: "", message: "", priority: "medium" },
  });

  const onSubmit = async (values: z.infer<typeof ticketSchema>) => {
    try {
      const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
      const res = await fetch(`${BASE}/api/tickets`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Tạo ticket thành công!" });
      form.reset();
      setOpen(false);
      refetch();
    } catch {
      toast({ title: "Lỗi tạo ticket", variant: "destructive" });
    }
  };

  const tickets = data?.tickets || [];

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 pb-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold font-display">Hỗ trợ</h2>
            <p className="text-muted-foreground mt-1">Tạo ticket và theo dõi yêu cầu hỗ trợ của bạn</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" />Tạo ticket mới</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Tạo ticket hỗ trợ</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="subject" render={({ field }) => (
                    <FormItem><FormLabel>Tiêu đề</FormLabel><FormControl><Input placeholder="Mô tả vắn tắt vấn đề..." {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="priority" render={({ field }) => (
                    <FormItem><FormLabel>Độ ưu tiên</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Thấp</SelectItem>
                          <SelectItem value="medium">Trung bình</SelectItem>
                          <SelectItem value="high">Cao</SelectItem>
                        </SelectContent>
                      </Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="message" render={({ field }) => (
                    <FormItem><FormLabel>Nội dung</FormLabel><FormControl><Textarea placeholder="Mô tả chi tiết vấn đề của bạn..." rows={5} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <Button type="submit" className="w-full">Gửi ticket</Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Tổng", value: tickets.length, color: "text-foreground" },
            { label: "Đang mở", value: tickets.filter((t: any) => t.status === "open").length, color: "text-green-600" },
            { label: "Đã trả lời", value: tickets.filter((t: any) => t.status === "answered").length, color: "text-blue-600" },
            { label: "Đóng", value: tickets.filter((t: any) => t.status === "closed").length, color: "text-muted-foreground" },
          ].map(({ label, value, color }) => (
            <Card key={label} className="border-border/50 shadow-sm">
              <CardContent className="p-4 text-center">
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2"><Ticket className="w-5 h-5" />Danh sách ticket</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => refetch()}><RefreshCw className="w-4 h-4" /></Button>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl"></div>)}</div>
            ) : !tickets.length ? (
              <div className="text-center py-16">
                <Ticket className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground">Chưa có ticket nào</p>
                <Button onClick={() => setOpen(true)} className="mt-3 gap-2"><Plus className="w-4 h-4" />Tạo ticket đầu tiên</Button>
              </div>
            ) : (
              <div className="divide-y">
                {tickets.map((t: any) => {
                  const cfg = statusConfig[t.status] || statusConfig.open;
                  const Icon = cfg.icon;
                  return (
                    <Dialog key={t.id}>
                      <DialogTrigger asChild>
                        <div className="flex items-center justify-between p-4 hover:bg-muted/30 cursor-pointer transition-colors">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${t.status === "open" ? "bg-green-100" : t.status === "answered" ? "bg-blue-100" : "bg-gray-100"}`}>
                              <Icon className={`w-5 h-5 ${t.status === "open" ? "text-green-600" : t.status === "answered" ? "text-blue-600" : "text-gray-500"}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{t.subject}</p>
                              <p className="text-xs text-muted-foreground">{format(new Date(t.createdAt), "dd/MM/yyyy HH:mm")} · #{t.id}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            <span className={`text-xs px-2 py-1 rounded-full border font-medium ${cfg.color}`}>{cfg.label}</span>
                            <MessageCircle className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle className="flex items-center justify-between gap-2">
                            <span className="truncate">{t.subject}</span>
                            <span className={`text-xs px-2 py-1 rounded-full border font-medium flex-shrink-0 ${cfg.color}`}>{cfg.label}</span>
                          </DialogTitle>
                        </DialogHeader>
                        <TicketDetail ticketId={t.id} />
                      </DialogContent>
                    </Dialog>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
