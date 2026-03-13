import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useListServices, useListCategories } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { Search, ShoppingCart, RefreshCw, CheckCircle2, XCircle, Zap, Filter } from "lucide-react";

export default function ServicesList() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const { data: catData } = useListCategories();
  const { data: srvData, isLoading } = useListServices();

  const filtered = useMemo(() => {
    let list = srvData?.services || [];
    if (selectedCat !== "all") list = list.filter(s => s.categoryId?.toString() === selectedCat);
    if (search) list = list.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.id.toString().includes(search));
    return list;
  }, [srvData, selectedCat, search]);

  const grouped = useMemo(() => {
    const cats = catData?.categories || [];
    return cats.map(c => ({
      cat: c,
      services: filtered.filter(s => s.categoryId === c.id),
    })).filter(g => g.services.length > 0);
  }, [filtered, catData]);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6 pb-8 animate-in fade-in duration-500">
        <div>
          <h2 className="text-3xl font-bold font-display">Bảng giá dịch vụ</h2>
          <p className="text-muted-foreground mt-1">{srvData?.services?.filter(s => s.status === "active").length || 0} dịch vụ đang hoạt động</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Tìm kiếm dịch vụ..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => setSelectedCat("all")} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${selectedCat === "all" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80 text-foreground"}`}>
            Tất cả ({srvData?.services?.length || 0})
          </button>
          {catData?.categories?.map(c => (
            <button key={c.id} onClick={() => setSelectedCat(c.id.toString())}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${selectedCat === c.id.toString() ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80 text-foreground"}`}>
              {c.icon} {c.name}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-48 bg-muted animate-pulse rounded-xl"></div>)}</div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Filter className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Không tìm thấy dịch vụ phù hợp</p>
          </div>
        ) : grouped.map(({ cat, services }) => (
          <div key={cat.id}>
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
              <span>{cat.icon}</span>{cat.name}
              <Badge variant="secondary">{services.length} dịch vụ</Badge>
            </h3>
            <div className="overflow-x-auto rounded-xl border shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left p-3 text-muted-foreground font-medium w-12">ID</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Dịch vụ</th>
                    <th className="text-right p-3 text-muted-foreground font-medium">Giá/1K</th>
                    <th className="text-right p-3 text-muted-foreground font-medium">Min</th>
                    <th className="text-right p-3 text-muted-foreground font-medium">Max</th>
                    <th className="text-center p-3 text-muted-foreground font-medium">Refill</th>
                    <th className="text-center p-3 text-muted-foreground font-medium">Cancel</th>
                    <th className="text-center p-3 text-muted-foreground font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {services.map(s => (
                    <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3 font-mono text-muted-foreground">#{s.id}</td>
                      <td className="p-3">
                        <div>
                          <p className="font-medium text-foreground">{s.name}</p>
                          {s.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{s.description}</p>}
                        </div>
                      </td>
                      <td className="p-3 text-right font-bold text-primary">{formatCurrency(Number(s.rate))}</td>
                      <td className="p-3 text-right text-muted-foreground">{s.min?.toLocaleString()}</td>
                      <td className="p-3 text-right text-muted-foreground">{s.max?.toLocaleString()}</td>
                      <td className="p-3 text-center">{s.refill ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-muted-foreground/30 mx-auto" />}</td>
                      <td className="p-3 text-center">{s.cancel ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-muted-foreground/30 mx-auto" />}</td>
                      <td className="p-3 text-center">
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setLocation(`/new-order?service=${s.id}`)}>
                          <ShoppingCart className="w-3 h-3" />Đặt
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
