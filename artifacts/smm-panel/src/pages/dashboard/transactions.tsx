import { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListTransactions, useGetBalance } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { Receipt, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, RefreshCw, Wallet } from "lucide-react";

const typeConfig: Record<string, { label: string; color: string; sign: string; icon: any }> = {
  deposit:    { label: "Nạp tiền",     color: "text-green-600",  sign: "+", icon: ArrowUpRight },
  order:      { label: "Đặt hàng",     color: "text-red-500",    sign: "-", icon: ArrowDownRight },
  refund:     { label: "Hoàn tiền",    color: "text-blue-500",   sign: "+", icon: ArrowUpRight },
  adjustment: { label: "Điều chỉnh",   color: "text-orange-500", sign: "~", icon: ArrowUpRight },
  commission: { label: "Hoa hồng",     color: "text-purple-500", sign: "+", icon: ArrowUpRight },
};

export default function Transactions() {
  const [page, setPage] = useState(1);
  const [type, setType] = useState<string>("all");
  const { data: balance } = useGetBalance();
  const { data, isLoading, refetch } = useListTransactions({ page, limit: 20, ...(type !== "all" ? { type } : {}) } as any);

  const transactions = data?.transactions || [];
  const totalPages = data?.totalPages || 1;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 pb-8 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold font-display">Lịch sử giao dịch</h2>
            <p className="text-muted-foreground mt-1">Tất cả các giao dịch trong tài khoản của bạn</p>
          </div>
          <Card className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Số dư</p>
                <p className="text-xl font-bold text-primary">{formatCurrency(balance?.balance || 0)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Tổng nạp", value: transactions.filter(t => t.type === "deposit").reduce((s, t) => s + Number(t.amount), 0), icon: TrendingUp, color: "text-green-500" },
            { label: "Tổng chi", value: transactions.filter(t => t.type === "order").reduce((s, t) => s + Number(t.amount), 0), icon: TrendingDown, color: "text-red-500" },
            { label: "Hoàn tiền", value: transactions.filter(t => t.type === "refund").reduce((s, t) => s + Number(t.amount), 0), icon: RefreshCw, color: "text-blue-500" },
            { label: "Số dư", value: balance?.balance || 0, icon: Wallet, color: "text-primary" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="border-border/50 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
                <p className="text-lg font-bold">{formatCurrency(value)}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex-row items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-lg flex items-center gap-2"><Receipt className="w-5 h-5" />Giao dịch</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={type} onValueChange={v => { setType(v); setPage(1); }}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Tất cả" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="deposit">Nạp tiền</SelectItem>
                  <SelectItem value="order">Đặt hàng</SelectItem>
                  <SelectItem value="refund">Hoàn tiền</SelectItem>
                  <SelectItem value="commission">Hoa hồng</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl"></div>)}</div>
            ) : !transactions.length ? (
              <div className="text-center py-16 text-muted-foreground">
                <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Không có giao dịch nào</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {transactions.map((t: any) => {
                  const cfg = typeConfig[t.type] || typeConfig.order;
                  const Icon = cfg.icon;
                  const isPositive = t.type !== "order";
                  return (
                    <div key={t.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isPositive ? "bg-green-100 dark:bg-green-950/30" : "bg-red-100 dark:bg-red-950/30"}`}>
                          <Icon className={`w-5 h-5 ${cfg.color}`} />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{t.description || cfg.label}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(t.createdAt), "dd/MM/yyyy HH:mm")} · #{t.id}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${cfg.color}`}>{cfg.sign}{formatCurrency(Math.abs(Number(t.amount)))}</p>
                        <p className="text-xs text-muted-foreground">Số dư: {formatCurrency(Number(t.balanceAfter))}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}>Trước</Button>
            <span className="text-sm text-muted-foreground">Trang {page} / {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}>Sau</Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
