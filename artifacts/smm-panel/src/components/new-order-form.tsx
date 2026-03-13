import { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListCategories, useCreateOrder, useGetMe } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Info, Clock, RefreshCw, XCircle, Zap, Link as LinkIcon, Hash, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const orderSchema = z.object({
  categoryId: z.string().min(1, "Chọn danh mục"),
  serviceId: z.coerce.number().min(1, "Chọn dịch vụ"),
  link: z.string().url("URL không hợp lệ"),
  quantity: z.coerce.number().min(1),
});

// Detect platform from category name
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

const PLATFORM_COLORS: Record<string, string> = {
  Instagram: "from-pink-500 to-purple-600",
  Facebook: "from-blue-600 to-blue-700",
  TikTok: "from-black to-gray-800",
  YouTube: "from-red-600 to-red-700",
  "Twitter/X": "from-gray-900 to-black",
  Telegram: "from-sky-500 to-blue-600",
  Spotify: "from-green-500 to-green-700",
  Discord: "from-indigo-500 to-violet-600",
  LinkedIn: "from-blue-700 to-blue-800",
  Snapchat: "from-yellow-400 to-yellow-500",
  Pinterest: "from-red-600 to-red-700",
  Twitch: "from-purple-600 to-violet-700",
  Kick: "from-green-600 to-green-700",
  Threads: "from-gray-800 to-black",
  SoundCloud: "from-orange-500 to-orange-700",
  "Website/SEO": "from-teal-500 to-cyan-600",
  "Khác": "from-gray-500 to-gray-600",
};

const PLATFORM_EMOJIS: Record<string, string> = {
  Instagram: "📸",
  Facebook: "👤",
  TikTok: "🎵",
  YouTube: "▶️",
  "Twitter/X": "🐦",
  Telegram: "✈️",
  Spotify: "🎧",
  Discord: "💬",
  LinkedIn: "💼",
  Snapchat: "👻",
  Pinterest: "📌",
  Twitch: "🎮",
  Kick: "⚡",
  Threads: "🧵",
  SoundCloud: "☁️",
  "Website/SEO": "🌐",
  "Khác": "📦",
};

function formatNumber(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n);
}

