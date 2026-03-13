import { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useListServices, useGetBalance } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Droplets, Clock, Zap, Info, CheckCircle2 } from "lucide-react";

const schema = z.object({
  serviceId: z.string().min(1),
  link: z.string().url("URL không hợp lệ"),
  quantity: z.coerce.number().min(1),
  runs: z.coerce.number().min(2, "Tối thiểu 2 lần").max(100),
  interval: z.coerce.number().min(1, "Tối thiểu 1 phút").max(10080),
});

export default function DripFeed() {
  const { toast } = useToast();
  const { data: srvData } = useListServices();
  const { data: balance } = useGetBalance();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { serviceId: "", link: "", quantity: 100, runs: 5, interval: 60 },
  });

  const serviceId = form.watch("serviceId");
  const quantity = form.watch("quantity");
  const runs = form.watch("runs");
  const interval = form.watch("interval");
  const service = srvData?.services?.find(s => s.id.toString() === serviceId);
  const totalQty = quantity * runs;
  const totalCost = service ? (Number(service.rate) * totalQty / 1000) : 0;
  const duration = runs * interval;

  const onSubmit = async (values: z.infer<typeof schema>) => {
    if (totalCost > (balance?.balance || 0)) {
      toast({ title: "Số dư không đủ", variant: "destructive" });
      return;
    }
    try {
      const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
      const res = await fetch(`${BASE}/api/orders`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          serviceId: parseInt(values.serviceId), link: values.link,
          quantity: values.quantity, runs: values.runs, interval: values.interval,
          type: "drip_feed",
        }),
      });
      if (!res.ok) throw new Error();
      setSubmitted(true);
      toast({ title: "Tạo Drip Feed thành công!" });
    } catch {
      toast({ title: "Lỗi tạo đơn hàng", variant: "destructive" });
    }
  };

  if (submitted) {
    return (
      <DashboardLayout>
        <div className="max-w-lg mx-auto pt-16 text-center animate-in fade-in">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Drip Feed đã được tạo!</h2>
          <p className="text-muted-foreground mb-6">Hệ thống sẽ tự động gửi {runs} đợt, mỗi {interval} phút</p>
          <Button onClick={() => setSubmitted(false)}>Tạo thêm</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6 pb-8 animate-in fade-in duration-500">
        <div>
          <h2 className="text-3xl font-bold font-display flex items-center gap-3">
            <Droplets className="w-8 h-8 text-primary" />Drip Feed
          </h2>
          <p className="text-muted-foreground mt-1">Tự động chia nhỏ đơn hàng để tăng trưởng tự nhiên hơn</p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Drip Feed</strong> tự động chia đơn hàng thành nhiều đợt nhỏ và gửi theo lịch cố định, giúp tăng trưởng trông tự nhiên và ít bị phát hiện hơn.
          </p>
        </div>

        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Cấu hình Drip Feed</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField control={form.control} name="serviceId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dịch vụ</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue placeholder="Chọn dịch vụ..." /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        {srvData?.services?.filter(s => s.status === "active").map(s => (
                          <SelectItem key={s.id} value={s.id.toString()}>#{s.id} - {s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="link" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link</FormLabel>
                    <FormControl><Input placeholder="https://instagram.com/yourpost" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="quantity" render={({ field }) => (
                    <FormItem>
                      <FormLabel>SL / lần</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="runs" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Số lần</FormLabel>
                      <FormControl><Input type="number" min={2} max={100} {...field} /></FormControl>
                      <FormDescription>2 - 100</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="interval" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cách (phút)</FormLabel>
                      <FormControl><Input type="number" min={1} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    <span className="text-muted-foreground">Tổng số lượng:</span>
                    <span className="font-bold">{totalQty.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    <span className="text-muted-foreground">Tổng thời gian:</span>
                    <span className="font-bold">{duration >= 60 ? `${Math.floor(duration/60)}h ${duration%60}m` : `${duration}m`}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Chi phí:</span>
                    <span className="font-bold text-primary">{formatCurrency(totalCost)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Số dư:</span>
                    <span className={`font-bold ${totalCost > (balance?.balance || 0) ? "text-red-500" : "text-green-500"}`}>
                      {formatCurrency(balance?.balance || 0)}
                    </span>
                  </div>
                </div>

                <Button type="submit" className="w-full gap-2" size="lg" disabled={!serviceId}>
                  <Droplets className="w-5 h-5" />Tạo Drip Feed
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
