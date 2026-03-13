import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck, Plus, RefreshCw, Wifi, WifiOff, PlayCircle, Edit2, Trash2,
  Loader2, Link2, Copy, Clock, Package, TrendingUp, AlertCircle, CheckCircle2,
  Zap, Globe, Key, Settings2,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const ORIGIN = window.location.origin;

const createSchema = z.object({
  name: z.string().min(2, "Tên tối thiểu 2 ký tự"),
  url: z.string().url("URL không hợp lệ"),
  apiKey: z.string().min(4, "API key tối thiểu 4 ký tự"),
  markupPercent: z.string().regex(/^\d+(\.\d+)?$/, "Nhập số % hợp lệ").default("25"),
});
const editSchema = z.object({
  name: z.string().min(2, "Tên tối thiểu 2 ký tự"),
  url: z.string().url("URL không hợp lệ"),
  apiKey: z.string().optional(),
  markupPercent: z.string().regex(/^\d+(\.\d+)?$/, "Nhập số % hợp lệ"),
});

function ProviderForm({ provider, onDone }: { provider?: any; onDone: () => void }) {
  const { toast } = useToast();
  const schema = provider ? editSchema : createSchema;
  const form = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: provider
      ? { name: provider.name, url: provider.url, apiKey: "", markupPercent: String(provider.markupPercent ?? "25") }
      : { name: "", url: "", apiKey: "", markupPercent: "25" },
  });

  const onSubmit = async (values: any) => {
    const endpoint = provider
      ? `${BASE}/api/admin/providers/${provider.id}`
      : `${BASE}/api/admin/providers`;
    const res = await fetch(endpoint, {
      method: provider ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast({ title: "Lỗi lưu provider", description: err.error || "Vui lòng thử lại", variant: "destructive" });
      return;
    }
    toast({ title: "Lưu thành công!" });
    onDone();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Tên provider</FormLabel>
            <FormControl><Input placeholder="SMMKing, PanelFOX, SMMLab..." {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="url" render={({ field }) => (
          <FormItem>
            <FormLabel>API URL</FormLabel>
            <FormControl><Input placeholder="https://smmgen.com/api/v2" {...field} /></FormControl>
            <FormDescription>URL endpoint API của web nguồn. Ví dụ: https://smmgen.com/api/v2 (thường /api hoặc /api/v2)</FormDescription>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="apiKey" render={({ field }) => (
          <FormItem>
            <FormLabel>API Key</FormLabel>
            <FormControl>
              <Input
                type="password"
                placeholder={provider ? "Để trống nếu không đổi key" : "API key của provider"}
                {...field}
              />
            </FormControl>
            {provider && <FormDescription>Chỉ nhập nếu muốn cập nhật key mới</FormDescription>}
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="markupPercent" render={({ field }) => (
          <FormItem>
            <FormLabel>Markup giá (%)</FormLabel>
            <FormControl>
              <div className="relative">
                <Input type="number" min="0" max="500" step="0.5" placeholder="25" {...field} className="pr-8" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
              </div>
            </FormControl>
            <FormDescription>
              Giá hiển thị = Giá gốc × (1 + markup%). Ví dụ: 25% → $1.00 thành $1.25
            </FormDescription>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          {provider ? "Cập nhật provider" : "Thêm provider"}
        </Button>
      </form>
    </Form>
  );
}

function CronLinksPanel({ cronSecret, providers }: { cronSecret: string; providers: any[] }) {
  const { toast } = useToast();
  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Đã copy link!" });
  };

  const syncAllUrl = `${ORIGIN}${BASE}/api/cron/sync-all?secret=${cronSecret || "CHUA_CAI_CRON_SECRET"}`;
  const hasCronSecret = !!cronSecret;

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          <CardTitle className="text-base">Cron Links — Tự động cập nhật</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Dùng các link này để cài cron job tự động cập nhật giá & dịch vụ từ web nguồn
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasCronSecret && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-400">Chưa cài Cron Secret</p>
              <p className="text-amber-600 dark:text-amber-500">Vào <strong>Admin → Cài đặt → Hệ thống</strong> để thiết lập Cron Secret trước khi dùng link.</p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Đồng bộ tất cả providers</p>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
            <Link2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <code className="text-xs flex-1 truncate font-mono text-foreground">{syncAllUrl}</code>
            <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => copy(syncAllUrl)}>
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {providers.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Đồng bộ riêng từng provider</p>
            {providers.map((p: any) => {
              const url = `${ORIGIN}${BASE}/api/cron/sync/${p.id}?secret=${cronSecret || "CHUA_CAI_CRON_SECRET"}`;
              return (
                <div key={p.id} className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{p.name}</p>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
                    <Link2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <code className="text-xs flex-1 truncate font-mono text-foreground">{url}</code>
                    <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => copy(url)}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-400 space-y-1">
          <p className="font-medium">Cách dùng cron job:</p>
          <p>• <strong>cron-job.org</strong> hoặc <strong>UptimeRobot</strong>: dán link vào, chọn tần suất mỗi 6-24 giờ</p>
          <p>• <strong>Linux cron</strong>: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">0 */6 * * * curl -s "URL"</code></p>
          <p>• Mỗi lần chạy sẽ: thêm dịch vụ mới + cập nhật giá dịch vụ đã có theo markup</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminProviders() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editProvider, setEditProvider] = useState<any>(null);
  const [openNew, setOpenNew] = useState(false);
  const [testing, setTesting] = useState<number | null>(null);
  const [syncing, setSyncing] = useState<number | "all" | null>(null);
  const [activating, setActivating] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-providers"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/admin/providers`, { credentials: "include" });
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const { data: settingsData } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/admin/settings`, { credentials: "include" });
      return res.json();
    },
  });

  const providers: any[] = data?.providers || [];
  const cronSecret = settingsData?.settings?.find((s: any) => s.key === "cron_secret")?.value || "";

  const refetch = () => qc.invalidateQueries({ queryKey: ["admin-providers"] });

  const testProvider = async (id: number) => {
    setTesting(id);
    try {
      const res = await fetch(`${BASE}/api/admin/providers/${id}/test`, { method: "POST", credentials: "include" });
      const d = await res.json();
      if (d.success) toast({ title: `✅ Kết nối thành công! Số dư: $${d.balance}` });
      else toast({ title: `❌ Kết nối thất bại: ${d.error}`, variant: "destructive" });
    } catch {
      toast({ title: "Lỗi test provider", variant: "destructive" });
    } finally { setTesting(null); }
  };

  const syncProvider = async (id: number) => {
    setSyncing(id);
    try {
      const res = await fetch(`${BASE}/api/admin/providers/${id}/sync`, { method: "POST", credentials: "include" });
      const d = await res.json();
      if (d.success) toast({ title: `✅ ${d.message}` });
      else toast({ title: `❌ Sync thất bại: ${d.error || d.message}`, variant: "destructive" });
      refetch();
    } catch {
      toast({ title: "Lỗi sync", variant: "destructive" });
    } finally { setSyncing(null); }
  };

  const syncAll = async () => {
    setSyncing("all");
    try {
      const res = await fetch(`${BASE}/api/admin/providers/sync-all`, { method: "POST", credentials: "include" });
      const d = await res.json();
      const total = d.results?.reduce((s: number, r: any) => s + (r.total || 0), 0) || 0;
      toast({ title: `✅ Đã sync ${d.results?.length} providers — ${total} dịch vụ` });
      refetch();
    } catch {
      toast({ title: "Lỗi sync tất cả", variant: "destructive" });
    } finally { setSyncing(null); }
  };

  const activateServices = async (id: number, name: string) => {
    setActivating(id);
    try {
      const res = await fetch(`${BASE}/api/admin/providers/${id}/activate`, { method: "POST", credentials: "include" });
      const d = await res.json();
      if (d.success) toast({ title: `✅ ${d.message}` });
      else toast({ title: "Lỗi kích hoạt", variant: "destructive" });
      refetch();
    } catch {
      toast({ title: "Lỗi kích hoạt", variant: "destructive" });
    } finally { setActivating(null); }
  };

  const deleteProvider = async (id: number) => {
    if (!confirm("Xóa provider này?")) return;
    await fetch(`${BASE}/api/admin/providers/${id}`, { method: "DELETE", credentials: "include" });
    toast({ title: "Đã xóa provider" });
    refetch();
  };

  const formatLastSync = (lastSyncAt: string | null) => {
    if (!lastSyncAt) return null;
    const d = new Date(lastSyncAt);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins} phút trước`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} giờ trước`;
    return `${Math.floor(diffHours / 24)} ngày trước`;
  };

  const totalServices = providers.reduce((s, p) => s + Number(p.serviceCount || 0), 0);

  return (
    <DashboardLayout isAdminLayout>
      <div className="space-y-6 pb-8 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold font-display">Kết nối API</h2>
            <p className="text-muted-foreground mt-1">
              {providers.length} provider · {totalServices} dịch vụ đã import
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2" disabled={syncing === "all" || providers.length === 0} onClick={syncAll}>
              {syncing === "all" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sync tất cả
            </Button>
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="w-4 h-4" />Thêm provider</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Kết nối web nguồn mới</DialogTitle></DialogHeader>
                <ProviderForm onDone={() => { setOpenNew(false); refetch(); }} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs defaultValue="providers">
          <TabsList>
            <TabsTrigger value="providers" className="gap-2">
              <Globe className="w-4 h-4" />Providers ({providers.length})
            </TabsTrigger>
            <TabsTrigger value="cron" className="gap-2">
              <Zap className="w-4 h-4" />Cron Links
            </TabsTrigger>
          </TabsList>

          {/* Tab: Providers list */}
          <TabsContent value="providers" className="mt-4 space-y-4">
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-6 space-y-3">
                    {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
                  </div>
                ) : !providers.length ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">Chưa có provider nào</p>
                    <p className="text-sm mt-1">Thêm web nguồn SMM để đồng bộ dịch vụ & giá tự động</p>
                    <Button className="mt-4 gap-2" onClick={() => setOpenNew(true)}>
                      <Plus className="w-4 h-4" />Thêm provider đầu tiên
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y">
                    {providers.map((p: any) => {
                      const lastSync = formatLastSync(p.lastSyncAt);
                      return (
                        <div key={p.id} className="p-4 hover:bg-muted/20 transition-colors">
                          <div className="flex items-start gap-4">
                            {/* Avatar */}
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                              {p.name?.[0]?.toUpperCase()}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <p className="font-semibold">{p.name}</p>
                                <Badge variant="outline" className={p.status === "active" ? "text-green-600 border-green-200" : "text-gray-400 border-gray-200"}>
                                  {p.status === "active" ? "Active" : "Inactive"}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground font-mono truncate mb-2">{p.url}</p>
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Package className="w-3.5 h-3.5" />
                                  {Number(p.serviceCount).toLocaleString()} dịch vụ
                                </span>
                                <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                                  <TrendingUp className="w-3.5 h-3.5" />
                                  +{p.markupPercent}% markup
                                </span>
                                {lastSync && (
                                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Clock className="w-3.5 h-3.5" />
                                    Sync {lastSync}
                                  </span>
                                )}
                                {!p.lastSyncAt && (
                                  <span className="flex items-center gap-1 text-xs text-orange-500">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    Chưa sync lần nào
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                variant="ghost" size="sm" className="gap-1 text-xs h-8"
                                disabled={testing === p.id}
                                onClick={() => testProvider(p.id)}
                              >
                                {testing === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
                                Test
                              </Button>
                              <Button
                                variant="ghost" size="sm" className="gap-1 text-xs h-8 text-green-600 hover:text-green-700"
                                disabled={activating === p.id}
                                onClick={() => activateServices(p.id, p.name)}
                                title="Kích hoạt tất cả dịch vụ đang inactive"
                              >
                                {activating === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                Kích hoạt
                              </Button>
                              <Button
                                variant="ghost" size="sm" className="gap-1 text-xs h-8"
                                disabled={syncing === p.id}
                                onClick={() => syncProvider(p.id)}
                              >
                                {syncing === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                Sync
                              </Button>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditProvider(p)}>
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader><DialogTitle>Sửa provider</DialogTitle></DialogHeader>
                                  <ProviderForm
                                    provider={editProvider}
                                    onDone={() => { setEditProvider(null); refetch(); }}
                                  />
                                </DialogContent>
                              </Dialog>
                              <Button
                                variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                                onClick={() => deleteProvider(p.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Cron Links */}
          <TabsContent value="cron" className="mt-4">
            <CronLinksPanel cronSecret={cronSecret} providers={providers} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
