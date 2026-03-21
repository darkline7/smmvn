import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useListOrders, useRefillOrder, useCancelOrder } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search, RefreshCw, XCircle, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const STATUS_LABELS: Record<string, string> = {
  all: "Tất cả",
  pending: "Chờ xử lý",
  processing: "Đang xử lý",
  active: "Đang hoạt động",
  completed: "Hoàn thành",
  partial: "Một phần",
  cancelled: "Đã hủy",
  failed: "Thất bại",
};

export default function Orders() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const [status, setStatus] = useState<string>(params.get("status") || "all");
  const [search, setSearch] = useState(params.get("search") || "");
  const [page, setPage] = useState(Number(params.get("page") || "1"));

  const PAGE_SIZE = 20;

  useEffect(() => {
    const qs = new URLSearchParams();
    if (status !== "all") qs.set("status", status);
    if (search) qs.set("search", search);
    if (page > 1) qs.set("page", String(page));
    const str = qs.toString();
    const newPath = `/orders${str ? `?${str}` : ""}`;
    if (window.location.pathname + window.location.search !== newPath) {
      window.history.replaceState(null, "", newPath);
    }
  }, [status, search, page]);

  const { data, isLoading } = useListOrders({
    status: status !== "all" ? status as any : undefined,
    search: search || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const { data: publicSettings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/public/settings`);
      if (!r.ok) return null;
      return r.json();
    },
    staleTime: 5 * 60_000,
  });
  const vndRate = Number(publicSettings?.vndExchangeRate || 24000);

  const refillMut = useRefillOrder();
  const cancelMut = useCancelOrder();

  const handleRefill = (id: number) => {
    refillMut.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Yêu cầu hoàn trả đã gửi", description: `Đơn #${id} đang được xử lý hoàn trả.` });
        queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      },
      onError: (err) => toast({ variant: "destructive", title: "Lỗi", description: err.message }),
    });
  };

  const handleCancel = (id: number) => {
    cancelMut.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Yêu cầu hủy đã gửi", description: `Đơn #${id} đang chờ hủy.` });
        queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      },
      onError: (err) => toast({ variant: "destructive", title: "Lỗi", description: err.message }),
    });
  };

  const getStatusColor = (s: string) => {
    switch (s) {
      case "completed": return "success";
      case "processing": case "active": return "default";
      case "pending": return "warning";
      case "cancelled": case "failed": return "destructive";
      case "partial": return "secondary";
      default: return "outline";
    }
  };

  const totalPages = data?.totalPages || 1;

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleStatus = (val: string) => {
    setStatus(val);
    setPage(1);
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
        <div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground">Lịch sử đơn hàng</h2>
          <p className="text-muted-foreground mt-1">Theo dõi và quản lý tất cả đơn hàng của bạn.</p>
        </div>

        <Card className="shadow-md border-border/60">
          <CardHeader className="p-4 border-b border-border/50 bg-secondary/20">
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm theo ID đơn hoặc link..."
                  className="pl-9 h-10 bg-background"
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <Select value={status} onValueChange={handleStatus}>
                  <SelectTrigger className="w-full md:w-[200px] h-10 bg-background">
                    <SelectValue placeholder="Tất cả trạng thái" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead className="w-[60px]">ID</TableHead>
                  <TableHead className="w-[130px]">Ngày tạo</TableHead>
                  <TableHead className="min-w-[160px]">Dịch vụ</TableHead>
                  <TableHead className="min-w-[160px]">Link</TableHead>
                  <TableHead className="text-right w-[100px]">Phí</TableHead>
                  <TableHead className="text-center w-[70px]">Bắt đầu</TableHead>
                  <TableHead className="text-center w-[70px]">Số lượng</TableHead>
                  <TableHead className="text-center w-[70px]">Còn lại</TableHead>
                  <TableHead className="w-[110px]">Trạng thái</TableHead>
                  <TableHead className="text-right w-[80px]">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={10} className="h-16">
                        <div className="animate-pulse bg-secondary h-6 w-full rounded" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : data?.orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                      Không tìm thấy đơn hàng nào.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.orders.map((order) => {
                    const chargeUsd = Number(order.charge || 0);
                    const chargeVnd = Math.ceil(chargeUsd * vndRate);
                    return (
                      <TableRow key={order.id} className="group text-sm">
                        <TableCell className="font-mono font-semibold text-primary">#{order.id}</TableCell>
                        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                          {format(new Date(order.createdAt), "dd/MM/yy HH:mm")}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <span className="block truncate font-medium text-foreground text-xs" title={order.serviceName}>
                            {order.serviceName}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <a
                            href={order.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1 truncate w-fit max-w-full"
                            title={order.link}
                          >
                            {order.link} <ExternalLink className="h-3 w-3 inline shrink-0" />
                          </a>
                        </TableCell>
                        <TableCell className="text-right">
                          <p className="font-medium tabular-nums text-foreground text-xs">{chargeVnd.toLocaleString("vi-VN")}đ</p>
                          <p className="text-muted-foreground tabular-nums text-[10px]">${chargeUsd.toFixed(3)}</p>
                        </TableCell>
                        <TableCell className="text-center tabular-nums text-muted-foreground text-xs">{order.startCount ?? "—"}</TableCell>
                        <TableCell className="text-center tabular-nums font-medium text-xs">{order.quantity ?? "—"}</TableCell>
                        <TableCell className="text-center tabular-nums text-muted-foreground text-xs">{order.remains ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusColor(order.status) as any} className="capitalize text-xs px-2 py-0.5 shadow-sm whitespace-nowrap">
                            {STATUS_LABELS[order.status] || order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1 whitespace-nowrap">
                          {order.status === "completed" && (
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7 text-primary"
                              onClick={() => handleRefill(order.id)}
                              title="Yêu cầu hoàn trả"
                              disabled={refillMut.isPending}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {(order.status === "pending" || order.status === "processing") && (
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7 text-destructive"
                              onClick={() => handleCancel(order.id)}
                              title="Yêu cầu hủy"
                              disabled={cancelMut.isPending}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 bg-secondary/10">
              <p className="text-xs text-muted-foreground">
                Trang {page} / {totalPages} · Tổng {data?.total ?? 0} đơn
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 5) {
                    p = i + 1;
                  } else if (page <= 3) {
                    p = i + 1;
                  } else if (page >= totalPages - 2) {
                    p = totalPages - 4 + i;
                  } else {
                    p = page - 2 + i;
                  }
                  return (
                    <Button
                      key={p}
                      variant={p === page ? "default" : "outline"}
                      size="icon"
                      className="h-8 w-8 text-xs"
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
