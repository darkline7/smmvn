import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAdminListCategories } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import {
  Database, Plus, Edit2, Trash2, RefreshCw, GripVertical,
  Search, ChevronDown, ChevronUp, Eye, EyeOff, Layers,
} from "lucide-react";
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

// ─── Platform detection (same as services-list dashboard) ────────────────────
function detectPlatform(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("instagram")) return "Instagram";
  if (n.includes("facebook") || (n.includes("fb ") && !n.includes("tiktok"))) return "Facebook";
  if (n.includes("tiktok") || n.includes("tik tok")) return "TikTok";
  if (n.includes("youtube") || n.startsWith("yt ")) return "YouTube";
  if (n.includes("twitter") || n.includes("x - ") || n.startsWith("x ")) return "Twitter/X";
  if (n.includes("telegram")) return "Telegram";
  if (n.includes("spotify")) return "Spotify";
  if (n.includes("discord")) return "Discord";
  if (n.includes("linkedin")) return "LinkedIn";
  if (n.includes("snapchat")) return "Snapchat";
  if (n.includes("pinterest")) return "Pinterest";
  if (n.includes("twitch")) return "Twitch";
  if (n.includes("kick")) return "Kick";
  if (n.includes("threads")) return "Threads";
  if (n.includes("soundcloud")) return "SoundCloud";
  if (n.includes("website") || n.includes("seo") || n.includes("google")) return "Website/SEO";
  if (n.includes("zalo")) return "Zalo";
  if (n.includes("reddit")) return "Reddit";
  if (n.includes("vk ") || n.startsWith("vk")) return "VK";
  if (n.includes("whatsapp")) return "WhatsApp";
  return "Khác";
}

const PLATFORM_EMOJIS: Record<string, string> = {
  Instagram: "📸", Facebook: "👤", TikTok: "🎵", YouTube: "▶️",
  "Twitter/X": "🐦", Telegram: "✈️", Spotify: "🎧", Discord: "💬",
  LinkedIn: "💼", Snapchat: "👻", Pinterest: "📌", Twitch: "🎮",
  Kick: "⚡", Threads: "🧵", SoundCloud: "☁️", "Website/SEO": "🌐",
  Zalo: "💬", Reddit: "🔴", VK: "💙", WhatsApp: "📱", Khác: "📦",
};

// ─── Category form ────────────────────────────────────────────────────────────
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
          <FormItem><FormLabel>Tên danh mục</FormLabel><FormControl><Input placeholder="Instagram - Followers..." {...field} /></FormControl><FormMessage /></FormItem>
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

