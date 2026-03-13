import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useListOrders } from "@workspace/api-client-react";
import { format } from "date-fns";
import { RefreshCw, Pause, Info } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function Subscriptions() {
  const { data, isLoading } = useListOrders({ status: "active", limit: 50 });
  const orders = (data?.orders || []).filter((o: any) => o.type === "subscription" || o.interval);

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 pb-8 animate-in fade-in duration-500">
        <div>
          <h2 className="text-3xl font-bold font-display">Subscriptions</h2>
          <p className="text-muted-foreground mt-1">Theo dõi các đơn hàng đăng ký tự động</p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Subscriptions là các đơn hàng tự động gia hạn. Hệ thống sẽ tự động tạo đơn hàng mới khi đến hạn.
          </p>
        </div>

        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl"></div>)}</div>
            ) : !orders.length ? (
              <div className="text-center py-16 text-muted-foreground">
                <RefreshCw className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Chưa có subscription nào</p>
                <p className="text-sm mt-1">Chọn dịch vụ hỗ trợ subscription khi đặt hàng</p>
              </div>
            ) : (
              <div className="divide-y">
                {orders.map((o: any) => (
                  <div key={o.id} className="flex items-center gap-4 p-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <RefreshCw className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{o.serviceName || `Service #${o.serviceId}`}</p>
                      <p className="text-xs text-muted-foreground truncate font-mono">{o.link}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(o.createdAt), "dd/MM/yyyy")}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-green-600 border-green-200 mb-1">Active</Badge>
                      <p className="text-sm font-bold">{formatCurrency(Number(o.charge))}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
