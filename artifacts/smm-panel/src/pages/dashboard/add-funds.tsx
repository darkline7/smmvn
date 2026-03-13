import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useListDeposits, useGetBalance } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Building2, QrCode, Copy, CheckCircle2, Clock, XCircle, RefreshCw, Info, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";

const statusMap: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Đang xử lý", color: "text-yellow-600 bg-yellow-50 border-yellow-200", icon: Clock },
  approved: { label: "Đã duyệt", color: "text-green-600 bg-green-50 border-green-200", icon: CheckCircle2 },
  rejected: { label: "Từ chối", color: "text-red-600 bg-red-50 border-red-200", icon: XCircle },
};

export default function AddFunds() {
  const { toast } = useToast();
  const { data: balance } = useGetBalance();
  const { data: depositsData, isLoading, refetch } = useListDeposits();
  const [pendingDeposit, setPendingDeposit] = useState<any>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

  // Fetch public settings (bank info + min/max deposit + exchange rate)
  const { data: publicSettings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/public/settings`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 60_000,
  });

  const minDeposit = publicSettings?.minDeposit || 1;
  const maxDeposit = publicSettings?.maxDeposit || 10000;
  const vndRate = publicSettings?.vndExchangeRate || 24000;
  const bankName = publicSettings?.bankName || "Chưa cấu hình";
  const bankAccount = publicSettings?.bankAccountNumber || "—";
  const bankAccountName = publicSettings?.bankAccountName || "—";
  const bankBin = publicSettings?.bankBin || "";

  const depositSchema = z.object({
    amount: z.coerce.number()
      .min(minDeposit, `Số tiền tối thiểu $${minDeposit}`)
      .max(maxDeposit, `Số tiền tối đa $${maxDeposit.toLocaleString()}`),
  });

  const PRESETS = [minDeposit, 10, 20, 50, 100, 200].filter((v, i, a) => a.indexOf(v) === i && v <= maxDeposit).slice(0, 6);

  // Auto-load most recent pending deposit so QR/bank info persists after page refresh
  const lastPending = depositsData?.deposits?.find((d: any) => d.status === "pending");
  const activeDeposit = pendingDeposit || lastPending || null;

  const form = useForm<z.infer<typeof depositSchema>>({
    resolver: zodResolver(depositSchema),
    defaultValues: { amount: Math.max(minDeposit, 10) },
  });

  const amount = form.watch("amount") || minDeposit;
  const vndAmount = Math.round(amount * vndRate);
  const vndFormatted = vndAmount.toLocaleString("vi-VN");
  const refCode = activeDeposit ? `SMM${activeDeposit.id}` : "SMM{ID}";
  const qrUrl = activeDeposit && bankBin && bankAccount && bankAccount !== "—"
    ? `https://qr.sepay.vn/img?acc=${bankAccount}&bank=${bankBin}&amount=${vndAmount}&des=${refCode}&template=compact&download=false`
    : null;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: "Đã sao chép!" });
  };

  const onSubmit = async (values: z.infer<typeof depositSchema>) => {
    try {
      const res = await fetch(`${BASE}/api/wallet/deposits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount: values.amount, method: "bank_transfer" }),
      });
      if (!res.ok) throw new Error("Failed");
      const deposit = await res.json();
      setPendingDeposit(deposit);
      refetch();
      toast({ title: "Tạo lệnh nạp tiền thành công!", description: `Mã giao dịch: SMM${deposit.id}` });
    } catch {
      toast({ title: "Lỗi", description: "Không thể tạo lệnh nạp tiền", variant: "destructive" });
    }
  };

  const CopyButton = ({ text, id }: { text: string; id: string }) => (
    <button onClick={() => copyToClipboard(text, id)} className="ml-2 p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground flex-shrink-0">
      {copied === id ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
    </button>
  );

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 pb-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-3xl font-bold font-display">Nạp tiền</h2>
            <p className="text-muted-foreground mt-1">Nạp tiền vào tài khoản qua chuyển khoản ngân hàng</p>
          </div>
          <Card className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Số dư hiện tại</p>
                <p className="text-xl font-bold text-primary">{formatCurrency(balance?.balance || 0)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Tự động xử lý 24/7 qua SePay:</strong> Tiền sẽ được cộng vào tài khoản trong vòng 1–5 phút sau khi chuyển khoản thành công.
            Tỉ giá: <strong>1 USD = {vndRate.toLocaleString("vi-VN")} VND</strong> · Nạp tối thiểu: <strong>${minDeposit}</strong>
          </div>
        </div>

        <Tabs defaultValue="bank">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="bank" className="gap-2"><Building2 className="w-4 h-4" />Chuyển khoản ngân hàng</TabsTrigger>
            <TabsTrigger value="history" className="gap-2"><Clock className="w-4 h-4" />Lịch sử nạp tiền</TabsTrigger>
          </TabsList>

          <TabsContent value="bank" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-border/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Bước 1: Chọn số tiền</CardTitle>
                  <CardDescription>Nhập hoặc chọn số tiền cần nạp (USD) · tối thiểu ${minDeposit}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                      <div className="grid grid-cols-3 gap-2">
                        {PRESETS.map(p => (
                          <button key={p} type="button" onClick={() => form.setValue("amount", p)}
                            className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all ${amount === p ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50 hover:bg-muted"}`}>
                            ${p}
                          </button>
                        ))}
                      </div>
                      <FormField control={form.control} name="amount" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Số tiền (USD)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                              <Input type="number" className="pl-7" min={minDeposit} max={maxDeposit} step="0.01" {...field} />
                            </div>
                          </FormControl>
                          <FormDescription>≈ {vndFormatted} VND</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <Button type="submit" className="w-full" size="lg">
                        Tạo lệnh nạp tiền →
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              {activeDeposit ? (
                <Card className="border-primary/30 shadow-sm bg-primary/5">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <QrCode className="w-5 h-5 text-primary" />
                      Bước 2: Chuyển khoản
                    </CardTitle>
                    <CardDescription>Mã giao dịch: <span className="font-bold text-foreground">SMM{activeDeposit.id}</span></CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {qrUrl ? (
                      <div className="flex justify-center">
                        <div className="p-3 bg-white rounded-2xl border shadow-sm">
                          <img src={qrUrl} alt="QR Code" className="w-48 h-48 object-contain" />
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-muted text-center text-sm text-muted-foreground">
                        Quét mã QR: Cấu hình thông tin ngân hàng trong Admin → Cài đặt → SePay / Bank
                      </div>
                    )}
                    <div className="space-y-2.5 text-sm">
                      {[
                        { label: "Ngân hàng", value: bankName, id: "bank" },
                        { label: "Số tài khoản", value: bankAccount, id: "acc" },
                        { label: "Chủ tài khoản", value: bankAccountName, id: "name" },
                        { label: "Số tiền (VND)", value: `${vndFormatted}`, id: "amount" },
                        { label: "Nội dung CK", value: `SMM${activeDeposit.id}`, id: "ref" },
                      ].map(({ label, value, id }) => (
                        <div key={id} className="flex items-center justify-between p-2.5 rounded-lg bg-background border gap-2">
                          <span className="text-muted-foreground flex-shrink-0">{label}</span>
                          <div className="flex items-center font-medium min-w-0">
                            <span className={`truncate ${id === "ref" ? "text-primary font-bold" : ""}`}>{value}</span>
                            <CopyButton text={id === "amount" ? vndAmount.toString() : value} id={id} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800">
                      <p className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">
                        ⚠️ Nhập đúng nội dung chuyển khoản <strong>SMM{activeDeposit.id}</strong> để hệ thống tự động xử lý trong 1–5 phút.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-border/50 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Building2 className="w-5 h-5" />
                      Thông tin ngân hàng
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {[
                      { label: "Ngân hàng", value: bankName },
                      { label: "Số tài khoản", value: bankAccount },
                      { label: "Chủ tài khoản", value: bankAccountName },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between p-2.5 rounded-lg bg-muted gap-2">
                        <span className="text-muted-foreground flex-shrink-0">{label}</span>
                        <span className="font-medium truncate">{value}</span>
                      </div>
                    ))}
                    <div className="mt-4 p-3 rounded-lg bg-muted text-muted-foreground text-xs text-center">
                      Tạo lệnh nạp tiền để nhận mã giao dịch và QR code tự động
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="history">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-lg">Lịch sử nạp tiền</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => refetch()} className="gap-2">
                  <RefreshCw className="w-4 h-4" />Làm mới
                </Button>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !depositsData?.deposits?.length ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Chưa có lịch sử nạp tiền</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {depositsData.deposits.map((d: any) => {
                      const status = statusMap[d.status] || statusMap.pending;
                      const Icon = status.icon;
                      return (
                        <div key={d.id} className="flex items-center justify-between p-4 rounded-xl border bg-card hover:shadow-sm transition-shadow gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${d.status === "approved" ? "bg-green-100" : d.status === "rejected" ? "bg-red-100" : "bg-yellow-100"}`}>
                              <Icon className={`w-5 h-5 ${d.status === "approved" ? "text-green-600" : d.status === "rejected" ? "text-red-600" : "text-yellow-600"}`} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium">Nạp tiền #{d.id}</p>
                              <p className="text-xs text-muted-foreground">{format(new Date(d.createdAt), "dd/MM/yyyy HH:mm")} · {d.method}</p>
                              {d.adminNote && <p className="text-xs text-muted-foreground mt-0.5 truncate">{d.adminNote}</p>}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-bold text-lg">{formatCurrency(Number(d.amount))}</p>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${status.color}`}>{status.label}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
