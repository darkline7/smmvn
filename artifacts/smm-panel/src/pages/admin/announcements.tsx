import { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAdminListAnnouncements } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Volume2, Plus, Edit2, Trash2, RefreshCw, Info, AlertTriangle, CheckCircle2, Wrench } from "lucide-react";

const typeConfig: Record<string, { icon: any; color: string; label: string }> = {
  info:        { icon: Info, color: "text-blue-500", label: "Thông tin" },
  warning:     { icon: AlertTriangle, color: "text-yellow-500", label: "Cảnh báo" },
  success:     { icon: CheckCircle2, color: "text-green-500", label: "Thành công" },
  maintenance: { icon: Wrench, color: "text-orange-500", label: "Bảo trì" },
};

const schema = z.object({
  title: z.string().min(2),
  content: z.string().min(5),
  type: z.enum(["info", "warning", "success", "maintenance"]),
  active: z.boolean().default(true),
});

function AnnouncementForm({ ann, onDone }: { ann?: any; onDone: () => void }) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: ann ? { title: ann.title, content: ann.content, type: ann.type, active: ann.active } : { title: "", content: "", type: "info", active: true },
  });

  const onSubmit = async (values: z.infer<typeof schema>) => {
    const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
    const url = ann ? `${BASE}/api/admin/announcements/${ann.id}` : `${BASE}/api/admin/announcements`;
    const res = await fetch(url, { method: ann ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(values) });
    if (!res.ok) { toast({ title: "Lỗi lưu thông báo", variant: "destructive" }); return; }
    toast({ title: "Lưu thành công!" });
    onDone();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="title" render={({ field }) => (
          <FormItem><FormLabel>Tiêu đề</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="type" render={({ field }) => (
          <FormItem><FormLabel>Loại</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(typeConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormItem>
        )} />
        <FormField control={form.control} name="content" render={({ field }) => (
          <FormItem><FormLabel>Nội dung</FormLabel><FormControl><Textarea rows={4} {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="active" render={({ field }) => (
          <FormItem className="flex items-center gap-3">
            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
            <FormLabel className="!mt-0">Hiển thị</FormLabel>
          </FormItem>
        )} />
        <Button type="submit" className="w-full">Lưu thông báo</Button>
      </form>
    </Form>
  );
}

export default function AdminAnnouncements() {
  const { toast } = useToast();
  const [editAnn, setEditAnn] = useState<any>(null);
  const [openNew, setOpenNew] = useState(false);
  const { data, isLoading, refetch } = useAdminListAnnouncements();
  const announcements = data?.announcements || [];

  const deleteAnn = async (id: number) => {
    if (!confirm("Xóa thông báo này?")) return;
    const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
    await fetch(`${BASE}/api/admin/announcements/${id}`, { method: "DELETE", credentials: "include" });
    toast({ title: "Đã xóa" }); refetch();
  };

  return (
    <DashboardLayout isAdminLayout>
      <div className="space-y-6 pb-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold font-display">Thông báo hệ thống</h2>
            <p className="text-muted-foreground mt-1">{announcements.length} thông báo</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => refetch()}><RefreshCw className="w-4 h-4" /></Button>
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" />Thêm thông báo</Button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>Thêm thông báo mới</DialogTitle></DialogHeader>
                <AnnouncementForm onDone={() => { setOpenNew(false); refetch(); }} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl"></div>)}</div>
            ) : !announcements.length ? (
              <div className="text-center py-16 text-muted-foreground">
                <Volume2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Chưa có thông báo nào</p>
              </div>
            ) : (
              <div className="divide-y">
                {announcements.map((a: any) => {
                  const cfg = typeConfig[a.type] || typeConfig.info;
                  const Icon = cfg.icon;
                  return (
                    <div key={a.id} className="flex items-start gap-4 p-4 hover:bg-muted/20">
                      <Icon className={`w-5 h-5 ${cfg.color} flex-shrink-0 mt-0.5`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">{a.title}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${a.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                            {a.active ? "Đang hiện" : "Ẩn"}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{a.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">{format(new Date(a.createdAt), "dd/MM/yyyy HH:mm")}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Dialog>
                          <DialogTrigger asChild><Button variant="ghost" size="icon" onClick={() => setEditAnn(a)}><Edit2 className="w-4 h-4" /></Button></DialogTrigger>
                          <DialogContent><DialogHeader><DialogTitle>Sửa thông báo</DialogTitle></DialogHeader>
                            <AnnouncementForm ann={editAnn} onDone={() => { setEditAnn(null); refetch(); }} />
                          </DialogContent>
                        </Dialog>
                        <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => deleteAnn(a.id)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </div>
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
