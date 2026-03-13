import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Globe, CheckCircle2, Clock, AlertCircle, XCircle, Search } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const STATUS_MAP: Record<string, { label: string; variant: any }> = {
  pending:   { label: "Chờ duyệt", variant: "warning" },
  active:    { label: "Hoạt động", variant: "success" },
  suspended: { label: "Tạm đình chỉ", variant: "destructive" },
  rejected:  { label: "Từ chối", variant: "destructive" },
};

export default function AdminSubdomains() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [note, setNote] = useState("");

  const { data, isLoading } = useQuery<any>({
    queryKey: ["admin-subdomains"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/subdomains/admin/all`, { credentials: "include" });
      if (!r.ok) return { subdomains: [] };
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, status, adminNote, nsVerified }: any) => {
      const r = await fetch(`${BASE}/api/subdomains/admin/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status, adminNote, nsVerified }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Lỗi");
      return json;
    },
    onSuccess: () => {
      toast({ title: "Đã cập nhật" });
      qc.invalidateQueries({ queryKey: ["admin-subdomains"] });
      setEditId(null);
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Lỗi", description: e.message }),
  });

  const subdomains: any[] = (data?.subdomains || []).filter((s: any) =>
    !search || s.domain.includes(search) || (s.siteName || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout isAdminLayout>
      <div className="space-y-5 animate-in fade-in duration-500">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold font-display">Quản lý Web con</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{data?.subdomains?.length || 0} domain đã đăng ký</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Tìm domain..." className="pl-9 w-56" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Tổng", value: data?.subdomains?.length || 0, icon: Globe, color: "text-primary" },
            { label: "Chờ duyệt", value: (data?.subdomains || []).filter((s: any) => s.status === "pending").length, icon: Clock, color: "text-amber-500" },
            { label: "Hoạt động", value: (data?.subdomains || []).filter((s: any) => s.status === "active").length, icon: CheckCircle2, color: "text-green-500" },
            { label: "Đình chỉ", value: (data?.subdomains || []).filter((s: any) => s.status === "suspended").length, icon: XCircle, color: "text-red-500" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className={`w-8 h-8 ${color} opacity-70`} />
                <div>
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3 pt-4 px-5">
            <CardTitle className="text-sm font-semibold">Danh sách domain</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>
            ) : subdomains.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Globe className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p>Chưa có domain nào</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left p-3 text-muted-foreground font-medium">Domain</th>
                      <th className="text-left p-3 text-muted-foreground font-medium hidden sm:table-cell">Tên site</th>
                      <th className="text-center p-3 text-muted-foreground font-medium">Trạng thái</th>
                      <th className="text-center p-3 text-muted-foreground font-medium hidden md:table-cell">NS OK?</th>
                      <th className="text-left p-3 text-muted-foreground font-medium hidden lg:table-cell">Ngày đăng ký</th>
                      <th className="text-center p-3 text-muted-foreground font-medium">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {subdomains.map((sub: any) => {
                      const s = STATUS_MAP[sub.status] || STATUS_MAP.pending;
                      return (
                        <>
                          <tr key={sub.id} className="hover:bg-muted/20 transition-colors">
                            <td className="p-3 font-mono text-sm font-medium">{sub.domain}</td>
                            <td className="p-3 text-muted-foreground hidden sm:table-cell">{sub.siteName || "—"}</td>
                            <td className="p-3 text-center">
                              <Badge variant={s.variant} className="text-xs">{s.label}</Badge>
                            </td>
                            <td className="p-3 text-center hidden md:table-cell">
                              {sub.nsVerified
                                ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                                : <AlertCircle className="w-4 h-4 text-amber-400 mx-auto" />}
                            </td>
                            <td className="p-3 text-muted-foreground text-xs hidden lg:table-cell">
                              {new Date(sub.createdAt).toLocaleDateString("vi-VN")}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => { setEditId(editId === sub.id ? null : sub.id); setNote(sub.adminNote || ""); }}
                                className="text-xs text-primary hover:underline"
                              >
                                {editId === sub.id ? "Đóng" : "Quản lý"}
                              </button>
                            </td>
                          </tr>
                          {editId === sub.id && (
                            <tr key={`edit-${sub.id}`}>
                              <td colSpan={6} className="bg-muted/30 px-4 py-3">
                                <div className="space-y-3 max-w-lg">
                                  <div className="flex flex-wrap gap-2">
                                    <Button size="sm" variant="outline" className="text-green-600 border-green-300 hover:bg-green-50"
                                      onClick={() => updateMut.mutate({ id: sub.id, status: "active", nsVerified: true })}>
                                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Duyệt & Kích hoạt
                                    </Button>
                                    <Button size="sm" variant="outline" className="text-amber-600 border-amber-300 hover:bg-amber-50"
                                      onClick={() => updateMut.mutate({ id: sub.id, status: "suspended" })}>
                                      Đình chỉ
                                    </Button>
                                    <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50"
                                      onClick={() => updateMut.mutate({ id: sub.id, status: "rejected" })}>
                                      <XCircle className="w-3.5 h-3.5 mr-1" /> Từ chối
                                    </Button>
                                    <Button size="sm" variant="outline"
                                      onClick={() => updateMut.mutate({ id: sub.id, nsVerified: !sub.nsVerified })}>
                                      {sub.nsVerified ? "Hủy xác nhận NS" : "✓ Xác nhận NS"}
                                    </Button>
                                  </div>
                                  <div className="flex gap-2">
                                    <Input
                                      placeholder="Ghi chú cho user..."
                                      value={note}
                                      onChange={e => setNote(e.target.value)}
                                      className="text-sm"
                                    />
                                    <Button size="sm" onClick={() => updateMut.mutate({ id: sub.id, adminNote: note })} disabled={updateMut.isPending}>
                                      Lưu ghi chú
                                    </Button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
