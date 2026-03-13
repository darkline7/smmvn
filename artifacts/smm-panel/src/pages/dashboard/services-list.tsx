import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListServices, useListCategories } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { Search, ShoppingCart, CheckCircle2, XCircle, Filter, ChevronDown, ChevronUp } from "lucide-react";

// Platform detection (same as new-order-form)
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

export default function ServicesList() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [expandedCats, setExpandedCats] = useState<Set<number>>(new Set());

  const { data: catData } = useListCategories();
  const { data: srvData, isLoading } = useListServices();

  // Compute platforms from categories
  const platforms = useMemo(() => {
    const cats = catData?.categories || [];
    const pSet = new Set<string>();
    cats.forEach(c => pSet.add(detectPlatform(c.name)));
    return Array.from(pSet).sort((a, b) => {
      const order = ["Instagram", "Facebook", "TikTok", "YouTube", "Twitter/X", "Telegram"];
      const ai = order.indexOf(a), bi = order.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1; if (bi === -1) return -1; return ai - bi;
    });
  }, [catData]);

  // Filter categories by platform
  const filteredCats = useMemo(() => {
    const cats = catData?.categories || [];
    if (selectedPlatform === "all") return cats;
    return cats.filter(c => detectPlatform(c.name) === selectedPlatform);
  }, [catData, selectedPlatform]);

  // Filter services
  const filtered = useMemo(() => {
    let list = srvData?.services || [];
    if (selectedPlatform !== "all") {
      const catIds = new Set(filteredCats.map(c => c.id));
      list = list.filter(s => catIds.has(s.categoryId));
    }
    if (selectedCat !== "all") list = list.filter(s => s.categoryId?.toString() === selectedCat);
    if (search) list = list.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.id.toString().includes(search));
    return list;
  }, [srvData, selectedPlatform, selectedCat, search, filteredCats]);

  const grouped = useMemo(() => {
    const cats = catData?.categories || [];
    return cats.map(c => ({
      cat: c,
      services: filtered.filter(s => s.categoryId === c.id),
    })).filter(g => g.services.length > 0);
  }, [filtered, catData]);

  const toggleCat = (id: number) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalActive = srvData?.services?.filter(s => s.status === "active").length || 0;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-5 pb-8 animate-in fade-in duration-500">
        <div>
          <h2 className="text-3xl font-bold font-display">Bảng giá dịch vụ</h2>
          <p className="text-muted-foreground mt-1">{totalActive.toLocaleString()} dịch vụ đang hoạt động</p>
        </div>

        {/* Search + Category Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Tìm kiếm dịch vụ, ID..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={selectedCat} onValueChange={setSelectedCat}>
            <SelectTrigger className="w-full sm:w-56 bg-background">
              <SelectValue placeholder="Tất cả danh mục" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả danh mục</SelectItem>
              {filteredCats.map(c => (
                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Platform Filter */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setSelectedPlatform("all"); setSelectedCat("all"); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${selectedPlatform === "all" ? "bg-primary text-primary-foreground shadow-md" : "bg-muted hover:bg-muted/80 text-foreground"}`}
          >
            🌐 Tất cả ({totalActive.toLocaleString()})
          </button>
          {platforms.map(platform => {
            const count = (catData?.categories || [])
              .filter(c => detectPlatform(c.name) === platform)
              .reduce((acc, c) => acc + ((c as any).serviceCount || 0), 0);
            return (
              <button
                key={platform}
                onClick={() => { setSelectedPlatform(platform); setSelectedCat("all"); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${selectedPlatform === platform ? "bg-primary text-primary-foreground shadow-md" : "bg-muted hover:bg-muted/80 text-foreground"}`}
              >
                {PLATFORM_EMOJIS[platform] || "📦"} {platform} {count > 0 && <span className="opacity-70">({count.toLocaleString()})</span>}
              </button>
            );
          })}
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-40 bg-muted animate-pulse rounded-xl"></div>)}</div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Filter className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Không tìm thấy dịch vụ phù hợp</p>
          </div>
        ) : grouped.map(({ cat, services }) => {
          const isExpanded = expandedCats.has(cat.id);
          const displayServices = isExpanded ? services : services.slice(0, 5);
          return (
            <div key={cat.id}>
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-base font-bold flex items-center gap-1.5">
                  {cat.name}
                  <Badge variant="secondary" className="text-xs">{services.length}</Badge>
                </h3>
              </div>
              <div className="overflow-x-auto rounded-xl border shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left p-3 text-muted-foreground font-medium w-12">ID</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Dịch vụ</th>
                      <th className="text-right p-3 text-muted-foreground font-medium">Giá/1K</th>
                      <th className="text-right p-3 text-muted-foreground font-medium hidden sm:table-cell">Min</th>
                      <th className="text-right p-3 text-muted-foreground font-medium hidden sm:table-cell">Max</th>
                      <th className="text-center p-3 text-muted-foreground font-medium hidden md:table-cell">Refill</th>
                      <th className="text-center p-3 text-muted-foreground font-medium hidden md:table-cell">Cancel</th>
                      <th className="text-center p-3 text-muted-foreground font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {displayServices.map(s => (
                      <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3 font-mono text-muted-foreground text-xs">#{s.id}</td>
                        <td className="p-3">
                          <div>
                            <p className="font-medium text-foreground text-sm">{s.name}</p>
                            {s.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{s.description}</p>}
                          </div>
                        </td>
                        <td className="p-3 text-right font-bold text-primary text-sm">{formatCurrency(Number(s.rate))}</td>
                        <td className="p-3 text-right text-muted-foreground text-xs hidden sm:table-cell">{s.min?.toLocaleString()}</td>
                        <td className="p-3 text-right text-muted-foreground text-xs hidden sm:table-cell">{s.max?.toLocaleString()}</td>
                        <td className="p-3 text-center hidden md:table-cell">{s.refill ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-muted-foreground/30 mx-auto" />}</td>
                        <td className="p-3 text-center hidden md:table-cell">{s.cancel ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-muted-foreground/30 mx-auto" />}</td>
                        <td className="p-3 text-center">
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setLocation(`/new-order`)}>
                            <ShoppingCart className="w-3 h-3" />Đặt
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {services.length > 5 && (
                  <button
                    onClick={() => toggleCat(cat.id)}
                    className="w-full py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors flex items-center justify-center gap-1 border-t"
                  >
                    {isExpanded ? <><ChevronUp className="w-3.5 h-3.5" />Thu gọn</> : <><ChevronDown className="w-3.5 h-3.5" />Xem thêm {services.length - 5} dịch vụ</>}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