// ─── Sortable row ─────────────────────────────────────────────────────────────
function SortableCategory({
  cat, onEdit, onDelete, onToggleVisible,
}: {
  cat: any;
  onEdit: (c: any) => void;
  onDelete: (id: number) => void;
  onToggleVisible: (id: number, active: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 10 : undefined };
  const icon = cat.icon || PLATFORM_EMOJIS[detectPlatform(cat.name)] || "📦";

  return (
    <div ref={setNodeRef} style={style}
      className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/20 border-b last:border-0 bg-background ${isDragging ? "shadow-lg rounded-xl" : ""} ${!cat.active ? "opacity-50" : ""}`}
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 touch-none flex-shrink-0">
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-base flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`font-medium text-sm truncate ${!cat.active ? "line-through text-muted-foreground" : ""}`}>{cat.name}</p>
          {!cat.active && <Badge variant="outline" className="text-xs px-1.5 py-0 border-orange-300 text-orange-500">Ẩn</Badge>}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">ID: {cat.id} · {cat.serviceCount || 0} dịch vụ</p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          variant="ghost" size="icon" className={`h-8 w-8 ${cat.active ? "text-muted-foreground hover:text-foreground" : "text-orange-500 hover:text-orange-600"}`}
          title={cat.active ? "Đang hiện — click để ẩn" : "Đang ẩn — click để hiện"}
          onClick={() => onToggleVisible(cat.id, cat.active)}
        >
          {cat.active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </Button>
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

// ─── Platform group (accordion) ───────────────────────────────────────────────
function PlatformGroup({
  platform, cats, expanded, onToggle, onEdit, onDelete, onToggleVisible, onDragEnd, sensors,
}: {
  platform: string; cats: any[]; expanded: boolean; onToggle: () => void;
  onEdit: (c: any) => void; onDelete: (id: number) => void;
  onToggleVisible: (id: number, active: boolean) => void;
  onDragEnd: (e: DragEndEvent, platform: string) => void;
  sensors: any;
}) {
  const emoji = PLATFORM_EMOJIS[platform] || "📦";
  const hiddenCount = cats.filter(c => !c.active).length;

  return (
    <Card className="border-border/50 shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <span className="text-xl">{emoji}</span>
        <div className="flex-1">
          <span className="font-semibold text-sm">{platform}</span>
          <span className="ml-2 text-xs text-muted-foreground">{cats.length} danh mục</span>
          {hiddenCount > 0 && (
            <span className="ml-1.5 text-xs text-orange-500">· {hiddenCount} đang ẩn</span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <CardContent className="p-0 border-t border-border/30">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => onDragEnd(e, platform)}>
            <SortableContext items={cats.map(c => c.id)} strategy={verticalListSortingStrategy}>
              <div>
                {cats.map(c => (
                  <SortableCategory
                    key={c.id} cat={c}
                    onEdit={onEdit} onDelete={onDelete} onToggleVisible={onToggleVisible}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AdminCategories() {
  const { toast } = useToast();
  const [editCat, setEditCat] = useState<any>(null);
  const [openNew, setOpenNew] = useState(false);
  const [localCats, setLocalCats] = useState<any[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [activePlatform, setActivePlatform] = useState<string>("Tất cả");
  const [search, setSearch] = useState("");
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch } = useAdminListCategories();
  const serverCats: any[] = data?.categories || [];
  const categories = localCats ?? serverCats;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Build platform groups preserving order
  const platformGroups = useMemo(() => {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const c of categories) {
      const p = detectPlatform(c.name);
      if (!seen.has(p)) { seen.add(p); order.push(p); }
    }
    return order.map(p => ({
      platform: p,
      cats: categories.filter((c: any) => detectPlatform(c.name) === p),
    }));
  }, [categories]);

  // Platform tab counts
  const platformCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of categories) {
      const p = detectPlatform(c.name);
      map[p] = (map[p] || 0) + 1;
    }
    return map;
  }, [categories]);

  // Filtered groups based on active tab + search
  const visibleGroups = useMemo(() => {
    let groups = platformGroups;
    if (activePlatform !== "Tất cả") {
      groups = groups.filter(g => g.platform === activePlatform);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      groups = groups.map(g => ({
        ...g,
        cats: g.cats.filter((c: any) => c.name.toLowerCase().includes(q) || String(c.id).includes(q)),
      })).filter(g => g.cats.length > 0);
    }
    return groups;
  }, [platformGroups, activePlatform, search]);

  const totalVisible = visibleGroups.reduce((sum, g) => sum + g.cats.length, 0);

  const togglePlatform = (p: string) => {
    setExpandedPlatforms(prev => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  };

  // Expand selected platform automatically
  const handleSelectPlatform = (p: string) => {
    setActivePlatform(p);
    if (p !== "Tất cả") {
      setExpandedPlatforms(prev => new Set([...prev, p]));
    }
  };

  const handleDragEnd = async (event: DragEndEvent, platform: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const group = platformGroups.find(g => g.platform === platform);
    if (!group) return;
    const platCats = group.cats;
    const oldIdx = platCats.findIndex((c: any) => c.id === active.id);
    const newIdx = platCats.findIndex((c: any) => c.id === over.id);
    const reorderedPlat = arrayMove(platCats, oldIdx, newIdx);

    const newAll = categories.map((c: any) => {
      const idx = reorderedPlat.findIndex((r: any) => r.id === c.id);
      if (idx >= 0) return { ...c, sortOrder: idx };
      return c;
    });
    setLocalCats(newAll);

    setSaving(true);
    try {
      await fetch(`${BASE}/api/admin/categories/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orders: reorderedPlat.map((c: any, i: number) => ({ id: c.id, sortOrder: i })) }),
      });
      toast({ title: "Đã lưu thứ tự" });
    } catch {
      toast({ title: "Lỗi lưu thứ tự", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVisible = async (id: number, currentActive: boolean) => {
    setLocalCats(prev => (prev ?? serverCats).map((c: any) => c.id === id ? { ...c, active: !currentActive } : c));
    const res = await fetch(`${BASE}/api/admin/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ active: !currentActive }),
    });
    if (!res.ok) {
      setLocalCats(null);
      toast({ title: "Lỗi cập nhật", variant: "destructive" });
      return;
    }
    toast({ title: currentActive ? "Đã ẩn danh mục" : "Đã hiện danh mục" });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Xóa danh mục này? (Danh mục sẽ bị vô hiệu hóa)")) return;
    await fetch(`${BASE}/api/admin/categories/${id}`, { method: "DELETE", credentials: "include" });
    toast({ title: "Đã xóa danh mục" });
    setLocalCats(null);
    refetch();
  };

  return (
    <DashboardLayout isAdminLayout>
      <div className="space-y-5 pb-8 animate-in fade-in duration-500">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold font-display">Danh mục</h2>
            <p className="text-muted-foreground mt-1">
              {totalVisible} / {categories.length} danh mục
              {activePlatform !== "Tất cả" && <> · <span className="font-medium text-foreground">{activePlatform}</span></>}
              {saving && " · Đang lưu..."}
            </p>
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

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên hoặc ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Platform tabs */}
        {!isLoading && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleSelectPlatform("Tất cả")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                activePlatform === "Tất cả"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:bg-muted"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Tất cả
              <Badge variant="secondary" className={`ml-0.5 h-5 px-1.5 text-xs ${activePlatform === "Tất cả" ? "bg-primary-foreground/20 text-primary-foreground" : ""}`}>
                {categories.length}
              </Badge>
            </button>
            {platformGroups.map(({ platform }) => {
              const emoji = PLATFORM_EMOJIS[platform] || "📦";
              const isActive = activePlatform === platform;
              return (
                <button
                  key={platform}
                  onClick={() => handleSelectPlatform(platform)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:bg-muted"
                  }`}
                >
                  <span>{emoji}</span>
                  {platform}
                  <Badge variant="secondary" className={`ml-0.5 h-5 px-1.5 text-xs ${isActive ? "bg-primary-foreground/20 text-primary-foreground" : ""}`}>
                    {platformCounts[platform] || 0}
                  </Badge>
                </button>
              );
            })}
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-3">
            {[1,2,3,4].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />)}
          </div>
        )}

        {/* Empty */}
        {!isLoading && visibleGroups.length === 0 && (
          <Card className="border-border/50">
            <CardContent className="text-center py-16 text-muted-foreground">
              <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{search ? `Không tìm thấy danh mục khớp "${search}"` : "Chưa có danh mục nào"}</p>
            </CardContent>
          </Card>
        )}

        {/* Platform groups */}
        {!isLoading && visibleGroups.map(({ platform, cats }) => (
          <PlatformGroup
            key={platform}
            platform={platform}
            cats={cats}
            expanded={expandedPlatforms.has(platform)}
            onToggle={() => togglePlatform(platform)}
            onEdit={setEditCat}
            onDelete={handleDelete}
            onToggleVisible={handleToggleVisible}
            onDragEnd={handleDragEnd}
            sensors={sensors}
          />
        ))}
      </div>

      {/* Edit dialog */}
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
