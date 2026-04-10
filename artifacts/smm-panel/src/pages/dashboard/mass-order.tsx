import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListServices, useGetMe, useGetBalance } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Zap, AlertCircle, CheckCircle2, Clock, Upload, Info } from "lucide-react";

export default function MassOrder() {
  const { toast } = useToast();
  const { data: me } = useGetMe();
  const { data: balance } = useGetBalance();
  const { data: servicesData } = useListServices();
  const [serviceId, setServiceId] = useState<string>("");
  const [bulkText, setBulkText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<Array<{ link: string; quantity: number; status: "pending" | "success" | "error"; orderId?: number; error?: string }>>([]);

  const service = useMemo(() => servicesData?.services?.find(s => s.id.toString() === serviceId), [servicesData, serviceId]);

  const parsedLines = useMemo(() => {
    return bulkText.split("\n").map(line => line.trim()).filter(Boolean).map(line => {
      const parts = line.split("|");
      if (parts.length >= 2) {
        return { link: parts[0].trim(), quantity: parseInt(parts[1].trim(), 10) || (service?.min || 100) };
      }
      return { link: line, quantity: service?.min || 100 };
    });
  }, [bulkText, service]);

  const totalCost = useMemo(() => {
    if (!service) return 0;
    return parsedLines.reduce((sum, line) => sum + (Number(service.rate) * line.quantity / 1000), 0);
  }, [parsedLines, service]);

  const handleSubmit = async () => {
    if (!serviceId || parsedLines.length === 0) return;
    if (totalCost > (balance?.balance || 0)) {
      toast({ title: "Số dư không đủ", description: `Cần ${formatCurrency(totalCost)}, số dư ${formatCurrency(balance?.balance || 0)}`, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const initialResults = parsedLines.map(l => ({ ...l, status: "pending" as const }));
    setResults(initialResults);
    const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
    try {
      const res = await fetch(`${BASE}/api/orders/mass`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          orders: parsedLines.map((line) => ({
            serviceId: parseInt(serviceId, 10),
            link: line.link,
            quantity: line.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const mapped = parsedLines.map((line, index) => {
        const result = data.results?.find((item: any) => item.index === index);
        if (!result) return { ...line, status: "error" as const, error: "Không nhận được kết quả từ máy chủ" };
        if (result.success) return { ...line, status: "success" as const, orderId: result.orderId };
        return { ...line, status: "error" as const, error: result.error || "Tạo đơn thất bại" };
      });
      setResults(mapped);
      toast({
        title: "Hoàn thành đặt hàng hàng loạt!",
        description: `${mapped.filter((item) => item.status === "success").length}/${mapped.length} đơn thành công`,
      });
    } catch (e: any) {
      toast({ title: "Lỗi đặt hàng hàng loạt", description: e.message, variant: "destructive" });
    }
    setSubmitting(false);
  };

  const successCount = results.filter(r => r.status === "success").length;
  const errorCount = results.filter(r => r.status === "error").length;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 pb-8 animate-in fade-in duration-500">
        <div>
          <h2 className="text-3xl font-bold font-display">Đặt hàng hàng loạt</h2>
          <p className="text-muted-foreground mt-1">Đặt nhiều đơn hàng cùng lúc với cùng một dịch vụ</p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Định dạng:</strong> Mỗi dòng một đơn. Có thể dùng:
            <code className="ml-1 px-1 py-0.5 bg-blue-100 dark:bg-blue-900 rounded text-xs">link</code> hoặc
            <code className="ml-1 px-1 py-0.5 bg-blue-100 dark:bg-blue-900 rounded text-xs">link|quantity</code>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Cấu hình đơn hàng</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Dịch vụ</label>
                <Select value={serviceId} onValueChange={setServiceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn dịch vụ..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {servicesData?.services?.filter(s => s.status === "active").map(s => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        <span className="text-sm">[#{s.id}] {s.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {service && (
                <div className="p-3 rounded-xl bg-muted space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Giá</span><span className="font-medium">{formatCurrency(Number(service.rate))} / 1K</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Tối thiểu</span><span className="font-medium">{service.min?.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Tối đa</span><span className="font-medium">{service.max?.toLocaleString()}</span></div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Danh sách link</label>
                <Textarea
                  placeholder={"https://instagram.com/user1\nhttps://instagram.com/user2|500\nhttps://instagram.com/user3|1000"}
                  rows={10} value={bulkText} onChange={e => setBulkText(e.target.value)}
                  className="font-mono text-sm resize-none"
                />
              </div>

              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Tổng đơn</span><span className="font-bold">{parsedLines.length}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tổng chi phí</span><span className="font-bold text-primary">{formatCurrency(totalCost)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Số dư</span><span className={`font-bold ${totalCost > (balance?.balance || 0) ? "text-red-500" : "text-green-500"}`}>{formatCurrency(balance?.balance || 0)}</span></div>
              </div>

              <Button className="w-full gap-2" size="lg" onClick={handleSubmit}
                disabled={!serviceId || parsedLines.length === 0 || submitting || totalCost > (balance?.balance || 0)}>
                <Zap className="w-5 h-5" />
                {submitting ? `Đang đặt... (${successCount + errorCount}/${parsedLines.length})` : `Đặt ${parsedLines.length} đơn hàng`}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                Kết quả
                {results.length > 0 && (
                  <div className="flex gap-2 text-sm">
                    <Badge variant="outline" className="text-green-600 border-green-200">{successCount} thành công</Badge>
                    {errorCount > 0 && <Badge variant="outline" className="text-red-600 border-red-200">{errorCount} lỗi</Badge>}
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {results.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Upload className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Kết quả sẽ hiển thị ở đây</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {results.map((r, i) => (
                    <div key={i} className={`flex items-center gap-3 p-3 rounded-xl text-sm border ${r.status === "success" ? "bg-green-50 border-green-200 dark:bg-green-950/20" : r.status === "error" ? "bg-red-50 border-red-200 dark:bg-red-950/20" : "bg-muted border-transparent"}`}>
                      {r.status === "pending" && <Clock className="w-4 h-4 text-yellow-500 flex-shrink-0 animate-pulse" />}
                      {r.status === "success" && <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}
                      {r.status === "error" && <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-mono text-xs">{r.link}</p>
                        {r.orderId && <p className="text-xs text-green-600">Đơn #{r.orderId}</p>}
                        {r.error && <p className="text-xs text-red-600">{r.error}</p>}
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">×{r.quantity}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
