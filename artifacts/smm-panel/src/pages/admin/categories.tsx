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
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

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
    defaultValues: cat
      ? { name: cat.name, icon: cat.icon || "", description: cat.description || "", sortOrder: cat.sortOrder || 0 }
      : { name: "", icon: "", description: "", sortOrder: 0 },
  });

  const onSubmit = async (values: z.infer<typeof catSchema>) => {
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
          <FormItem><FormLabel>Thứ tự (số)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <Button type="submit" className="w-full">{cat ? "Cập nhật" : "Tạo danh mục"}</Button>
      </form>
    </Form>
  );
}

function SortableCategory({ cat, onEdit, onDelete }: { cat: any; onEdit: (c: any) => void; onDelete: (id: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={`flex items-center gap-3 p-3.5 hover:bg-muted/20 border-b last:border-0 bg-background ${isDragging ? "shadow-lg rounded-xl" : ""}`}>
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 touch-none">
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-lg flex-shrink-0">
        {cat.icon || "📦"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{cat.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          ID: {cat.id} · Dịch vụ: {cat.serviceCount || 0}
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(cat)}>
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Sửa danh mục</DialogTitle></DialogHeader>
            <CategoryForm cat={cat} onDone={() => onEdit(null)} />
          </DialogContent>
        </Dialog>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => onDelete(cat.id)}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default function AdminCategories() {
  const { toast } = useToast();
  const [editCat, setEditCat] = useState<any>(null);
  const [openNew, setOpenNew] = useState(false);
  const [localCats, setLocalCats] = useState<any[] | null>(null);
  const [saving, setSaving] = useState(false);
  const { data, isLoading, refetch } = useAdminListCategories();
  const serverCats: any[] = data?.categories || [];
  const categories = localCats ?? serverCats;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.findIndex((c: any) => c.id === active.id);
    const newIndex = categories.findIndex((c: any) => c.id === over.id);
    const reordered = arrayMove(categories, oldIndex, newIndex).map((c, i) => ({ ...c, sortOrder: i }));
    setLocalCats(reordered);

    setSaving(true);
    try {
      await fetch(`${BASE}/api/admin/categories/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orders: reordered.map((c: any) => ({ id: c.id, sortOrder: c.sortOrder })) }),
      });
      toast({ title: "Đã lưu thứ tự danh mục" });
    } catch {
      toast({ title: "Lỗi lưu thứ tự", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deletecat = async (id: number) => {
    if (!confirm("Xóa danh mục này?")) return;
    await fetch(`${BASE}/api/admin/categories/${id}`, { method: "DELETE", credentials: "include" });
    toast({ title: "Đã xóa danh mục" });
    setLocalCats(null);
    refetch();
  };

  return (
    <DashboardLayout isAdminLayout>
      <div className="space-y-6 pb-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold font-display">Danh mục</h2>
            <p className="text-muted-foreground mt-1">{categories.length} danh mục{saving ? " · Đang lưu..." : ""}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => { setLocalCats(null); refetch(); }}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="w-4 h-4" />Thêm danh mục</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Thêm danh mục mới</DialogTitle></DialogHeader>
                <CategoryForm onDone={() => { setOpenNew(false); setLocalCats(null); refetch(); }} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="text-xs text-muted-foreground flex items-center gap-1.5 bg-muted/40 border rounded-lg px-3 py-2">
          <GripVertical className="w-3.5 h-3.5 flex-shrink-0" />
          Kéo thả để sắp xếp thứ tự hiển thị danh mục. Thứ tự được lưu tự động.
        </div>

        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-xl"></div>)}</div>
            ) : !categories.length ? (
              <div className="text-center py-16 text-muted-foreground">
                <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Chưa có danh mục nào</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={categories.map((c: any) => c.id)} strategy={verticalListSortingStrategy}>
                  <div className="divide-y divide-border/30">
                    {categories.map((c: any) => (
                      <SortableCategory
                        key={c.id}
                        cat={c}
                        onEdit={setEditCat}
                        onDelete={deletecat}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit dialog (outside SortableContext) */}
      {editCat && (
        <Dialog open={!!editCat} onOpenChange={open => !open && setEditCat(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Sửa danh mục</DialogTitle></DialogHeader>
            <CategoryForm cat={editCat} onDone={() => { setEditCat(null); setLocalCats(null); refetch(); }} />
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
