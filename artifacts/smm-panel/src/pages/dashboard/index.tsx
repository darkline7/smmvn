import { useGetDashboardStats, useGetDashboardChart, useListOrders } from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Wallet, ShoppingCart, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: chartData, isLoading: chartLoading } = useGetDashboardChart({ period: "30d" });
  const { data: recentOrdersData, isLoading: ordersLoading } = useListOrders({ limit: 5 });

  const StatCard = ({ title, value, icon: Icon, description, colorClass }: any) => (
    <Card className="border-border/50 shadow-sm hover:shadow-md transition-all duration-300 group overflow-hidden relative">
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${colorClass} opacity-5 rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-700 ease-out`}></div>
      <CardContent className="p-6 relative z-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-muted-foreground">{title}</h3>
          <div className={`w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-primary group-hover:scale-110 transition-transform`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        <div className="space-y-1">
          <h2 className="text-3xl font-bold font-display tracking-tight text-foreground">{value}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-8 animate-in fade-in duration-500">
        
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-display font-bold text-foreground">Overview</h2>
            <p className="text-muted-foreground mt-1 text-lg">Here's what's happening with your account today.</p>
          </div>
        </div>

        {/* Stats Grid */}
        {statsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1,2,3,4].map(i => <div key={i} className="h-36 bg-secondary animate-pulse rounded-2xl"></div>)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard 
              title="Current Balance" 
              value={formatCurrency(stats.balance, stats.currency)} 
              icon={Wallet} 
              description="Available for new orders"
              colorClass="from-primary to-accent"
            />
            <StatCard 
              title="Total Orders" 
              value={formatNumber(stats.totalOrders)} 
              icon={ShoppingCart} 
              description="Lifetime orders placed"
              colorClass="from-blue-500 to-cyan-500"
            />
            <StatCard 
              title="Completed" 
              value={formatNumber(stats.completedOrders)} 
              icon={CheckCircle2} 
              description="Orders fully delivered"
              colorClass="from-success to-emerald-500"
            />
            <StatCard 
              title="Monthly Spend" 
              value={formatCurrency(stats.monthlySpend, stats.currency)} 
              icon={TrendingUp} 
              description="Spent in the last 30 days"
              colorClass="from-purple-500 to-pink-500"
            />
          </div>
        ) : null}

        {/* Two Column Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Chart Placeholder (Recharts could be implemented here, using a CSS placeholder for visual demo) */}
          <Card className="col-span-1 lg:col-span-2 border-border/50 shadow-md">
            <CardHeader>
              <CardTitle>Spending Overview</CardTitle>
              <CardDescription>Your account activity over the last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full bg-secondary/30 rounded-xl border border-dashed border-border flex items-center justify-center relative overflow-hidden">
                {chartLoading ? (
                  <div className="animate-pulse flex space-x-4 items-end h-full w-full p-4">
                    {[40, 70, 45, 90, 65, 85, 30, 60, 100, 50].map((h, i) => (
                      <div key={i} className="bg-primary/20 w-full rounded-t-sm" style={{ height: `${h}%` }}></div>
                    ))}
                  </div>
                ) : (
                   <div className="flex space-x-2 items-end h-full w-full p-4 pb-0">
                    {chartData?.data.map((d, i) => {
                      const maxSpend = Math.max(...chartData.data.map(x => x.spend));
                      const height = Math.max(10, (d.spend / maxSpend) * 100);
                      return (
                        <div key={i} className="flex-1 group relative flex justify-center h-full items-end">
                           <div className="bg-primary/20 hover:bg-primary/60 transition-colors w-full rounded-t-md relative" style={{ height: `${height}%` }}>
                              <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs py-1 px-2 rounded whitespace-nowrap z-20 pointer-events-none transition-opacity">
                                {d.date}: ${d.spend.toFixed(2)}
                              </div>
                           </div>
                        </div>
                      )
                    })}
                   </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Orders */}
          <Card className="col-span-1 border-border/50 shadow-md flex flex-col">
            <CardHeader className="pb-4 border-b border-border/30">
              <CardTitle>Recent Orders</CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-auto">
              {ordersLoading ? (
                <div className="p-6 space-y-4">
                   {[1,2,3,4].map(i => <div key={i} className="h-12 bg-secondary animate-pulse rounded-lg"></div>)}
                </div>
              ) : recentOrdersData?.orders.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                  <Clock className="h-10 w-10 mb-3 opacity-20" />
                  <p>No recent orders found</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {recentOrdersData?.orders.map(order => (
                    <div key={order.id} className="p-4 hover:bg-muted/50 transition-colors flex justify-between items-center">
                      <div className="overflow-hidden pr-4">
                        <p className="font-medium text-sm truncate text-foreground mb-1">ID: {order.id}</p>
                        <p className="text-xs text-muted-foreground truncate">{order.serviceName}</p>
                      </div>
                      <div className="text-right shrink-0">
                         <Badge variant={
                           order.status === 'completed' ? 'success' : 
                           order.status === 'pending' || order.status === 'processing' ? 'warning' : 
                           order.status === 'cancelled' || order.status === 'failed' ? 'destructive' : 'default'
                         } className="mb-1 capitalize">
                           {order.status}
                         </Badge>
                         <p className="text-xs font-medium text-foreground">${order.charge.toFixed(2)}</p>
                      </div>
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
