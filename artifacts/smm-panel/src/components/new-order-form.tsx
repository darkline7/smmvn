import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useCreateOrder, useGetMe } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LinkIcon, Search, Clipboard, RefreshCw, XCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

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
  return "Khác";
}

const PLATFORM_EMOJI: Record<string, string> = {
  Instagram: "📸", Facebook: "👤", TikTok: "🎵", YouTube: "▶️",
  "Twitter/X": "🐦", Telegram: "✈️", Spotify: "🎧", Discord: "💬",
  LinkedIn: "💼", Snapchat: "👻", Pinterest: "📌", Twitch: "🎮",
  Kick: "⚡", Threads: "🧵", SoundCloud: "☁️", "Website/SEO": "🌐", "Khác": "📦",
};

const PLATFORM_ORDER: string[] = [];

function formatNum(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n);
}

function calcVND(usd: number, rate: number) {
  const vnd = Math.ceil(usd * rate);
  return `${vnd.toLocaleString("vi-VN")}đ`;
}

export function NewOrderForm({ compact = false }: { compact?: boolean }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user } = useGetMe();
  const createOrderMut = useCreateOrder();

  const [platform, setPlatform] = useState("");
  const [catId, setCatId] = useState("");
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [link, setLink] = useState("");
  const [comments, setComments] = useState("");
  const [quantity, setQuantity] = useState(100);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const linkRef = useRef<HTMLInputElement>(null);

  // Settings (exchange rate)
  const { data: settings } = useQuery<any>({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/public/settings`);
      if (!r.ok) return null;
      return r.json();
    },
    staleTime: 5 * 60_000,
  });
  const vndRate = Number(settings?.vndExchangeRate || 24000);

  // Categories
  const { data: catData, isLoading: catLoading } = useQuery<any>({
    queryKey: ["categories"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/categories`, { credentials: "include" });
      if (!r.ok) return { categories: [] };
      return r.json();
    },
    staleTime: 10 * 60_000,
  });
  const allCategories: any[] = catData?.categories || [];

  // Platforms — preserve source provider order (no re-sort)
  const platforms = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const c of allCategories) {
      const p = detectPlatform(c.name);
      if (!seen.has(p)) { seen.add(p); result.push(p); }
    }
    return result;
  }, [allCategories]);

  // Filtered categories by selected platform
  const filteredCats = useMemo(() => {
    if (!platform) return allCategories.filter((c: any) => c.active !== false);
    return allCategories.filter((c: any) => c.active !== false && detectPlatform(c.name) === platform);
  }, [allCategories, platform]);

  // Services for selected category (lazy)
  const { data: svcData, isLoading: svcLoading } = useQuery<any>({
    queryKey: ["svc-cat", catId],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/services?categoryId=${catId}`, { credentials: "include" });
      if (!r.ok) return { services: [] };
      return r.json();
    },
    enabled: !!catId,
    staleTime: 2 * 60_000,
  });
  const services: any[] = svcData?.services || [];

  // Search services
  const { data: searchData, isLoading: searchLoading } = useQuery<any>({
    queryKey: ["svc-search", search],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/services?search=${encodeURIComponent(search)}`, { credentials: "include" });
      if (!r.ok) return { services: [] };
      return r.json();
    },
    enabled: search.length >= 2,
    staleTime: 60_000,
  });
  const searchResults: any[] = searchData?.services?.slice(0, 15) || [];

  // Selected service object
  const selectedService = useMemo(
    () => (serviceId ? services.find((s: any) => s.id === serviceId) || null : null),
    [services, serviceId]
  );

  // Auto-select first service + set min quantity when services load
  useEffect(() => {
    if (services.length > 0) {
      setServiceId(prev => prev ?? services[0].id);
    }
  }, [svcData]);

  useEffect(() => {
    if (selectedService?.min) setQuantity(selectedService.min);
  }, [selectedService?.id]);

  // Reset when category changes
  useEffect(() => { setServiceId(null); }, [catId]);

  // Reset category when platform changes
  useEffect(() => { setCatId(""); }, [platform]);

  const totalUSD = selectedService && quantity
    ? (quantity / 1000) * Number(selectedService.rate)
    : 0;

  const handleSearchSelect = (svc: any) => {
    setServiceId(svc.id);
    setSearch(svc.name);
    setShowSearch(false);
    const cat = allCategories.find((c: any) => c.id === svc.categoryId);
    if (cat) {
      setPlatform(detectPlatform(cat.name));
      setCatId(cat.id.toString());
    }
    if (svc.min) setQuantity(svc.min);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setLink(text);
    } catch {
      linkRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceId) { toast({ title: "Vui lòng chọn dịch vụ", variant: "destructive" }); return; }
    if (!link.trim()) { toast({ title: "Vui lòng nhập link", variant: "destructive" }); return; }
    if (selectedService) {
      if (quantity < selectedService.min || quantity > selectedService.max) {
        toast({ variant: "destructive", title: "Số lượng không hợp lệ", description: `Tối thiểu ${formatNum(selectedService.min)} — Tối đa ${formatNum(selectedService.max)}` });
        return;
      }
    }
    if (user && totalUSD > Number(user.balance || 0)) {
      toast({ variant: "destructive", title: "Số dư không đủ", description: "Vui lòng nạp thêm tiền." });
      return;
    }
    if (selectedService?.type === "custom_comments" && !comments.trim()) {
      toast({ variant: "destructive", title: "Vui lòng nhập nội dung bình luận" });
      return;
    }
    createOrderMut.mutate(
      { data: { serviceId: serviceId!, link: link.trim(), quantity, ...(comments.trim() ? { comments: comments.trim() } : {}) } },
      {
        onSuccess: () => {
          toast({ title: "Đặt hàng thành công!", description: "Đơn hàng đang được xử lý." });
          setLocation("/orders");
        },
        onError: (err: any) =>
          toast({ variant: "destructive", title: "Đặt hàng thất bại", description: err?.message || "Lỗi không xác định" }),
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 1. Quick search */}
      <div className="space-y-1 relative">
        <Label className="text-sm font-medium">Tìm nhanh dịch vụ</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9 bg-background"
            placeholder="Nhập tên hoặc ID dịch vụ..."
            value={search}
            onChange={e => { setSearch(e.target.value); setShowSearch(true); }}
            onFocus={() => setShowSearch(true)}
            onBlur={() => setTimeout(() => setShowSearch(false), 200)}
          />
          {searchLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <p className="text-xs text-muted-foreground">Nhập tên hoặc ID dịch vụ để tìm kiếm và tự động chọn</p>
        {showSearch && searchResults.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 bg-background border border-border rounded-xl shadow-xl max-h-48 sm:max-h-64 overflow-y-auto">
            {searchResults.map((svc: any) => (
              <button
                key={svc.id} type="button"
                className="w-full px-3 py-2.5 text-left hover:bg-muted/50 flex items-center gap-2 border-b border-border/20 last:border-0"
                onMouseDown={() => handleSearchSelect(svc)}
              >
                <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">#{svc.id}</span>
                <span className="text-sm truncate flex-1">{svc.name}</span>
                <span className="text-xs text-primary font-medium shrink-0">${Number(svc.rate).toFixed(3)}/1K</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Platform */}
      <div className="space-y-1">
        <Label className="text-sm font-medium">Nền tảng</Label>
        <Select value={platform || "all"} onValueChange={val => setPlatform(val === "all" ? "" : val)}>
          <SelectTrigger className="bg-background h-11">
            <SelectValue placeholder="-- Chọn nền tảng --" />
          </SelectTrigger>
          <SelectContent className="max-h-72 overflow-y-auto">
            <SelectItem value="all">🌐 Tất cả nền tảng</SelectItem>
            {platforms.map(p => (
              <SelectItem key={p} value={p}>
                {PLATFORM_EMOJI[p] || "📦"} {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 3. Category */}
      <div className="space-y-1">
        <Label className="text-sm font-medium">Phân loại</Label>
        <Select
          value={catId}
          onValueChange={val => { setCatId(val); setServiceId(null); }}
          disabled={catLoading || filteredCats.length === 0}
        >
          <SelectTrigger className="bg-background h-11">
            <SelectValue placeholder={catLoading ? "Đang tải..." : "-- Chọn phân loại --"} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {filteredCats.map((cat: any) => (
              <SelectItem key={cat.id} value={cat.id.toString()}>
                {PLATFORM_EMOJI[detectPlatform(cat.name)] || "📦"} {cat.name}
                {cat.serviceCount > 0 ? ` (${cat.serviceCount})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 4. Service — scrollable list */}
      <div className="space-y-1">
        <Label className="text-sm font-medium">Dịch vụ</Label>
        {!catId ? (
          <div className="border rounded-xl bg-muted/30 py-4 text-center text-sm text-muted-foreground">
            Chọn phân loại trước
          </div>
        ) : svcLoading ? (
          <div className="border rounded-xl bg-muted/30 py-5 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : services.length === 0 ? (
          <div className="border rounded-xl bg-muted/30 py-4 text-center text-sm text-muted-foreground">
            Không có dịch vụ trong phân loại này
          </div>
        ) : (
          <div className="border rounded-xl overflow-hidden shadow-sm">
            {serviceId && (() => {
              const sel = services.find((s: any) => s.id === serviceId);
              return sel ? (
                <div className="bg-primary/10 border-b px-3 py-2 flex items-start gap-2">
                  <span className="font-mono text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded shrink-0 mt-0.5">#{sel.id}</span>
                  <span className="flex-1 text-sm font-medium leading-snug">{sel.name}</span>
                  <span className="text-xs text-primary font-semibold shrink-0 mt-0.5">{calcVND(Number(sel.rate), vndRate)}/1K</span>
                </div>
              ) : null;
            })()}
            <div className="max-h-40 sm:max-h-52 overflow-y-auto divide-y">
              {services.map((svc: any) => (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => { setServiceId(svc.id); if (svc.min) setQuantity(svc.min); }}
                  className={`w-full px-3 py-2.5 text-left flex items-start gap-2 hover:bg-muted/50 transition-colors ${serviceId === svc.id ? "bg-primary/5" : ""}`}
                >
                  <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0 mt-0.5">#{svc.id}</span>
                  <span className="flex-1 text-sm text-foreground leading-snug">{svc.name}</span>
                  <span className="text-xs text-primary font-medium shrink-0 mt-0.5">{calcVND(Number(svc.rate), vndRate)}/1K</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 5. Link */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Liên kết cần tăng</Label>
          <button type="button" onClick={() => setLocation("/mass-order")} className="text-xs text-primary hover:underline">
            Mua 1 lần nhiều link?
          </button>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              ref={linkRef}
              className="pl-9 bg-background h-11"
              placeholder="Nhập liên kết cần tăng tương tác..."
              value={link}
              onChange={e => setLink(e.target.value)}
            />
          </div>
          <Button type="button" variant="outline" className="h-11 px-4 gap-1.5 shrink-0" onClick={handlePaste}>
            <Clipboard className="w-4 h-4" /> Dán
          </Button>
        </div>
      </div>

      {/* Comments field — only for custom_comments services */}
      {selectedService?.type === "custom_comments" && (
        <div className="space-y-1">
          <Label className="text-sm font-medium">Nội dung bình luận</Label>
          <Textarea
            className="bg-background min-h-[120px] resize-y font-mono text-sm"
            placeholder={"Nhập mỗi bình luận trên một dòng...\nVí dụ:\nBình luận 1\nBình luận 2"}
            value={comments}
            onChange={e => setComments(e.target.value)}
            rows={5}
          />
          <p className="text-xs text-muted-foreground">{comments.split("\n").filter(Boolean).length} bình luận — mỗi dòng là 1 comment</p>
        </div>
      )}

      {/* 6. Quantity */}
      <div className="space-y-1">
        <Label className="text-sm font-medium">Số lượng</Label>
        <Input
          type="number"
          className="bg-background h-11"
          value={quantity}
          onChange={e => setQuantity(Number(e.target.value))}
          min={selectedService?.min || 1}
          max={selectedService?.max}
        />
        {selectedService && (
          <p className="text-xs text-muted-foreground">
            Tối thiểu: {formatNum(selectedService.min)} — Tối đa: {formatNum(selectedService.max)}
          </p>
        )}
      </div>

      {/* 7. Total */}
      {selectedService && (
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm">Tổng tiền cần thanh toán:</span>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary font-display">{calcVND(totalUSD, vndRate)}</p>
              <p className="text-xs text-muted-foreground">(${totalUSD.toFixed(4)})</p>
            </div>
          </div>
        </div>
      )}

      {/* 8. Service info badges */}
      {selectedService && (
        <div className="flex flex-wrap gap-2">
          <Badge variant={selectedService.refill ? "success" : "secondary"} className="text-xs gap-1">
            <RefreshCw className="w-3 h-3" />{selectedService.refill ? "Có Refill" : "Không Refill"}
          </Badge>
          <Badge variant="outline" className="text-xs gap-1 border-muted-foreground/30">
            <XCircle className="w-3 h-3 text-muted-foreground" />{selectedService.cancel ? "Hủy được" : "Không hủy"}
          </Badge>
          {selectedService.averageTime && (
            <Badge variant="outline" className="text-xs gap-1 border-muted-foreground/30">
              <Clock className="w-3 h-3 text-muted-foreground" />{selectedService.averageTime}
            </Badge>
          )}
        </div>
      )}

      {/* 9. Submit */}
      <Button
        type="submit"
        size="lg"
        className="w-full h-12 text-base font-semibold shadow-md shadow-primary/20"
        disabled={createOrderMut.isPending || !serviceId || !link.trim()}
      >
        {createOrderMut.isPending
          ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Đang xử lý...</>
          : "Đặt hàng"}
      </Button>
    </form>
  );
}
