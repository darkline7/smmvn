import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListDeposits, useGetBalance } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Building2, QrCode, Copy, CheckCircle2, Clock, XCircle, RefreshCw, Info, Loader2, CreditCard, Smartphone } from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";

const TELCOS = [
  { value: "VIETTEL", label: "Viettel" },
  { value: "MOBIFONE", label: "MobiFone" },
  { value: "VINAPHONE", label: "Vinaphone" },
  { value: "VIETNAMOBILE", label: "Vietnamobile" },
  { value: "GMOBILE", label: "Gmobile" },
  { value: "REDDI", label: "Reddi" },
];
const CARD_AMOUNTS = [10000, 20000, 50000, 100000, 200000, 500000];

const statusMap: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Đang xử lý", color: "text-yellow-600 bg-yellow-50 border-yellow-200", icon: Clock },
  approved: { label: "Đã duyệt", color: "text-green-600 bg-green-50 border-green-200", icon: CheckCircle2 },
  rejected: { label: "Từ chối", color: "text-red-600 bg-red-50 border-red-200", icon: XCircle },
};

const cardSchema = z.object({
  telco: z.enum(["VIETTEL", "MOBIFONE", "VINAPHONE", "VIETNAMOBILE", "GMOBILE", "REDDI"] as const),
  serial: z.string().min(5, "Nhập số seri thẻ"),
  code: z.string().min(5, "Nhập mã thẻ"),
  amount: z.number({ required_error: "Chọn mệnh giá" }),
});

