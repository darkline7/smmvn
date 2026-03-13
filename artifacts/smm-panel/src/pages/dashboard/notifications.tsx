import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useListNotifications } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Bell, ShoppingCart, Ticket, CreditCard, Settings, CheckCheck, RefreshCw } from "lucide-react";

const typeConfig: Record<string, { icon: any; color: string; bg: string }> = {
  order:   { icon: ShoppingCart, color: "text-blue-600",   bg: "bg-blue-100 dark:bg-blue-950/30" },
  ticket:  { icon: Ticket,       color: "text-purple-600", bg: "bg-purple-100 dark:bg-purple-950/30" },
  deposit: { icon: CreditCard,   color: "text-green-600",  bg: "bg-green-100 dark:bg-green-950/30" },
  system:  { icon: Settings,     color: "text-orange-600", bg: "bg-orange-100 dark:bg-orange-950/30" },
};

export default function Notifications() {
  const { data, isLoading, refetch } = useListNotifications();
  const notifications = data?.notifications || [];
  const unreadCount = notifications.filter((n: any) => !n.read).length;

  const markAllRead = async () => {
    const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
    await fetch(`${BASE}/api/notifications/read-all`, { method: "POST", credentials: "include" });
    refetch();
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6 pb-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold font-display">Thông báo</h2>
            <p className="text-muted-foreground mt-1">Cập nhật từ hệ thống và đơn hàng của bạn</p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" className="gap-2" onClick={markAllRead}>
                <CheckCheck className="w-4 h-4" />Đọc tất cả
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {unreadCount > 0 && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary font-medium">Bạn có {unreadCount} thông báo chưa đọc</span>
          </div>
        )}

        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">{[1,2,3,4].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl"></div>)}</div>
            ) : !notifications.length ? (
              <div className="text-center py-16 text-muted-foreground">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Không có thông báo nào</p>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((n: any) => {
                  const cfg = typeConfig[n.type] || typeConfig.system;
                  const Icon = cfg.icon;
                  return (
                    <div key={n.id} className={`flex items-start gap-4 p-4 hover:bg-muted/20 transition-colors ${!n.read ? "bg-primary/3" : ""}`}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                        <Icon className={`w-5 h-5 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`font-medium text-sm ${!n.read ? "text-foreground" : "text-foreground/80"}`}>{n.title}</p>
                          {!n.read && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5"></div>}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">{format(new Date(n.createdAt), "dd/MM/yyyy HH:mm")}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
