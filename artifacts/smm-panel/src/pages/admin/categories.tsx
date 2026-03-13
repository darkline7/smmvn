import { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAdminListCategories } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Database, Plus, Edit2, Trash2, RefreshCw, GripVertical } from "lucide-react";

const catSchema = z.object({
  name: z.string().min(2, "Tên tối thiểu 2 ký tự"),
  icon: z.string().optional(),
  description: z.string().optional(),
  sortOrder: z.coerce.number().optional(),
});

function CategoryForm({ cat, onDone }: { cat?: any; onDone: () => void }) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof catSchema>>({
    resolver: zodResolver(catSchema),
    defaultValues: cat ? { name: cat.name, icon: cat.icon || "", description: cat.description || "", sortOrder: cat.sortOrder || 0 } : { name: "", icon: "", description: "", sortOrder: 0 },
  });

  const onSubmit = async (values: z.infer<typeof catSchema>) => {
    const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
    const url = cat ? `${BASE}/api/admin/categories/${cat.id}` : `${BASE}/api/admin/categories`;
    const method = cat ? "PATCH" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(values) });
    if (!res.ok) { toast({ title: "Lỗi lưu danh mục", variant: "destructive" }); return; }
    toast({ title: cat ? "Cập nhật thành công!" : "Tạo danh mục thành công!" });
    onDone();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem><FormLabel>Tên danh mục</FormLabel><FormControl><Input placeholder="Instagram, TikTok..." {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="icon" render={({ field }) => (
          <FormItem><FormLabel>Icon (emoji)</FormLabel><FormControl><Input placeholder="📸" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem><FormLabel>Mô tả</FormLabel><FormControl><Input placeholder="Mô tả danh mục..." {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="sortOrder" render={({ field }) => (
          <FormItem><FormLabel>Thứ tự</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <Button type="submit" className="w-full">{cat ? "Cập nhật" : "Tạo danh mục"}</Button>
      </form>
    </Form>
  );
}

export default function AdminCategories() {
  const { toast } = useToast();
  const [editCat, setEditCat] = useState<any>(null);
  const [openNew, setOpenNew] = useState(false);
  const { data, isLoading, refetch } = useAdminListCategories();
  const categories = data?.categories || [];

  const deletecat = async (id: number) => {
    if (!confirm("Xóa danh mục này?")) return;
    const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
    await fetch(`${BASE}/api/admin/categories/${id}`, { method: "DELETE", credentials: "include" });
    toast({ title: "Đã xóa danh mục" });
    refetch();
  };

  return (
    <DashboardLayout isAdminLayout>
      <div className="space-y-6 pb-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold font-display">Danh mục</h2>
            <p className="text-muted-foreground mt-1">{categories.length} danh mục</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => refetch()}><RefreshCw className="w-4 h-4" /></Button>
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="w-4 h-4" />Thêm danh mục</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Thêm danh mục mới</DialogTitle></DialogHeader>
                <CategoryForm onDone={() => { setOpenNew(false); refetch(); }} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl"></div>)}</div>
            ) : !categories.length ? (
              <div className="text-center py-16 text-muted-foreground">
                <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Chưa có danh mục nào</p>
              </div>
            ) : (
              <div className="divide-y">
                {categories.map((c: any) => (
                  <div key={c.id} className="flex items-center gap-4 p-4 hover:bg-muted/20">
                    <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-xl flex-shrink-0">{c.icon || "📦"}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{c.name}</p>
                      {c.description && <p className="text-xs text-muted-foreground truncate">{c.description}</p>}
                      <p className="text-xs text-muted-foreground mt-0.5">ID: {c.id} · Thứ tự: {c.sortOrder || 0}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => setEditCat(c)}><Edit2 className="w-4 h-4" /></Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Sửa danh mục</DialogTitle></DialogHeader>
                          <CategoryForm cat={editCat} onDone={() => { setEditCat(null); refetch(); }} />
                        </DialogContent>
                      </Dialog>
                      <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => deletecat(c.id)}>
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
