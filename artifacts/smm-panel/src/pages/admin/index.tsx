import { useGetAdminStats, useAdminListApiLogs } from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Users, ShoppingCart, DollarSign, CreditCard, TicketIcon, Server, Activity } from "lucide-react";
import { format } from "date-fns";

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useGetAdminStats();
  const { data: logs, isLoading: logsLoading } = useAdminListApiLogs({ limit: 8 });

  const StatCard = ({ title, value, icon: Icon, colorClass }: any) => (
    <Card className="border-border/60 shadow-sm relative overflow-hidden group">
      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${colorClass} opacity-10 rounded-full -mr-6 -mt-6 group-hover:scale-150 transition-transform duration-500`}></div>
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClass} flex items-center justify-center text-white shadow-lg`}>
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold font-display tracking-tight text-foreground">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout isAdminLayout={true}>
      <div className="max-w-7xl mx-auto space-y-8 pb-8 animate-in fade-in duration-500">
        
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">System Overview</h2>
          <p className="text-muted-foreground mt-1">Real-time statistics and activity monitor.</p>
        </div>

        {/* Top Stats - Highlights */}
        {statsLoading ? (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
             {[1,2,3,4].map(i => <div key={i} className="h-28 bg-secondary animate-pulse rounded-xl"></div>)}
           </div>
        ) : stats ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Today's Revenue" value={formatCurrency(stats.todayRevenue)} icon={DollarSign} colorClass="from-green-500 to-emerald-600" />
            <StatCard title="Today's Orders" value={formatNumber(stats.todayOrders)} icon={ShoppingCart} colorClass="from-blue-500 to-cyan-600" />
            <StatCard title="Pending Deposits" value={formatNumber(stats.pendingDeposits)} icon={CreditCard} colorClass="from-orange-500 to-yellow-600" />
            <StatCard title="Open Tickets" value={formatNumber(stats.openTickets)} icon={TicketIcon} colorClass="from-red-500 to-rose-600" />
          </div>
        ) : null}

        {/* Secondary Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card border rounded-xl p-4 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-xs text-muted-foreground">Total Users</p>
                <p className="font-bold text-lg">{formatNumber(stats.totalUsers)}</p>
              </div>
              <Users className="text-muted-foreground/50 w-8 h-8" />
            </div>
            <div className="bg-card border rounded-xl p-4 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
                <p className="font-bold text-lg">{formatCurrency(stats.totalRevenue)}</p>
              </div>
              <DollarSign className="text-muted-foreground/50 w-8 h-8" />
            </div>
            <div className="bg-card border rounded-xl p-4 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-xs text-muted-foreground">Total Orders</p>
                <p className="font-bold text-lg">{formatNumber(stats.totalOrders)}</p>
              </div>
              <ShoppingCart className="text-muted-foreground/50 w-8 h-8" />
            </div>
            <div className="bg-card border rounded-xl p-4 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-xs text-muted-foreground">Active Services</p>
                <p className="font-bold text-lg">{formatNumber(stats.activeServices)}</p>
              </div>
              <Server className="text-muted-foreground/50 w-8 h-8" />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent API Activity */}
          <Card className="shadow-md border-border/60">
            <CardHeader className="bg-secondary/20 border-b border-border/50 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-primary" /> Live API Monitor
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                {logsLoading ? (
                   <div className="p-4 space-y-3">
                     {[1,2,3,4,5].map(i => <div key={i} className="h-8 bg-secondary animate-pulse rounded"></div>)}
                   </div>
                ) : logs?.logs.map(log => (
                  <div key={log.id} className="p-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${log.status === 'success' ? 'bg-success' : 'bg-destructive'}`}></div>
                      <div>
                        <p className="text-sm font-mono font-medium">{log.action}</p>
                        <p className="text-xs text-muted-foreground">User ID: {log.userId || 'Guest'} • {log.ipAddress}</p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(log.createdAt), 'HH:mm:ss')}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions / System Status (Placeholder for admin density) */}
          <Card className="shadow-md border-border/60 bg-primary/5">
             <CardHeader>
               <CardTitle>System Health</CardTitle>
             </CardHeader>
             <CardContent>
               <div className="space-y-4">
                 <div className="flex justify-between items-center p-3 bg-card rounded-lg border border-border/50">
                   <span className="font-medium text-sm">Main Database</span>
                   <Badge variant="success">Healthy</Badge>
                 </div>
                 <div className="flex justify-between items-center p-3 bg-card rounded-lg border border-border/50">
                   <span className="font-medium text-sm">Cron Jobs</span>
                   <Badge variant="success">Running</Badge>
                 </div>
                 <div className="flex justify-between items-center p-3 bg-card rounded-lg border border-border/50">
                   <span className="font-medium text-sm">Provider Connections</span>
                   <Badge variant="warning">1 Warning</Badge>
                 </div>
               </div>
             </CardContent>
          </Card>

        </div>
      </div>
    </DashboardLayout>
  );
}
