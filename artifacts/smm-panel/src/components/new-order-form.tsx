import { useState, useMemo, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListCategories, useCreateOrder, useGetMe } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Link as LinkIcon, Search, Clipboard, Info, RefreshCw, XCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const orderSchema = z.object({
  serviceId: z.coerce.number().min(1, "Chọn dịch vụ"),
  link: z.string().min(1, "Nhập link"),
  quantity: z.coerce.number().min(1),
});

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

const PLATFORM_EMOJIS: Record<string, string> = {
  Instagram: "📸", Facebook: "👤", TikTok: "🎵", YouTube: "▶️",
  "Twitter/X": "🐦", Telegram: "✈️", Spotify: "🎧", Discord: "💬",
  LinkedIn: "💼", Snapchat: "👻", Pinterest: "📌", Twitch: "🎮",
  Kick: "⚡", Threads: "🧵", SoundCloud: "☁️", "Website/SEO": "🌐", "Khác": "📦",
};

function formatNum(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n);
}

function formatVND(usd: number, rate: number) {
  const vnd = usd * rate;
  if (vnd < 1000) return `${Math.ceil(vnd)}đ`;
  return `${Math.ceil(vnd / 100) * 100 >= 1_000_000 ? (vnd / 1_000_000).toFixed(2) + "M" : (Math.ceil(vnd / 1000)).toLocaleString("vi-VN") + "k"}đ`;
}