const cardStatusMap: Record<number, { label: string; color: string }> = {
  1: { label: "Thành công", color: "text-green-600 bg-green-50 border-green-200" },
  2: { label: "Đang xử lý", color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  3: { label: "Thẻ lỗi", color: "text-red-600 bg-red-50 border-red-200" },
  99: { label: "Bảo trì", color: "text-gray-600 bg-gray-50 border-gray-200" },
};

export default function AddFunds() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: balance, refetch: refetchBalance } = useGetBalance();
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

  // ── Thẻ cào form ──────────────────────────────────────────────────────
  const cardForm = useForm<z.infer<typeof cardSchema>>({
    resolver: zodResolver(cardSchema),
    defaultValues: { telco: "VIETTEL", serial: "", code: "", amount: 50000 },
  });

  const { data: cardsData, refetch: refetchCards } = useQuery({
    queryKey: ["cards"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/wallet/cards`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const cardMut = useMutation({
    mutationFn: async (values: z.infer<typeof cardSchema>) => {
      const res = await fetch(`${BASE}/api/wallet/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });
      return res.json();
    },
    onSuccess: (data) => {
      refetchCards();
      refetchBalance();
      qc.invalidateQueries({ queryKey: ["balance"] });
      if (data.status === 1) {
        toast({ title: "Nạp thẻ thành công!", description: `Đã cộng ${data.usdCredited ? formatCurrency(Number(data.usdCredited)) : ""} vào tài khoản` });
        cardForm.reset({ telco: "VIETTEL", serial: "", code: "", amount: 50000 });
      } else if (data.status === 2) {
        toast({ title: "Thẻ đang xử lý", description: "Hệ thống sẽ cộng tiền sau khi xác nhận (~vài phút)" });
      } else if (data.error) {
        toast({ title: "Lỗi", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "Nạp thẻ thất bại", description: data.message || "Thẻ không hợp lệ", variant: "destructive" });
      }
    },
    onError: () => toast({ title: "Lỗi kết nối", variant: "destructive" }),
  });
  // ───────────────────────────────────────────────────────────────────────

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

  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (values: z.infer<typeof depositSchema>) => {
    setSubmitting(true);
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
    } finally {
      setSubmitting(false);
    }
  };

  const cancelDeposit = async () => {
    if (!activeDeposit) return;
    try {
      await fetch(`${BASE}/api/wallet/deposits/${activeDeposit.id}/cancel`, {
        method: "POST",
        credentials: "include",
      });
    } catch {}
    setPendingDeposit(null);
    refetch();
    toast({ title: "Đã hủy lệnh nạp tiền" });
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
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="bank" className="gap-1.5"><Building2 className="w-4 h-4" />Ngân hàng</TabsTrigger>
            <TabsTrigger value="card" className="gap-1.5"><Smartphone className="w-4 h-4" />Thẻ cào</TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5"><Clock className="w-4 h-4" />Lịch sử</TabsTrigger>
          </TabsList>

          <TabsContent value="bank" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-border/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Bước 1: Chọn số tiền</CardTitle>
                  <CardDescription>Nhập hoặc chọn số tiền cần nạp (USD) · tối thiểu ${minDeposit}</CardDescription>
                </CardHeader>
                <CardContent>
                  {activeDeposit ? (
                    <div className="space-y-4">
                      <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
                        <p className="text-xs text-muted-foreground mb-1">Lệnh nạp đang chờ thanh toán</p>
                        <p className="text-2xl font-bold text-primary">${Number(activeDeposit.amount).toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">≈ {(Number(activeDeposit.amount) * vndRate).toLocaleString("vi-VN")} VND · Mã: <span className="font-bold text-foreground">SMM{activeDeposit.id}</span></p>
                      </div>
                      <Button variant="outline" className="w-full border-red-200 text-red-600 hover:bg-red-50" onClick={cancelDeposit}>
                        Hủy lệnh & Tạo lệnh mới
                      </Button>
                    </div>
                  ) : (
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
                      <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                        {submitting ? "Đang tạo..." : "Tạo lệnh nạp tiền →"}
                      </Button>
                    </form>
                  </Form>
                  )}
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

          {/* ── Thẻ Cào Tab ── */}
          <TabsContent value="card" className="space-y-6">
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex gap-3">
              <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-700 dark:text-amber-300">
                <strong>Nạp thẻ cào điện thoại</strong> – Hỗ trợ Viettel, MobiFone, Vinaphone, Vietnamobile, Gmobile, Reddi.
                Thẻ lỗi/sai mệnh giá sẽ bị trừ phí theo quy định.
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-border/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><Smartphone className="w-5 h-5 text-primary" />Nhập thông tin thẻ</CardTitle>
                  <CardDescription>Điền đầy đủ thông tin thẻ cào điện thoại</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...cardForm}>
                    <form onSubmit={cardForm.handleSubmit(v => cardMut.mutate(v))} className="space-y-4">
                      <FormField control={cardForm.control} name="telco" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nhà mạng</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Chọn nhà mạng" /></SelectTrigger></FormControl>
                            <SelectContent>{TELCOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={cardForm.control} name="amount" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mệnh giá</FormLabel>
                          <div className="grid grid-cols-3 gap-2">
                            {CARD_AMOUNTS.map(a => (
                              <button key={a} type="button" onClick={() => field.onChange(a)}
                                className={`py-2 px-2 rounded-lg border text-sm font-medium transition-all ${field.value === a ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50 hover:bg-muted"}`}>
                                {a.toLocaleString("vi-VN")}đ
                              </button>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={cardForm.control} name="serial" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Số seri thẻ</FormLabel>
                          <FormControl><Input placeholder="Nhập số seri in trên thẻ" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={cardForm.control} name="code" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mã thẻ</FormLabel>
                          <FormControl><Input placeholder="Nhập mã cào (dưới lớp bạc)" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <Button type="submit" className="w-full" size="lg" disabled={cardMut.isPending}>
                        {cardMut.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Đang nạp...</> : "Nạp thẻ ngay →"}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              <Card className="border-border/50 shadow-sm">
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="text-lg">Lịch sử thẻ cào</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => refetchCards()} className="gap-2"><RefreshCw className="w-4 h-4" />Làm mới</Button>
                </CardHeader>
                <CardContent>
                  {!cardsData?.cards?.length ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Chưa có lịch sử nạp thẻ</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                      {cardsData.cards.map((c: any) => {
                        const st = cardStatusMap[c.status] || { label: "Không rõ", color: "text-gray-600 bg-gray-50 border-gray-200" };
                        return (
                          <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border bg-card gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-sm">{c.telco} · {Number(c.declaredAmount).toLocaleString("vi-VN")}đ</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(c.createdAt), "dd/MM HH:mm")}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              {c.usdCredited && <p className="text-xs font-bold text-green-600">+{formatCurrency(Number(c.usdCredited))}</p>}
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${st.color}`}>{st.label}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
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
