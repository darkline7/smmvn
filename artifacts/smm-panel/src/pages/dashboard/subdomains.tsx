import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Globe, Plus, Trash2, CheckCircle2, Clock, AlertCircle, Copy, Server } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const STATUS_MAP: Record<string, { label: string; variant: any; icon: any }> = {
  pending:   { label: "Chờ duyệt", variant: "warning",     icon: Clock },
  active:    { label: "Đang hoạt động", variant: "success", icon: CheckCircle2 },
  suspended: { label: "Tạm đình chỉ", variant: "destructive", icon: AlertCircle },
  rejected:  { label: "Bị từ chối", variant: "destructive", icon: AlertCircle },
};

export default function SubdomainsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [domain, setDomain] = useState("");
  const [siteName, setSiteName] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["subdomains"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/subdomains`, { credentials: "include" });
      if (!r.ok) return { subdomains: [] };
      return r.json();
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/api/subdomains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ domain, siteName }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Lỗi");
      return json;
    },
    onSuccess: () => {
      toast({ title: "Đăng ký thành công!", description: "Domain đang chờ admin duyệt." });
      qc.invalidateQueries({ queryKey: ["subdomains"] });
      setDomain(""); setSiteName(""); setShowForm(false);
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Lỗi", description: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${BASE}/api/subdomains/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error("Lỗi xóa");
    },
    onSuccess: () => {
      toast({ title: "Đã xóa domain" });
      qc.invalidateQueries({ queryKey: ["subdomains"] });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Lỗi", description: e.message }),
  });

  const subdomains: any[] = data?.subdomains || [];

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold font-display">Web con (Reseller)</h2>
            <p className="text-muted-foreground text-sm mt-1">Tạo bảng giá SMM riêng với tên miền của bạn</p>
          </div>
          <Button onClick={() => setShowForm(v => !v)} className="gap-2">
            <Plus className="w-4 h-4" /> Thêm domain
          </Button>
        </div>

        {/* How it works + DNS guide */}
        <Card className="border-border/50 bg-muted/30">
          <CardContent className="p-5 space-y-4">
            <h3 className="font-semibold flex items-center gap-2"><Server className="w-4 h-4 text-primary" /> Cách thiết lập</h3>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Đăng nhập vào nhà cung cấp tên miền (Namecheap, Cloudflare, GoDaddy…)</li>
              <li>Vào phần quản lý <strong className="text-foreground">DNS Records</strong></li>
              <li>Thêm bản ghi <strong className="text-foreground">CNAME</strong> trỏ về máy chủ của bạn</li>
              <li>Nhấn <strong className="text-foreground">Thêm domain</strong> và điền tên miền của bạn</li>
              <li>Chờ admin duyệt (thường trong 1–2 giờ) — DNS mất 24–48h để lan truyền</li>
            </ol>

            <div className="rounded-lg border bg-background p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bản ghi DNS cần thêm</p>
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="text-muted-foreground border-b">
                      <th className="text-left py-1 pr-4 font-medium">Type</th>
                      <th className="text-left py-1 pr-4 font-medium">Host / Name</th>
                      <th className="text-left py-1 font-medium">Value / Points to</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    <tr>
                      <td className="py-1.5 pr-4 font-mono font-bold text-primary">CNAME</td>
                      <td className="py-1.5 pr-4 font-mono">smm (hoặc @)</td>
                      <td className="py-1.5 font-mono">smm.yourdomain.com (tên miền của bạn)</td>
                    </tr>
                    <tr className="text-muted-foreground">
                      <td className="py-1.5 pr-4 font-mono">CNAME</td>
                      <td className="py-1.5 pr-4 font-mono">* (wildcard)</td>
                      <td className="py-1.5 font-mono">smm.yourdomain.com (hoặc máy chủ chính)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-muted-foreground flex-1">
                  Dùng <strong>wildcard CNAME (*)</strong> nếu muốn tất cả subdomain đều hoạt động.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Add form */}
        {showForm && (
          <Card className="border-primary/30 shadow-md">
            <CardHeader className="pb-3 pt-5 px-5">
              <CardTitle className="text-base font-semibold">Đăng ký domain mới</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              <div className="space-y-1.5">
                <Label>Tên miền <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="smm.yourdomain.com hoặc yourdomain.com"
                  value={domain}
                  onChange={e => setDomain(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">Nhập tên miền không có http:// hoặc www</p>
              </div>
              <div className="space-y-1.5">
                <Label>Tên website hiển thị</Label>
                <Input
                  placeholder="VD: SMM Panel VIP"
                  value={siteName}
                  onChange={e => setSiteName(e.target.value)}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button className="flex-1" onClick={() => createMut.mutate()} disabled={!domain.trim() || createMut.isPending}>
                  {createMut.isPending ? "Đang gửi..." : "Đăng ký"}
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>Hủy</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />)}</div>
        ) : subdomains.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Globe className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Chưa có domain nào</p>
            <p className="text-sm mt-1">Nhấn "Thêm domain" để bắt đầu</p>
          </div>
        ) : (
          <div className="space-y-4">
            {subdomains.map((sub: any) => {
              const s = STATUS_MAP[sub.status] || STATUS_MAP.pending;
              const Icon = s.icon;
              return (
                <Card key={sub.id} className="border-border/50 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Globe className="w-4 h-4 text-primary shrink-0" />
                          <span className="font-mono font-bold text-foreground">{sub.domain}</span>
                          <Badge variant={s.variant} className="gap-1 text-xs">
                            <Icon className="w-3 h-3" /> {s.label}
                          </Badge>
                        </div>
                        {sub.siteName && <p className="text-sm text-muted-foreground mb-3">{sub.siteName}</p>}

                        {/* DNS instructions */}
                        {sub.nsTarget && (
                          <div className="bg-muted/50 rounded-lg p-3 border border-border/40 space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cấu hình DNS</p>
                            <div className="flex items-center gap-2">
                              <code className="text-xs bg-background px-2 py-1 rounded border border-border font-mono flex-1">
                                CNAME {sub.domain} → {sub.nsTarget}
                              </code>
                              <button
                                onClick={() => { navigator.clipboard.writeText(sub.nsTarget); toast({ title: "Đã sao chép!" }); }}
                                className="p-1 hover:text-primary transition-colors shrink-0"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <p className="text-xs text-muted-foreground">Trỏ CNAME của <strong>{sub.domain}</strong> về <strong>{sub.nsTarget}</strong>, sau đó liên hệ admin để xác nhận.</p>
                          </div>
                        )}

                        {sub.adminNote && (
                          <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                            <p className="text-xs text-amber-700 dark:text-amber-400"><strong>Ghi chú admin:</strong> {sub.adminNote}</p>
                          </div>
                        )}

                        <p className="text-xs text-muted-foreground mt-3">
                          Đăng ký: {new Date(sub.createdAt).toLocaleDateString("vi-VN")}
                        </p>
                      </div>
                      <Button
                        variant="ghost" size="icon"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => { if (confirm("Xóa domain này?")) deleteMut.mutate(sub.id); }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
