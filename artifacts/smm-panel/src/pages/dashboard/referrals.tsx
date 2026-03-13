import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { Users, Copy, CheckCircle2, Gift, TrendingUp, DollarSign } from "lucide-react";
import { useState } from "react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export default function Referrals() {
  const { toast } = useToast();
  const { data: me } = useGetMe();
  const [copied, setCopied] = useState(false);

  const { data } = useQuery<any>({
    queryKey: ["referrals"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/referrals`, { credentials: "include" });
      if (!r.ok) return { referrals: [] };
      return r.json();
    },
    staleTime: 60_000,
  });

  const referrals = data?.referrals || [];
  const totalCommission = referrals.reduce((s: number, r: any) => s + Number(r.commission || 0), 0);
  const refLink = `${window.location.origin}/register?ref=${me?.username || ""}`;

  const copy = () => {
    navigator.clipboard.writeText(refLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Đã sao chép link giới thiệu!" });
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 pb-8 animate-in fade-in duration-500">
        <div>
          <h2 className="text-3xl font-bold font-display">Chương trình giới thiệu</h2>
          <p className="text-muted-foreground mt-1">Kiếm hoa hồng khi giới thiệu bạn bè sử dụng SMM Pro</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Tổng giới thiệu", value: referrals.length, icon: Users, color: "from-blue-500 to-cyan-600" },
            { label: "Tổng hoa hồng", value: formatCurrency(totalCommission), icon: DollarSign, color: "from-green-500 to-emerald-600" },
            { label: "Tỉ lệ hoa hồng", value: "5%", icon: TrendingUp, color: "from-violet-500 to-purple-600" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="border-border/50 shadow-sm relative overflow-hidden">
              <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${color} opacity-10 rounded-full -mr-6 -mt-6`}></div>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white shadow-md`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="text-2xl font-bold">{value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-primary/30 bg-primary/5 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Gift className="w-5 h-5 text-primary" />Link giới thiệu của bạn</CardTitle>
            <CardDescription>Chia sẻ link này để nhận 5% hoa hồng từ mỗi đơn hàng của người bạn giới thiệu</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-background rounded-xl border font-mono text-sm">
              <span className="flex-1 truncate text-primary">{refLink}</span>
              <Button variant="outline" size="sm" onClick={copy} className="gap-2 flex-shrink-0">
                {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                {copied ? "Đã sao chép" : "Sao chép"}
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              {[
                { step: "1", text: "Chia sẻ link giới thiệu" },
                { step: "2", text: "Bạn bè đăng ký và đặt hàng" },
                { step: "3", text: "Nhận 5% hoa hồng tự động" },
              ].map(({ step, text }) => (
                <div key={step} className="text-center p-3 rounded-xl bg-background border">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm mx-auto mb-2">{step}</div>
                  <p className="text-xs text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Users className="w-5 h-5" />Người đã giới thiệu ({referrals.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!referrals.length ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground">Chưa có ai đăng ký qua link của bạn</p>
              </div>
            ) : (
              <div className="divide-y">
                {referrals.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                        {r.referredUserId}
                      </div>
                      <div>
                        <p className="font-medium text-sm">User #{r.referredUserId}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(r.createdAt), "dd/MM/yyyy")}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">+{formatCurrency(Number(r.commission))}</p>
                      <p className="text-xs text-muted-foreground">Hoa hồng</p>
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
