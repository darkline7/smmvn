import { useGetDashboardStats, useGetDashboardChart, useListOrders } from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Wallet, ShoppingCart, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { NewOrderForm } from "@/components/new-order-form";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: chartData, isLoading: chartLoading } = useGetDashboardChart({ period: "30d" });
  const { data: recentOrdersData, isLoading: ordersLoading } = useListOrders({ limit: 5 });

  const StatCard = ({ title, value, icon: Icon, description, colorClass }: any) => (
    <Card className="border-border/50 shadow-sm hover:shadow-md transition-all duration-300 group overflow-hidden relative">
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${colorClass} opacity-5 rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-700 ease-out`}></div>
      <CardContent className="p-5 relative z-10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-muted-foreground text-sm">{title}</h3>
          <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <div className="space-y-0.5">
          <h2 className="text-2xl font-bold font-display tracking-tight text-foreground">{value}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-8 animate-in fade-in duration-500">

        {/* Stats Grid */}
        {statsLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-28 bg-secondary animate-pulse rounded-2xl"></div>)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Số dư" value={formatCurrency(stats.balance, stats.currency)} icon={Wallet} description="Sẵn sàng đặt hàng" colorClass="from-primary to-accent" />
            <StatCard title="Tổng đơn hàng" value={formatNumber(stats.totalOrders)} icon={ShoppingCart} description="Tổng đơn đã đặt" colorClass="from-blue-500 to-cyan-500" />
            <StatCard title="Hoàn thành" value={formatNumber(stats.completedOrders)} icon={CheckCircle2} description="Đã giao thành công" colorClass="from-success to-emerald-500" />
            <StatCard title="Chi tháng này" value={formatCurrency(stats.monthlySpend, stats.currency)} icon={TrendingUp} description="30 ngày qua" colorClass="from-purple-500 to-pink-500" />
          </div>
        ) : null}

        {/* Main Content: Order Form + Recent Orders */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Form - takes 2 cols */}
          <div className="lg:col-span-2">
            <div className="mb-3 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-bold font-display">Đặt hàng mới</h3>
            </div>
            <NewOrderForm />
          </div>

          {/* Right column: chart + recent orders */}
          <div className="space-y-4">
            {/* Spending Overview */}
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Chi tiêu 30 ngày</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[140px] w-full rounded-xl border border-dashed border-border bg-secondary/20 relative overflow-hidden">
                  {chartLoading ? (
                    <div className="animate-pulse flex space-x-1 items-end h-full w-full p-2">
                      {[40,70,45,90,65,85,30,60,100,50].map((h,i) => (
                        <div key={i} className="bg-primary/20 w-full rounded-t-sm" style={{ height: `${h}%` }}></div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex space-x-1 items-end h-full w-full p-2 pb-0">
                      {chartData?.data.map((d, i) => {
                        const spendVal = Number(d.spend) || 0;
                        const maxSpend = Math.max(...chartData.data.map(x => Number(x.spend) || 0));
                        const height = Math.max(8, maxSpend > 0 ? (spendVal / maxSpend) * 100 : 8);
                        return (
                          <div key={i} className="flex-1 group relative flex justify-center h-full items-end">
                            <div className="bg-primary/30 hover:bg-primary/70 transition-colors w-full rounded-t-sm relative" style={{ height: `${height}%` }}>
                              <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] py-0.5 px-1.5 rounded whitespace-nowrap z-20 pointer-events-none transition-opacity">
                                ${spendVal.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Orders */}
            <Card className="border-border/50 shadow-sm flex flex-col">
              <CardHeader className="pb-3 border-b border-border/30">
                <CardTitle className="text-sm font-semibold">Đơn hàng gần đây</CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-auto">
                {ordersLoading ? (
                  <div className="p-4 space-y-3">
                    {[1,2,3].map(i => <div key={i} className="h-10 bg-secondary animate-pulse rounded-lg"></div>)}
                  </div>
                ) : (recentOrdersData?.orders || []).length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                    <Clock className="h-8 w-8 mb-2 opacity-20" />
                    <p className="text-sm">Chưa có đơn hàng</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {recentOrdersData?.orders.map(order => (
                      <div key={order.id} className="px-4 py-3 hover:bg-muted/40 transition-colors flex justify-between items-center gap-2">
                        <div className="overflow-hidden flex-1">
                          <p className="text-xs font-medium truncate text-foreground">#{order.id}</p>
                          <p className="text-xs text-muted-foreground truncate">{order.serviceName}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <Badge variant={
                            order.status === 'completed' ? 'success' :
                            order.status === 'pending' || order.status === 'processing' ? 'warning' :
                            order.status === 'cancelled' || order.status === 'failed' ? 'destructive' : 'default'
                          } className="text-xs capitalize mb-1">
                            {order.status}
                          </Badge>
                          <p className="text-xs font-medium">${Number(order.charge || 0).toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
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
