import { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAdminListDeposits } from "@workspace/api-client-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, CheckCircle2, XCircle, Clock, RefreshCw, Search, DollarSign } from "lucide-react";

const statusColors: Record<string, string> = {
  pending:  "bg-yellow-100 text-yellow-700 border-yellow-200",
  approved: "bg-green-100 text-green-700 border-green-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
};
const statusLabels: Record<string, string> = { pending: "Chờ duyệt", approved: "Đã duyệt", rejected: "Từ chối" };

function DepositActionDialog({ deposit, onDone }: { deposit: any; onDone: () => void }) {
  const { toast } = useToast();
  const [adminNote, setAdminNote] = useState("");
  const [loading, setLoading] = useState(false);

  const action = async (status: "approved" | "rejected") => {
    setLoading(true);
    try {
      const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
      const res = await fetch(`${BASE}/api/admin/deposits/${deposit.id}/${status}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ adminNote }),
      });
      if (!res.ok) throw new Error();
      toast({ title: `${status === "approved" ? "✅ Đã duyệt" : "❌ Đã từ chối"} nạp tiền #${deposit.id}` });
      onDone();
    } catch {
      toast({ title: "Lỗi xử lý", variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>Xử lý nạp tiền #{deposit.id}</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-muted space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">User ID</span><span className="font-medium">#{deposit.userId}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Số tiền</span><span className="font-bold text-primary text-lg">{formatCurrency(Number(deposit.amount))}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Phương thức</span><span>{deposit.method}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Ngày tạo</span><span>{format(new Date(deposit.createdAt), "dd/MM/yyyy HH:mm")}</span></div>
          {deposit.note && <div className="flex justify-between"><span className="text-muted-foreground">Ghi chú</span><span className="text-right max-w-[200px]">{deposit.note}</span></div>}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Ghi chú admin (tùy chọn)</label>
          <Textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} placeholder="Lý do duyệt / từ chối..." rows={2} />
        </div>
        <div className="flex gap-3">
          <Button className="flex-1 gap-2 bg-green-600 hover:bg-green-700" disabled={loading} onClick={() => action("approved")}>
            <CheckCircle2 className="w-4 h-4" />Duyệt
          </Button>
          <Button variant="destructive" className="flex-1 gap-2" disabled={loading} onClick={() => action("rejected")}>
            <XCircle className="w-4 h-4" />Từ chối
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

export default function AdminPayments() {
  const [statusFilter, setStatusFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [selectedDeposit, setSelectedDeposit] = useState<any>(null);
  const { data, isLoading, refetch } = useAdminListDeposits({ status: statusFilter !== "all" ? statusFilter : undefined, limit: 50 });
  const deposits = (data?.deposits || []).filter((d: any) => !search || d.userId.toString().includes(search));

  const pendingCount = data?.deposits?.filter((d: any) => d.status === "pending").length || 0;

  return (
    <DashboardLayout isAdminLayout>
      <div className="space-y-6 pb-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold font-display">Quản lý nạp tiền</h2>
            {pendingCount > 0 && <p className="text-orange-600 font-medium mt-1">⚠️ {pendingCount} yêu cầu chờ duyệt</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={() => refetch()}><RefreshCw className="w-4 h-4" /></Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Chờ duyệt", status: "pending", color: "text-yellow-600", bg: "bg-yellow-50" },
            { label: "Đã duyệt", status: "approved", color: "text-green-600", bg: "bg-green-50" },
            { label: "Từ chối", status: "rejected", color: "text-red-600", bg: "bg-red-50" },
          ].map(({ label, status, color, bg }) => (
            <button key={status} onClick={() => setStatusFilter(status)}
              className={`p-4 rounded-xl border text-left transition-all ${statusFilter === status ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/50"} ${statusFilter === status ? bg : ""}`}>
              <p className={`text-2xl font-bold ${color}`}>{data?.deposits?.filter((d: any) => d.status === status).length || 0}</p>
              <p className="text-sm text-muted-foreground mt-1">{label}</p>
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Tìm theo User ID..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <Dialog>
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl"></div>)}</div>
              ) : !deposits.length ? (
                <div className="text-center py-16 text-muted-foreground">
                  <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Không có yêu cầu nào</p>
                </div>
              ) : (
                <div className="divide-y">
                  {deposits.map((d: any) => (
                    <div key={d.id} className="flex items-center justify-between p-4 hover:bg-muted/20">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${d.status === "approved" ? "bg-green-100" : d.status === "rejected" ? "bg-red-100" : "bg-yellow-100"}`}>
                          <DollarSign className={`w-5 h-5 ${d.status === "approved" ? "text-green-600" : d.status === "rejected" ? "text-red-600" : "text-yellow-600"}`} />
                        </div>
                        <div>
                          <p className="font-medium">User #{d.userId} · #{d.id}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(d.createdAt), "dd/MM/yyyy HH:mm")} · {d.method}</p>
                          {d.adminNote && <p className="text-xs text-muted-foreground mt-0.5 italic">{d.adminNote}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-bold text-lg">{formatCurrency(Number(d.amount))}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColors[d.status]}`}>{statusLabels[d.status]}</span>
                        </div>
                        {d.status === "pending" && (
                          <DialogTrigger asChild>
                            <Button size="sm" onClick={() => setSelectedDeposit(d)}>Xử lý</Button>
                          </DialogTrigger>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          {selectedDeposit && <DepositActionDialog deposit={selectedDeposit} onDone={() => { refetch(); setSelectedDeposit(null); }} />}
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