export function NewOrderForm({ compact = false }: { compact?: boolean }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user } = useGetMe();
  const { data: categoriesData, isLoading: catLoading } = useListCategories();
  const createOrderMut = useCreateOrder();

  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  const form = useForm<z.infer<typeof orderSchema>>({
    resolver: zodResolver(orderSchema),
    defaultValues: { categoryId: "", link: "", quantity: 100 },
  });

  const selectedCategoryId = form.watch("categoryId");
  const selectedServiceId = form.watch("serviceId");
  const quantity = form.watch("quantity");

  // Compute platforms from categories
  const platforms = useMemo(() => {
    const cats = categoriesData?.categories || [];
    const platformSet = new Set<string>();
    cats.forEach(c => platformSet.add(detectPlatform(c.name)));
    return Array.from(platformSet).sort((a, b) => {
      const order = ["Instagram", "Facebook", "TikTok", "YouTube", "Twitter/X", "Telegram"];
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [categoriesData]);

  // Filter categories by platform
  const filteredCategories = useMemo(() => {
    const cats = categoriesData?.categories || [];
    if (!selectedPlatform) return cats;
    return cats.filter(c => detectPlatform(c.name) === selectedPlatform);
  }, [categoriesData, selectedPlatform]);

  // Lazy load services only when category is selected
  const { data: servicesData, isLoading: srvLoading } = useQuery({
    queryKey: ["services-by-category", selectedCategoryId],
    queryFn: async () => {
      if (!selectedCategoryId) return { services: [] };
      const res = await fetch(`${BASE}/api/services?categoryId=${selectedCategoryId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Lỗi tải dịch vụ");
      return res.json();
    },
    enabled: !!selectedCategoryId,
    staleTime: 2 * 60 * 1000,
  });

  const filteredServices = servicesData?.services || [];

  // Reset service when category changes
  useEffect(() => {
    form.setValue("serviceId", 0 as any);
  }, [selectedCategoryId, form]);

  // Auto-select first service
  useEffect(() => {
    if (filteredServices.length > 0 && (!selectedServiceId || selectedServiceId === 0)) {
      form.setValue("serviceId", filteredServices[0].id);
    }
  }, [filteredServices]);

  const selectedService = useMemo(() => {
    if (!selectedServiceId || selectedServiceId === 0) return null;
    return filteredServices.find((s: any) => s.id === selectedServiceId) || null;
  }, [filteredServices, selectedServiceId]);

  const price = useMemo(() => {
    if (!selectedService || !quantity) return 0;
    return (quantity / 1000) * Number(selectedService.rate);
  }, [selectedService, quantity]);

  const onSubmit = (values: z.infer<typeof orderSchema>) => {
    if (selectedService && (values.quantity < selectedService.min || values.quantity > selectedService.max)) {
      toast({ variant: "destructive", title: "Số lượng không hợp lệ", description: `Phải từ ${formatNumber(selectedService.min)} đến ${formatNumber(selectedService.max)}` });
      return;
    }
    if (user && price > Number(user.balance)) {
      toast({ variant: "destructive", title: "Số dư không đủ", description: "Nạp thêm tiền để đặt hàng." });
      return;
    }
    createOrderMut.mutate({ data: { serviceId: values.serviceId, link: values.link, quantity: values.quantity } }, {
      onSuccess: () => {
        toast({ title: "Đặt hàng thành công!", description: "Đơn hàng đang được xử lý." });
        setLocation("/orders");
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Đặt hàng thất bại", description: err.message });
      },
    });
  };

  return (
    <div className={cn("grid grid-cols-1 gap-6", compact ? "" : "lg:grid-cols-3")}>
      <div className={compact ? "" : "lg:col-span-2 space-y-4"}>
        {/* Platform Selector */}
        {!catLoading && platforms.length > 0 && (
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Chọn nền tảng</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => { setSelectedPlatform(null); form.setValue("categoryId", ""); }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all",
                    !selectedPlatform
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-muted hover:bg-muted/80 text-foreground"
                  )}
                >
                  🌐 <span>Tất cả</span>
                </button>
                {platforms.map(platform => (
                  <button
                    key={platform}
                    onClick={() => {
                      setSelectedPlatform(platform);
                      form.setValue("categoryId", "");
                    }}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all",
                      selectedPlatform === platform
                        ? `bg-gradient-to-r ${PLATFORM_COLORS[platform] || "from-gray-500 to-gray-600"} text-white shadow-md`
                        : "bg-muted hover:bg-muted/80 text-foreground"
                    )}
                  >
                    {PLATFORM_EMOJIS[platform] || "📦"} <span>{platform}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Order Form */}
        <Card className="shadow-md border-border/60">
          <CardHeader className="bg-secondary/30 border-b border-border/50 rounded-t-2xl pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-5 w-5 text-primary" /> Chi tiết đơn hàng
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 md:p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

                {/* Category */}
                <FormField control={form.control} name="categoryId" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Danh mục</FormLabel>
                    <Select
                      onValueChange={(val) => { field.onChange(val); }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="h-11 bg-background border-input">
                          <SelectValue placeholder={catLoading ? "Đang tải..." : selectedPlatform ? `Chọn danh mục ${selectedPlatform}` : "Chọn danh mục"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-72">
                        {filteredCategories.filter(c => c.active).map(cat => (
                          <SelectItem key={cat.id} value={cat.id.toString()}>
                            {cat.name}
                            {(cat as any).serviceCount > 0 && (
                              <span className="ml-2 text-xs text-muted-foreground">({(cat as any).serviceCount} dịch vụ)</span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Service - lazy loaded */}
                <FormField control={form.control} name="serviceId" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Dịch vụ</FormLabel>
                    <Select
                      disabled={!selectedCategoryId || srvLoading}
                      onValueChange={(val) => field.onChange(parseInt(val))}
                      value={field.value?.toString() || ""}
                    >
                      <FormControl>
                        <SelectTrigger className="h-11 bg-background border-input">
                          {srvLoading ? (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Đang tải dịch vụ...</span>
                            </div>
                          ) : (
                            <SelectValue placeholder={
                              !selectedCategoryId ? "Chọn danh mục trước" :
                              filteredServices.length === 0 ? "Không có dịch vụ" :
                              "Chọn dịch vụ"
                            } />
                          )}
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-72">
                        {filteredServices.map((srv: any) => (
                          <SelectItem key={srv.id} value={srv.id.toString()}>
                            <span className="font-mono text-xs text-muted-foreground mr-2">#{srv.id}</span>
                            {srv.name}
                            <span className="ml-2 text-xs text-primary font-medium">${Number(srv.rate).toFixed(3)}/1K</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Link */}
                <FormField control={form.control} name="link" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Link</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder={selectedService?.type === "Custom Comments" ? "Nhập nội dung..." : "https://..."}
                          className="h-11 pl-9 bg-background"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Quantity + Total */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="quantity" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold">Số lượng</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input type="number" className="h-11 pl-9 bg-background font-mono" {...field} />
                        </div>
                      </FormControl>
                      {selectedService && (
                        <FormDescription className="text-xs">
                          Min: {formatNumber(selectedService.min)} / Max: {formatNumber(selectedService.max)}
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="flex flex-col justify-between pt-0.5">
                    <label className="text-sm font-semibold text-foreground mb-1.5">Tổng tiền</label>
                    <div className="h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xl font-display">
                      ${price.toFixed(4)}
                    </div>
                    {selectedService && (
                      <p className="text-xs text-muted-foreground mt-1">Rate: ${Number(selectedService.rate).toFixed(4)}/1K</p>
                    )}
                  </div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full text-base shadow-md shadow-primary/20"
                  disabled={createOrderMut.isPending || !selectedService || !quantity || !form.watch("link")}
                >
                  {createOrderMut.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Đang xử lý...</> : "Đặt hàng ngay"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      {/* Service Details Panel */}
      {!compact && (
        <div>
          <Card className="shadow-md border-border/60 sticky top-24">
            <CardHeader className="bg-primary text-primary-foreground rounded-t-2xl pb-4">
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <Info className="h-5 w-5" /> Chi tiết dịch vụ
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!selectedService ? (
                <div className="p-8 text-center text-muted-foreground space-y-2">
                  <Zap className="w-10 h-10 mx-auto opacity-20" />
                  <p className="text-sm">Chọn dịch vụ để xem thông tin chi tiết</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  <div className="p-4 bg-secondary/20">
                    <p className="text-xs font-semibold text-primary mb-1">ID #{selectedService.id}</p>
                    <p className="text-foreground font-medium text-sm leading-snug">{selectedService.name}</p>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Giá/1000</p>
                      <p className="font-bold text-lg text-foreground">${Number(selectedService.rate).toFixed(4)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Thời gian</p>
                      <div className="flex items-center gap-1.5 text-foreground font-medium text-sm">
                        <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">{selectedService.averageTime || 'Không xác định'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase mb-1">Min</p>
                      <p className="font-semibold">{formatNumber(selectedService.min)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase mb-1">Max</p>
                      <p className="font-semibold">{formatNumber(selectedService.max)}</p>
                    </div>
                  </div>
                  <div className="p-4 flex flex-wrap gap-2">
                    <Badge variant={selectedService.refill ? "success" : "secondary"} className="text-xs py-1 px-2">
                      <RefreshCw className="w-3 h-3 mr-1" />
                      {selectedService.refill ? "Có Refill" : "Không Refill"}
                    </Badge>
                    <Badge variant={selectedService.cancel ? "outline" : "secondary"} className="text-xs py-1 px-2 border-muted-foreground/30">
                      <XCircle className="w-3 h-3 mr-1 text-muted-foreground" />
                      {selectedService.cancel ? "Hủy được" : "Không hủy"}
                    </Badge>
                  </div>
                  {selectedService.description && (
                    <div className="p-4 bg-muted/30">
                      <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{selectedService.description}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lazy Load info badge */}
          {selectedCategoryId && (
            <div className="mt-3 p-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                ⚡ Lazy Load: Chỉ tải {filteredServices.length} dịch vụ của danh mục này. Tiết kiệm ~90% băng thông.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