export function NewOrderForm({ compact = false }: { compact?: boolean }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user } = useGetMe();
  const { data: categoriesData, isLoading: catLoading } = useListCategories();
  const createOrderMut = useCreateOrder();

  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [selectedCatId, setSelectedCatId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [link, setLink] = useState("");
  const [quantity, setQuantity] = useState(100);
  const linkRef = useRef<HTMLInputElement>(null);

  const { data: publicSettings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => { const r = await fetch(`${BASE}/api/public/settings`); return r.json(); },
    staleTime: 5 * 60_000,
  });
  const vndRate = Number(publicSettings?.vndExchangeRate || 24000);

  // Compute platforms
  const platforms = useMemo(() => {
    const cats = categoriesData?.categories || [];
    const pSet = new Set<string>();
    cats.forEach(c => pSet.add(detectPlatform(c.name)));
    return Array.from(pSet).sort((a, b) => {
      const order = ["Instagram", "Facebook", "TikTok", "YouTube", "Twitter/X", "Telegram", "Spotify", "Discord"];
      const ai = order.indexOf(a), bi = order.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1; if (bi === -1) return -1; return ai - bi;
    });
  }, [categoriesData]);

  // Filter categories by platform
  const filteredCategories = useMemo(() => {
    const cats = categoriesData?.categories || [];
    if (!selectedPlatform) return cats;
    return cats.filter(c => detectPlatform(c.name) === selectedPlatform);
  }, [categoriesData, selectedPlatform]);

  // Lazy load services for selected category
  const { data: servicesData, isLoading: srvLoading } = useQuery({
    queryKey: ["services-cat", selectedCatId],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/services?categoryId=${selectedCatId}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!selectedCatId,
    staleTime: 2 * 60_000,
  });
  const services: any[] = servicesData?.services || [];

  // Search across all services (search mode)
  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ["services-search", searchQuery],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/services?search=${encodeURIComponent(searchQuery)}`, { credentials: "include" });
      return res.json();
    },
    enabled: searchQuery.length >= 2,
    staleTime: 60_000,
  });
  const searchResults: any[] = searchData?.services?.slice(0, 20) || [];

  const selectedService = useMemo(() => {
    if (!serviceId) return null;
    return services.find((s: any) => s.id === serviceId) || null;
  }, [services, serviceId]);

  // Auto-select first service when category services load
  useEffect(() => {
    if (services.length > 0 && !serviceId) setServiceId(services[0].id);
    if (services.length > 0) {
      setQuantity(services[0].min || 100);
    }
  }, [services]);

  // Reset service when category changes
  useEffect(() => { setServiceId(null); }, [selectedCatId]);

  // Reset category when platform changes
  useEffect(() => { setSelectedCatId(""); setServiceId(null); }, [selectedPlatform]);

  const price = useMemo(() => {
    if (!selectedService || !quantity) return 0;
    return (quantity / 1000) * Number(selectedService.rate);
  }, [selectedService, quantity]);

  const handleSearchSelect = (svc: any) => {
    setServiceId(svc.id);
    setSearchQuery(svc.name);
    setShowSearchResults(false);
    const cat = categoriesData?.categories?.find(c => c.id === svc.categoryId);
    if (cat) {
      setSelectedPlatform(detectPlatform(cat.name));
      setSelectedCatId(cat.id.toString());
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
    if (!serviceId) { toast({ title: "Chọn dịch vụ", variant: "destructive" }); return; }
    if (!link) { toast({ title: "Nhập link cần tăng", variant: "destructive" }); return; }
    if (selectedService && (quantity < selectedService.min || quantity > selectedService.max)) {
      toast({ variant: "destructive", title: "Số lượng không hợp lệ", description: `Phải từ ${formatNum(selectedService.min)} đến ${formatNum(selectedService.max)}` });
      return;
    }
    if (user && price > Number(user.balance)) {
      toast({ variant: "destructive", title: "Số dư không đủ", description: "Nạp thêm tiền để đặt hàng." });
      return;
    }
    createOrderMut.mutate({ data: { serviceId, link, quantity } }, {
      onSuccess: () => {
        toast({ title: "Đặt hàng thành công!", description: "Đơn hàng đang được xử lý." });
        setLocation("/orders");
      },
      onError: (err: any) => toast({ variant: "destructive", title: "Đặt hàng thất bại", description: err.message }),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Quick Search */}
      <div className="space-y-1">
        <Label className="text-sm font-medium">Tìm nhanh dịch vụ</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9 bg-background"
            placeholder="Nhập tên dịch vụ hoặc ID để tìm kiếm và tự động chọn"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setShowSearchResults(true); }}
            onFocus={() => setShowSearchResults(true)}
            onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
          />
          {searchLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
        <p className="text-xs text-muted-foreground">Nhập tên hoặc ID dịch vụ để tìm kiếm nhanh và tự động chọn</p>
        {showSearchResults && searchResults.length > 0 && (
          <div className="absolute z-50 mt-1 w-full max-w-lg bg-background border border-border rounded-xl shadow-xl max-h-72 overflow-y-auto">
            {searchResults.map((svc: any) => (
              <button
                key={svc.id} type="button"
                className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors flex items-center gap-3 border-b border-border/30 last:border-0"
                onMouseDown={() => handleSearchSelect(svc)}
              >
                <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">#{svc.id}</span>
                <span className="text-sm truncate flex-1">{svc.name}</span>
                <span className="text-xs text-primary font-medium flex-shrink-0">${Number(svc.rate).toFixed(3)}/1K</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Platform select */}
      <div className="space-y-1">
        <Label className="text-sm font-medium">Nền tảng</Label>
        <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
          <SelectTrigger className="bg-background h-11">
            <SelectValue placeholder="-- Chọn nền tảng --">
              {selectedPlatform && `${PLATFORM_EMOJIS[selectedPlatform] || "📦"} ${selectedPlatform}`}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">🌐 Tất cả nền tảng</SelectItem>
            {platforms.map(p => (
              <SelectItem key={p} value={p}>
                {PLATFORM_EMOJIS[p] || "📦"} {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Category select */}
      <div className="space-y-1">
        <Label className="text-sm font-medium">Phân loại</Label>
        <Select
          value={selectedCatId}
          onValueChange={val => { setSelectedCatId(val); setServiceId(null); }}
          disabled={catLoading}
        >
          <SelectTrigger className="bg-background h-11">
            <SelectValue placeholder={catLoading ? "Đang tải..." : "-- Chọn phân loại --"}>
              {selectedCatId && filteredCategories.find(c => c.id.toString() === selectedCatId) && (
                <span className="flex items-center gap-2">
                  <span>{PLATFORM_EMOJIS[detectPlatform(filteredCategories.find(c => c.id.toString() === selectedCatId)!.name)] || "📦"}</span>
                  <span className="truncate">{filteredCategories.find(c => c.id.toString() === selectedCatId)?.name}</span>
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {filteredCategories.filter(c => c.active).map(cat => (
              <SelectItem key={cat.id} value={cat.id.toString()}>
                <span className="flex items-center gap-2">
                  <span>{PLATFORM_EMOJIS[detectPlatform(cat.name)] || "📦"}</span>
                  <span>{cat.name}</span>
                  {(cat as any).serviceCount > 0 && (
                    <span className="text-xs text-muted-foreground">({(cat as any).serviceCount})</span>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Service select */}
      <div className="space-y-1">
        <Label className="text-sm font-medium">Dịch vụ</Label>
        <Select
          value={serviceId?.toString() || ""}
          onValueChange={val => {
            const id = parseInt(val);
            setServiceId(id);
            const svc = services.find((s: any) => s.id === id);
            if (svc?.min) setQuantity(svc.min);
          }}
          disabled={!selectedCatId || srvLoading || services.length === 0}
        >
          <SelectTrigger className="bg-background h-11">
            {srvLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /><span>Đang tải dịch vụ...</span>
              </div>
            ) : (
              <SelectValue placeholder={!selectedCatId ? "Chọn phân loại trước" : services.length === 0 ? "Không có dịch vụ" : "-- Chọn dịch vụ --"}>
                {serviceId && selectedService && (
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded flex-shrink-0">#{selectedService.id}</span>
                    <span className="truncate">{selectedService.name}</span>
                  </span>
                )}
              </SelectValue>
            )}
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {services.map((svc: any) => (
              <SelectItem key={svc.id} value={svc.id.toString()}>
                <span className="flex items-center gap-2 w-full">
                  <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">#{svc.id}</span>
                  <span className="flex-1 truncate">{svc.name}</span>
                  <span className="text-xs text-primary font-medium flex-shrink-0">${Number(svc.rate).toFixed(3)}/1K</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Link */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Liên kết cần tăng</Label>
          <button type="button" onClick={() => setLocation("/mass-order")} className="text-xs text-primary hover:underline">Bạn muốn mua 1 lần nhiều link?</button>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={linkRef}
              className="pl-9 bg-background h-11"
              placeholder="Nhập liên kết cần tăng tương tác..."
              value={link}
              onChange={e => setLink(e.target.value)}
            />
          </div>
          <Button type="button" variant="outline" className="h-11 px-4 gap-1.5 flex-shrink-0" onClick={handlePaste}>
            <Clipboard className="w-4 h-4" /> Dán
          </Button>
        </div>
      </div>

      {/* Quantity */}
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

      {/* Total */}
      {selectedService && (
        <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">Tổng tiền cần thanh toán:</span>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary font-display">{formatVND(price, vndRate)}</p>
              <p className="text-xs text-muted-foreground">(${price.toFixed(4)})</p>
            </div>
          </div>
        </div>
      )}

      {/* Service Details (compact) */}
      {selectedService && (
        <div className="rounded-xl border border-border/40 bg-secondary/20 p-3 space-y-2">
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
          {selectedService.description && (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{selectedService.description}</p>
          )}
        </div>
      )}

      {/* Submit */}
      <Button
        type="submit"
        size="lg"
        className="w-full h-12 text-base font-semibold shadow-md shadow-primary/20"
        disabled={createOrderMut.isPending || !serviceId || !link}
      >
        {createOrderMut.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Đang xử lý...</> : "Đặt hàng"}
      </Button>
    </form>
  );
}
