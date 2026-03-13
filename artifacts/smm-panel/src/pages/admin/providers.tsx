import { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useAdminListProviders } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Plus, RefreshCw, Wifi, WifiOff, PlayCircle, Edit2, Trash2, CheckCircle2, XCircle, Loader2 } from "lucide-react";

const createSchema = z.object({
  name: z.string().min(2, "Tên tối thiểu 2 ký tự"),
  url: z.string().url("URL không hợp lệ"),
  apiKey: z.string().min(4, "API key tối thiểu 4 ký tự"),
});
const editSchema = z.object({
  name: z.string().min(2, "Tên tối thiểu 2 ký tự"),
  url: z.string().url("URL không hợp lệ"),
  apiKey: z.string().optional(),
});

function ProviderForm({ provider, onDone }: { provider?: any; onDone: () => void }) {
  const { toast } = useToast();
  const schema = provider ? editSchema : createSchema;
  const form = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: provider ? { name: provider.name, url: provider.url, apiKey: "" } : { name: "", url: "", apiKey: "" },
  });

  const onSubmit = async (values: any) => {
    const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
    const endpoint = provider ? `${BASE}/api/admin/providers/${provider.id}` : `${BASE}/api/admin/providers`;
    const res = await fetch(endpoint, { method: provider ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(values) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast({ title: "Lỗi lưu provider", description: err.error || "Vui lòng thử lại", variant: "destructive" });
      return;
    }
    toast({ title: "Lưu thành công!" }); onDone();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem><FormLabel>Tên provider</FormLabel><FormControl><Input placeholder="SMMKing, PanelFOX..." {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="url" render={({ field }) => (
          <FormItem><FormLabel>API URL</FormLabel><FormControl><Input placeholder="https://provider.com/api/v2" {...field} /></FormControl>
            <FormDescription>URL endpoint API v2 (thường kết thúc bằng /api/v2)</FormDescription><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="apiKey" render={({ field }) => (
          <FormItem>
            <FormLabel>API Key</FormLabel>
            <FormControl><Input type="password" placeholder={provider ? "Để trống nếu không đổi key" : "API key của provider"} {...field} /></FormControl>
            {provider && <FormDescription>Chỉ nhập nếu muốn cập nhật key mới</FormDescription>}
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit" className="w-full">{provider ? "Cập nhật" : "Thêm provider"}</Button>
      </form>
    </Form>
  );
}

export default function AdminProviders() {
  const { toast } = useToast();
  const [editProvider, setEditProvider] = useState<any>(null);
  const [openNew, setOpenNew] = useState(false);
  const [testing, setTesting] = useState<number | null>(null);
  const [syncing, setSyncing] = useState<number | null>(null);
  const { data, isLoading, refetch } = useAdminListProviders();
  const providers = data?.providers || [];

  const testProvider = async (id: number) => {
    setTesting(id);
    try {
      const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
      const res = await fetch(`${BASE}/api/admin/providers/${id}/test`, { method: "POST", credentials: "include" });
      const d = await res.json();
      if (d.success) toast({ title: `✅ Provider kết nối thành công! Số dư: $${d.balance}` });
      else toast({ title: `❌ Kết nối thất bại: ${d.error}`, variant: "destructive" });
    } catch {
      toast({ title: "Lỗi test provider", variant: "destructive" });
    } finally { setTesting(null); }
  };

  const syncServices = async (id: number) => {
    setSyncing(id);
    try {
      const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
      const res = await fetch(`${BASE}/api/admin/providers/${id}/sync`, { method: "POST", credentials: "include" });
      const d = await res.json();
      if (d.success) toast({ title: `✅ Đã sync ${d.count} dịch vụ từ provider` });
      else toast({ title: `❌ Sync thất bại: ${d.error}`, variant: "destructive" });
      refetch();
    } catch {
      toast({ title: "Lỗi sync", variant: "destructive" });
    } finally { setSyncing(null); }
  };

  const deleteProvider = async (id: number) => {
    if (!confirm("Xóa provider này?")) return;
    const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
    await fetch(`${BASE}/api/admin/providers/${id}`, { method: "DELETE", credentials: "include" });
    toast({ title: "Đã xóa provider" }); refetch();
  };

  return (
    <DashboardLayout isAdminLayout>
      <div className="space-y-6 pb-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold font-display">Providers</h2>
            <p className="text-muted-foreground mt-1">{providers.length} provider đã kết nối</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => refetch()}><RefreshCw className="w-4 h-4" /></Button>
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" />Thêm provider</Button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>Thêm provider mới</DialogTitle></DialogHeader>
                <ProviderForm onDone={() => { setOpenNew(false); refetch(); }} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl"></div>)}</div>
            ) : !providers.length ? (
              <div className="text-center py-16 text-muted-foreground">
                <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Chưa có provider nào</p>
                <p className="text-sm">Thêm provider SMM để đồng bộ dịch vụ tự động</p>
              </div>
            ) : (
              <div className="divide-y">
                {providers.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-4 p-4 hover:bg-muted/20">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                      {p.name?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{p.name}</p>
                        <Badge variant="outline" className={p.status === "active" ? "text-green-600 border-green-200" : "text-gray-500"}>
                          {p.status === "active" ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono truncate">{p.url}</p>
                      {p.balance && <p className="text-xs text-green-600 font-medium">Số dư: ${p.balance}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="gap-1 text-xs" disabled={testing === p.id} onClick={() => testProvider(p.id)}>
                        {testing === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}Test
                      </Button>
                      <Button variant="ghost" size="sm" className="gap-1 text-xs" disabled={syncing === p.id} onClick={() => syncServices(p.id)}>
                        {syncing === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}Sync
                      </Button>
                      <Dialog>
                        <DialogTrigger asChild><Button variant="ghost" size="icon" onClick={() => setEditProvider(p)}><Edit2 className="w-4 h-4" /></Button></DialogTrigger>
                        <DialogContent><DialogHeader><DialogTitle>Sửa provider</DialogTitle></DialogHeader>
                          <ProviderForm provider={editProvider} onDone={() => { setEditProvider(null); refetch(); }} />
                        </DialogContent>
                      </Dialog>
                      <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => deleteProvider(p.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
