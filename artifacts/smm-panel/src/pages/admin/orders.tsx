import { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdminListOrders } from "@workspace/api-client-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { ListOrdered, Search, RefreshCw, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const statusColors: Record<string, string> = {
  pending:    "bg-yellow-100 text-yellow-700 border-yellow-200",
  processing: "bg-blue-100 text-blue-700 border-blue-200",
  active:     "bg-cyan-100 text-cyan-700 border-cyan-200",
  completed:  "bg-green-100 text-green-700 border-green-200",
  partial:    "bg-orange-100 text-orange-700 border-orange-200",
  canceled:   "bg-gray-100 text-gray-600 border-gray-200",
  error:      "bg-red-100 text-red-700 border-red-200",
};

const statusLabels: Record<string, string> = {
  pending: "Chờ", processing: "Đang xử lý", active: "Đang chạy",
  completed: "Hoàn thành", partial: "Một phần", canceled: "Đã hủy", error: "Lỗi",
};

export default function AdminOrders() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const { data, isLoading, refetch } = useAdminListOrders({ page, limit: 20, ...(status !== "all" ? { status } : {}), ...(search ? { search } : {}) });

  const orders = data?.orders || [];
  const totalPages = data?.totalPages || 1;

  const bulkAction = async (action: "complete" | "cancel") => {
    if (!selected.length) return;
    const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
    for (const id of selected) {
      await fetch(`${BASE}/api/admin/orders/${id}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ status: action === "complete" ? "completed" : "canceled" }),
      });
    }
    toast({ title: `Đã ${action === "complete" ? "hoàn thành" : "hủy"} ${selected.length} đơn hàng` });
    setSelected([]);
    refetch();
  };

  const exportCSV = () => {
    const rows = [["ID", "User ID", "Service", "Link", "Quantity", "Charge", "Status", "Created"]];
    orders.forEach((o: any) => rows.push([o.id, o.userId, o.serviceName || o.serviceId, o.link, o.quantity, o.charge, o.status, o.createdAt]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "orders.csv"; a.click();
  };

  const toggleSelect = (id: number) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleAll = () => setSelected(p => p.length === orders.length ? [] : orders.map((o: any) => o.id));

  return (
    <DashboardLayout isAdminLayout>
      <div className="space-y-6 pb-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold font-display">Quản lý đơn hàng</h2>
            <p className="text-muted-foreground mt-1">{data?.total || 0} đơn hàng tổng</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={exportCSV}><Download className="w-4 h-4" />Export CSV</Button>
            <Button variant="ghost" size="icon" onClick={() => refetch()}><RefreshCw className="w-4 h-4" /></Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Tìm kiếm..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Select value={status} onValueChange={v => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          {selected.length > 0 && (
            <>
              <Button size="sm" variant="outline" className="text-green-600 border-green-200" onClick={() => bulkAction("complete")}>✓ Hoàn thành ({selected.length})</Button>
              <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={() => bulkAction("cancel")}>✕ Hủy ({selected.length})</Button>
            </>
          )}
        </div>

        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="p-3 w-8"><input type="checkbox" checked={selected.length === orders.length && orders.length > 0} onChange={toggleAll} className="rounded" /></th>
                  <th className="text-left p-3 text-muted-foreground font-medium">ID</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">User</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Dịch vụ</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Link</th>
                  <th className="text-right p-3 text-muted-foreground font-medium">SL</th>
                  <th className="text-right p-3 text-muted-foreground font-medium">Giá</th>
                  <th className="text-center p-3 text-muted-foreground font-medium">Trạng thái</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Ngày</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  Array.from({length: 5}).map((_, i) => (
                    <tr key={i}><td colSpan={9} className="p-3"><div className="h-8 bg-muted animate-pulse rounded"></div></td></tr>
                  ))
                ) : orders.map((o: any) => (
                  <tr key={o.id} className={`hover:bg-muted/20 transition-colors ${selected.includes(o.id) ? "bg-primary/5" : ""}`}>
                    <td className="p-3"><input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggleSelect(o.id)} className="rounded" /></td>
                    <td className="p-3 font-mono text-muted-foreground">#{o.id}</td>
                    <td className="p-3 text-muted-foreground">#{o.userId}</td>
                    <td className="p-3 max-w-[140px] truncate font-medium">{o.serviceName || `#${o.serviceId}`}</td>
                    <td className="p-3 max-w-[150px]"><p className="truncate font-mono text-xs text-muted-foreground">{o.link}</p></td>
                    <td className="p-3 text-right">{Number(o.quantity).toLocaleString()}</td>
                    <td className="p-3 text-right font-medium text-primary">{formatCurrency(Number(o.charge))}</td>
                    <td className="p-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColors[o.status] || ""}`}>{statusLabels[o.status] || o.status}</span>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{format(new Date(o.createdAt), "dd/MM/yy HH:mm")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}><ChevronLeft className="w-4 h-4" /></Button>
            <span className="text-sm text-muted-foreground">Trang {page} / {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
