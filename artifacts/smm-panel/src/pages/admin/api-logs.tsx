import { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdminListApiLogs } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Activity, RefreshCw, Search, ChevronLeft, ChevronRight, CheckCircle2, XCircle } from "lucide-react";

export default function AdminApiLogs() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("all");
  const [status, setStatus] = useState("all");
  const { data, isLoading, refetch } = useAdminListApiLogs({
    page, limit: 20,
    ...(action !== "all" ? { action } : {}),
    ...(status !== "all" ? { status } : {}),
  } as any);
  const logs = data?.logs || [];
  const totalPages = data?.totalPages || 1;

  return (
    <DashboardLayout isAdminLayout>
      <div className="space-y-6 pb-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold font-display">API Logs</h2>
            <p className="text-muted-foreground mt-1">{data?.total || 0} requests tổng</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => refetch()}><RefreshCw className="w-4 h-4" /></Button>
        </div>

        <div className="flex flex-wrap gap-3">
          <Select value={action} onValueChange={v => { setAction(v); setPage(1); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Action" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả action</SelectItem>
              <SelectItem value="services">services</SelectItem>
              <SelectItem value="add">add</SelectItem>
              <SelectItem value="status">status</SelectItem>
              <SelectItem value="multiple_status">multiple_status</SelectItem>
              <SelectItem value="balance">balance</SelectItem>
              <SelectItem value="refill">refill</SelectItem>
              <SelectItem value="cancel">cancel</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={v => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left p-3 text-muted-foreground font-medium">ID</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">User</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Action</th>
                  <th className="text-center p-3 text-muted-foreground font-medium">Status</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">IP</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  Array.from({length:5}).map((_, i) => (
                    <tr key={i}><td colSpan={6} className="p-3"><div className="h-6 bg-muted animate-pulse rounded"></div></td></tr>
                  ))
                ) : logs.map((l: any) => (
                  <tr key={l.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3 font-mono text-muted-foreground text-xs">#{l.id}</td>
                    <td className="p-3 text-muted-foreground">{l.username || `#${l.userId}`}</td>
                    <td className="p-3">
                      <code className="text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">{l.action}</code>
                    </td>
                    <td className="p-3 text-center">
                      {l.status === "success"
                        ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                        : <XCircle className="w-4 h-4 text-red-500 mx-auto" />}
                    </td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{l.ipAddress || "—"}</td>
                    <td className="p-3 text-xs text-muted-foreground">{format(new Date(l.createdAt), "dd/MM/yy HH:mm:ss")}</td>
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
