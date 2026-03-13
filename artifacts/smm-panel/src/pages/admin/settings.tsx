import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useAdminGetSettings } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Save, Settings, Building2, Send, Globe, RefreshCw, CheckCircle2, TestTube } from "lucide-react";

function SettingsSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function Field({ label, id, value, onChange, type = "text", placeholder, description }: {
  label: string; id: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; description?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

export default function AdminSettings() {
  const { toast } = useToast();
  const { data: settings, isLoading, refetch } = useAdminGetSettings();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => { if (settings) setForm(settings as any); }, [settings]);

  const set = (key: string) => (v: string) => setForm(prev => ({ ...prev, [key]: v }));
  const toggle = (key: string) => setForm(prev => ({ ...prev, [key]: prev[key] === "true" ? "false" : "true" }));

  const save = async (keys?: string[]) => {
    setSaving(true);
    try {
      const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
      const body = keys ? Object.fromEntries(keys.map(k => [k, form[k] || ""])) : form;
      const res = await fetch(`${BASE}/api/admin/settings`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Lưu cài đặt thành công!" });
      refetch();
    } catch {
      toast({ title: "Lỗi lưu cài đặt", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const testTelegram = async () => {
    setTesting(true);
    try {
      await save(["telegram_bot_token", "telegram_admin_chat_id"]);
      const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
      const res = await fetch(`${BASE}/api/admin/test-telegram`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (data.ok) toast({ title: "✅ Telegram test thành công!", description: "Kiểm tra bot Telegram của bạn" });
      else toast({ title: "❌ Test thất bại", description: data.error, variant: "destructive" });
    } catch {
      toast({ title: "Lỗi test Telegram", variant: "destructive" });
    } finally { setTesting(false); }
  };

  if (isLoading) return <DashboardLayout isAdminLayout><div className="text-center py-16 text-muted-foreground">Đang tải...</div></DashboardLayout>;

  return (
    <DashboardLayout isAdminLayout>
      <div className="max-w-4xl mx-auto space-y-6 pb-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold font-display">Cài đặt hệ thống</h2>
            <p className="text-muted-foreground mt-1">Cấu hình SePay, Telegram, thanh toán và các cài đặt khác</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => refetch()}><RefreshCw className="w-4 h-4" /></Button>
        </div>

        <Tabs defaultValue="general">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general" className="gap-2"><Globe className="w-4 h-4 hidden sm:block" />Chung</TabsTrigger>
            <TabsTrigger value="bank" className="gap-2"><Building2 className="w-4 h-4 hidden sm:block" />SePay / Bank</TabsTrigger>
            <TabsTrigger value="telegram" className="gap-2"><Send className="w-4 h-4 hidden sm:block" />Telegram</TabsTrigger>
            <TabsTrigger value="system" className="gap-2"><Settings className="w-4 h-4 hidden sm:block" />Hệ thống</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-4">
            <SettingsSection title="Thông tin website" description="Thông tin hiển thị trên website">
              <Field label="Tên website" id="site_name" value={form.site_name || ""} onChange={set("site_name")} placeholder="SMM Pro" />
              <Field label="Mô tả website" id="site_description" value={form.site_description || ""} onChange={set("site_description")} placeholder="The #1 SMM Panel" />
              <Field label="Email hỗ trợ" id="support_email" value={form.support_email || ""} onChange={set("support_email")} placeholder="support@smmpro.com" />
              <Field label="Tỉ giá VND/USD" id="vnd_exchange_rate" value={form.vnd_exchange_rate || "24000"} onChange={set("vnd_exchange_rate")} type="number" description="1 USD = X VND (dùng để khớp SePay)" />
              <Field label="Hoa hồng giới thiệu (%)" id="referral_commission" value={form.referral_commission || "5"} onChange={set("referral_commission")} type="number" />
            </SettingsSection>
            <Button onClick={() => save(["site_name","site_description","support_email","vnd_exchange_rate","referral_commission"])} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />{saving ? "Đang lưu..." : "Lưu cài đặt chung"}
            </Button>
          </TabsContent>

          <TabsContent value="bank" className="space-y-4 mt-4">
            <SettingsSection title="Thông tin ngân hàng" description="Tài khoản ngân hàng nhận tiền từ khách hàng">
              <Field label="Tên ngân hàng" id="bank_name" value={form.bank_name || ""} onChange={set("bank_name")} placeholder="MB Bank" />
              <Field label="Số tài khoản" id="bank_account_number" value={form.bank_account_number || ""} onChange={set("bank_account_number")} placeholder="0397700999" />
              <Field label="Tên chủ tài khoản" id="bank_account_name" value={form.bank_account_name || ""} onChange={set("bank_account_name")} placeholder="CONG TY SMM PRO" />
              <Field label="BIN ngân hàng" id="bank_bin" value={form.bank_bin || ""} onChange={set("bank_bin")} placeholder="970422" description="Dùng để tạo QR SePay. Tra cứu tại sepay.vn/banks" />
            </SettingsSection>

            <SettingsSection title="SePay Integration" description="Tích hợp SePay để tự động xác nhận chuyển khoản 24/7">
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300">
                <strong>Hướng dẫn:</strong> Đăng ký tài khoản SePay → Kết nối ngân hàng → Lấy API Key → Cài đặt Webhook URL là:
                <code className="ml-1 px-1 py-0.5 bg-blue-100 dark:bg-blue-900 rounded text-xs break-all">{window.location.origin}/api/webhooks/sepay</code>
              </div>
              <Field label="SePay Webhook Secret" id="sepay_webhook_secret" value={form.sepay_webhook_secret || ""} onChange={set("sepay_webhook_secret")} type="password" placeholder="Để trống nếu không dùng xác thực" description="Chuỗi bí mật để xác thực webhook từ SePay" />
              <div className="flex items-center gap-3 py-2">
                <Switch checked={form.sepay_enabled === "true"} onCheckedChange={() => toggle("sepay_enabled")} id="sepay_enabled" />
                <Label htmlFor="sepay_enabled">Kích hoạt tự động duyệt qua SePay</Label>
              </div>
            </SettingsSection>
            <Button onClick={() => save(["bank_name","bank_account_number","bank_account_name","bank_bin","sepay_webhook_secret","sepay_enabled"])} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />{saving ? "Đang lưu..." : "Lưu cài đặt ngân hàng & SePay"}
            </Button>
          </TabsContent>

          <TabsContent value="telegram" className="space-y-4 mt-4">
            <SettingsSection title="Telegram Bot" description="Nhận thông báo realtime qua Telegram khi có đơn hàng, nạp tiền, ticket mới">
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <p><strong>Cách lấy Bot Token:</strong> Nhắn @BotFather trên Telegram → /newbot → Đặt tên → Lấy token</p>
                <p><strong>Cách lấy Chat ID:</strong> Nhắn bot → Truy cập <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">https://api.telegram.org/bot{`{TOKEN}`}/getUpdates</code></p>
              </div>
              <Field label="Bot Token" id="telegram_bot_token" value={form.telegram_bot_token || ""} onChange={set("telegram_bot_token")} type="password" placeholder="123456789:ABCdefGHI..." />
              <Field label="Admin Chat ID" id="telegram_admin_chat_id" value={form.telegram_admin_chat_id || ""} onChange={set("telegram_admin_chat_id")} placeholder="-100123456789" description="Chat ID của admin (có thể là group)" />
              <div className="space-y-2">
                <p className="text-sm font-medium">Thông báo cho admin:</p>
                {[
                  { key: "telegram_notify_new_order", label: "Đơn hàng mới" },
                  { key: "telegram_notify_new_deposit", label: "Yêu cầu nạp tiền mới" },
                  { key: "telegram_notify_new_ticket", label: "Ticket hỗ trợ mới" },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-3">
                    <Switch checked={form[key] !== "false"} onCheckedChange={() => toggle(key)} id={key} />
                    <Label htmlFor={key}>{label}</Label>
                  </div>
                ))}
              </div>
            </SettingsSection>
            <div className="flex gap-3">
              <Button onClick={() => save(["telegram_bot_token","telegram_admin_chat_id","telegram_notify_new_order","telegram_notify_new_deposit","telegram_notify_new_ticket"])} disabled={saving} className="gap-2">
                <Save className="w-4 h-4" />{saving ? "Đang lưu..." : "Lưu cài đặt Telegram"}
              </Button>
              <Button variant="outline" onClick={testTelegram} disabled={testing} className="gap-2">
                <TestTube className="w-4 h-4" />{testing ? "Đang test..." : "Test Telegram"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="system" className="space-y-4 mt-4">
            <SettingsSection title="Cài đặt đơn hàng" description="Quy tắc xử lý đơn hàng">
              <Field label="Số dư tối thiểu để đặt hàng ($)" id="min_order_balance" value={form.min_order_balance || "0.01"} onChange={set("min_order_balance")} type="number" />
              <Field label="Số dư tối thiểu nạp tiền ($)" id="min_deposit" value={form.min_deposit || "1"} onChange={set("min_deposit")} type="number" />
              <Field label="Số dư tối đa nạp tiền ($)" id="max_deposit" value={form.max_deposit || "10000"} onChange={set("max_deposit")} type="number" />
              <div className="flex items-center gap-3">
                <Switch checked={form.maintenance_mode === "true"} onCheckedChange={() => toggle("maintenance_mode")} id="maintenance_mode" />
                <Label htmlFor="maintenance_mode" className="text-red-600 font-medium">Chế độ bảo trì (tắt đặt hàng)</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={form.registration_open !== "false"} onCheckedChange={() => toggle("registration_open")} id="registration_open" />
                <Label htmlFor="registration_open">Cho phép đăng ký tài khoản mới</Label>
              </div>
            </SettingsSection>
            <Button onClick={() => save(["min_order_balance","min_deposit","max_deposit","maintenance_mode","registration_open"])} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />{saving ? "Đang lưu..." : "Lưu cài đặt hệ thống"}
            </Button>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
