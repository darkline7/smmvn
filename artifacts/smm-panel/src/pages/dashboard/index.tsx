import { useGetDashboardStats, useGetDashboardChart, useListOrders } from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Wallet, ShoppingCart, CheckCircle2, TrendingUp, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { NewOrderForm } from "@/components/new-order-form";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const STATUS_LABELS: Record<string, string> = {
  pending: "Chờ xử lý",
  processing: "Đang xử lý",
  active: "Đang hoạt động",
  completed: "Hoàn thành",
  partial: "Một phần",
  cancelled: "Đã hủy",
  failed: "Thất bại",
};

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: chartData, isLoading: chartLoading } = useGetDashboardChart({ period: "30d" });
  const { data: recentOrdersData, isLoading: ordersLoading } = useListOrders({ limit: 5 });

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

  const chartPoints = (chartData?.data || []).map((d: any) => ({
    date: d.date ? format(new Date(d.date), "dd/MM") : "",
    chi: Number(d.spend || 0),
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const usd = payload[0]?.value || 0;
    return (
      <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
        <p className="text-muted-foreground mb-1">{label}</p>
        <p className="font-semibold text-foreground">{Math.ceil(usd * vndRate).toLocaleString("vi-VN")}đ</p>
        <p className="text-muted-foreground">${usd.toFixed(3)}</p>
      </div>
    );
  };

  const StatCard = ({ title, value, icon: Icon, description, colorClass }: any) => (
    <Card className="border-border/50 shadow-sm hover:shadow-md transition-all duration-300 group overflow-hidden relative">
      <div
        className={`absolute top-0 right-0 w-28 h-28 bg-gradient-to-br ${colorClass} opacity-5 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-700`}
      />
      <CardContent className="p-4 sm:p-5 relative z-10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-muted-foreground text-xs sm:text-sm">{title}</h3>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-secondary flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display tracking-tight text-foreground">{value}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="space-y-4 pb-4 animate-in fade-in duration-500">

        {/* Section 1: Stats */}
        {statsLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-secondary animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              title="Số dư"
              value={formatCurrency(stats.balance, stats.currency)}
              icon={Wallet}
              description="Sẵn sàng đặt hàng"
              colorClass="from-primary to-accent"
            />
            <StatCard
              title="Tổng đơn hàng"
              value={formatNumber(stats.totalOrders)}
              icon={ShoppingCart}
              description="Tổng đơn đã đặt"
              colorClass="from-blue-500 to-cyan-500"
            />
            <StatCard
              title="Hoàn thành"
              value={formatNumber(stats.completedOrders)}
              icon={CheckCircle2}
              description="Đã giao thành công"
              colorClass="from-success to-emerald-500"
            />
            <StatCard
              title="Chi tháng này"
              value={formatCurrency(stats.monthlySpend, stats.currency)}
              icon={TrendingUp}
              description="30 ngày qua"
              colorClass="from-purple-500 to-pink-500"
            />
          </div>
        ) : null}

        {/* Section 2: Order Form + Chart & Recent Orders */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 items-start">

          {/* Order Form */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pt-4 px-5 border-b border-border/30 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-primary" />
                <CardTitle className="text-base font-semibold font-display">Đặt hàng mới</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
              <NewOrderForm />
            </CardContent>
          </Card>

          {/* Right column: Chart + Recent Orders */}
          <div className="flex flex-col gap-4">

            {/* Recharts spending chart */}
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold">Chi tiêu 30 ngày qua</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {chartLoading ? (
                  <div className="h-[130px] bg-secondary/40 animate-pulse rounded-xl" />
                ) : chartPoints.length === 0 ? (
                  <div className="h-[130px] flex items-center justify-center text-sm text-muted-foreground border border-dashed rounded-xl">
                    Chưa có dữ liệu chi tiêu
                  </div>
                ) : (
                  <div className="h-[130px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartPoints} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                        <defs>
                          <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                          tickLine={false}
                          axisLine={false}
                          interval={4}
                        />
                        <YAxis
                          tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => `$${v}`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="chi"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          fill="url(#spendGrad)"
                          dot={false}
                          activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Orders */}
            <Card className="border-border/50 shadow-sm flex flex-col">
              <CardHeader className="pb-2 pt-4 px-4 border-b border-border/30">
                <CardTitle className="text-sm font-semibold">Đơn hàng gần đây</CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex-1">
                {ordersLoading ? (
                  <div className="p-4 space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-9 bg-secondary animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : (recentOrdersData?.orders || []).length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground flex flex-col items-center">
                    <Clock className="h-7 w-7 mb-2 opacity-20" />
                    <p className="text-sm">Chưa có đơn hàng nào</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/40">
                    {recentOrdersData?.orders.map((order) => {
                      const chargeUsd = Number(order.charge || 0);
                      const chargeVnd = Math.ceil(chargeUsd * vndRate);
                      return (
                        <div
                          key={order.id}
                          className="px-4 py-2.5 hover:bg-muted/40 transition-colors flex justify-between items-center gap-3"
                        >
                          <div className="overflow-hidden flex-1 min-w-0">
                            <p className="text-xs font-mono font-semibold text-primary">#{order.id}</p>
                            <p className="text-xs text-muted-foreground truncate">{order.serviceName}</p>
                          </div>
                          <div className="text-right shrink-0 space-y-0.5">
                            <Badge
                              variant={
                                order.status === "completed"
                                  ? "success"
                                  : order.status === "pending" || order.status === "processing"
                                  ? "warning"
                                  : order.status === "cancelled" || order.status === "failed"
                                  ? "destructive"
                                  : "default"
                              }
                              className="text-xs block text-center capitalize"
                            >
                              {STATUS_LABELS[order.status] || order.status}
                            </Badge>
                            <p className="text-xs font-medium text-foreground tabular-nums">
                              {chargeVnd.toLocaleString("vi-VN")}đ
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
