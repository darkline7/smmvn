import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useListServices, useListCategories } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { Search, ArrowRight, CheckCircle2, XCircle, Layers, RefreshCw } from "lucide-react";

export default function PublicServices() {
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const { data: catData } = useListCategories();
  const { data: srvData, isLoading } = useListServices();

  const filtered = useMemo(() => {
    let list = (srvData?.services || []).filter(s => s.status === "active");
    if (selectedCat !== "all") list = list.filter(s => s.categoryId?.toString() === selectedCat);
    if (search) list = list.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [srvData, selectedCat, search]);

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Layers className="w-4 h-4 text-white" />
            </div>
            SMM Pro
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login"><Button variant="ghost">Đăng nhập</Button></Link>
            <Link href="/register"><Button>Đăng ký miễn phí</Button></Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-3">Bảng giá dịch vụ</h1>
          <p className="text-muted-foreground text-lg mb-2">
            {srvData?.services?.filter(s => s.status === "active").length || 0} dịch vụ chất lượng cao — Tự động 24/7
          </p>
          <div className="max-w-md mx-auto mt-6 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input placeholder="Tìm dịch vụ..." className="pl-10 h-12" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-center mb-8">
          <button onClick={() => setSelectedCat("all")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedCat === "all" ? "bg-primary text-primary-foreground shadow-md shadow-primary/30" : "bg-muted hover:bg-muted/80 text-foreground"}`}>
            🌐 Tất cả
          </button>
          {catData?.categories?.map(c => (
            <button key={c.id} onClick={() => setSelectedCat(c.id.toString())}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedCat === c.id.toString() ? "bg-primary text-primary-foreground shadow-md shadow-primary/30" : "bg-muted hover:bg-muted/80 text-foreground"}`}>
              {c.icon} {c.name}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid gap-4">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl"></div>)}</div>
        ) : (
          <div className="rounded-2xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left p-4 text-muted-foreground font-medium w-16">ID</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Tên dịch vụ</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">Giá/1.000</th>
                  <th className="text-right p-4 text-muted-foreground font-medium hidden sm:table-cell">Min</th>
                  <th className="text-right p-4 text-muted-foreground font-medium hidden sm:table-cell">Max</th>
                  <th className="text-center p-4 text-muted-foreground font-medium hidden md:table-cell">Refill</th>
                  <th className="text-center p-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-4 font-mono text-xs text-muted-foreground">#{s.id}</td>
                    <td className="p-4">
                      <p className="font-medium">{s.name}</p>
                      {s.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{s.description}</p>}
                    </td>
                    <td className="p-4 text-right font-bold text-primary">{formatCurrency(Number(s.rate))}</td>
                    <td className="p-4 text-right text-muted-foreground hidden sm:table-cell">{s.min?.toLocaleString()}</td>
                    <td className="p-4 text-right text-muted-foreground hidden sm:table-cell">{s.max?.toLocaleString()}</td>
                    <td className="p-4 text-center hidden md:table-cell">
                      {s.refill ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-muted-foreground/30 mx-auto" />}
                    </td>
                    <td className="p-4 text-center">
                      <Link href="/register">
                        <Button size="sm" className="h-8 text-xs gap-1">Đặt ngay <ArrowRight className="w-3 h-3" /></Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="text-center mt-16 py-12 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20 rounded-2xl border">
          <h2 className="text-3xl font-bold mb-3">Sẵn sàng bắt đầu?</h2>
          <p className="text-muted-foreground mb-6">Đăng ký miễn phí và nhận $0 để trải nghiệm dịch vụ</p>
          <Link href="/register"><Button size="lg" className="gap-2">Tạo tài khoản miễn phí <ArrowRight className="w-5 h-5" /></Button></Link>
        </div>
      </div>
    </div>
  );
}
