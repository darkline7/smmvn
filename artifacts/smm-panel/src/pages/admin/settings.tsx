import { useState, useEffect, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useAdminGetSettings } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import {
  Save, Settings, Building2, Send, Globe, RefreshCw, Database, Copy,
  Wifi, WifiOff, Loader2, Mail, Shield, Image, Eye, EyeOff, TestTube,
  Lock, Chrome, Zap, Info, Phone, MapPin, Layout,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function DbStatusCard() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["db-status"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/admin/db-status`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3 flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-muted-foreground" />
          <CardTitle className="text-base">Kết nối Database</CardTitle>
        </div>
        <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Đang kiểm tra...
          </div>
        ) : data?.connected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-medium text-green-600">PostgreSQL đang kết nối</span>
              <Badge variant="outline" className="text-green-600 border-green-200 text-xs">{data.latencyMs}ms</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted text-center">
                <p className="text-2xl font-bold">{data.userCount}</p>
                <p className="text-xs text-muted-foreground">Tổng users</p>
              </div>
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-center">
                <Wifi className="w-6 h-6 mx-auto mb-1 text-green-600" />
                <p className="text-xs text-green-600 font-medium">Online</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200">
            <WifiOff className="w-5 h-5 text-red-500" />
            <div>
              <p className="text-sm font-medium text-red-600">Mất kết nối database</p>
              <p className="text-xs text-red-500">{data?.error || "Không thể kết nối PostgreSQL"}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SettingsSection({ title, description, children, icon }: { title: string; description?: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {icon && <div className="text-muted-foreground">{icon}</div>}
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

interface FieldProps {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  description?: string;
  multiline?: boolean;
  sensitive?: boolean;
}

function Field({ label, id, value, onChange, placeholder, type = "text", description, multiline, sensitive }: FieldProps) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
      <div className="relative">
        {multiline ? (
          <Textarea id={id} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="resize-none" rows={3} />
        ) : (
          <Input
            id={id} value={value} onChange={e => onChange(e.target.value)}
            placeholder={placeholder} type={sensitive && !show ? "password" : type}
            className={sensitive ? "pr-10" : ""}
          />
        )}
        {sensitive && (
          <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

export default function AdminSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: settings, isLoading, refetch } = useAdminGetSettings();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [testEmail, setTestEmail] = useState("");

  useEffect(() => { if (settings) setForm(settings as any); }, [settings]);

  const set = (key: string) => (v: string) => setForm(prev => ({ ...prev, [key]: v }));
  const toggle = (key: string) => setForm(prev => ({ ...prev, [key]: prev[key] === "true" ? "false" : "true" }));

  const save = async (keys?: string[]) => {
    setSaving(true);
    try {
      const body = keys ? Object.fromEntries(keys.map(k => [k, form[k] ?? ""])) : form;
      const res = await fetch(`${BASE}/api/admin/settings`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Lưu thành công!" });
      refetch();
      qc.invalidateQueries({ queryKey: ["public-settings"] });
    } catch {
      toast({ title: "Lỗi lưu cài đặt", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const testTelegram = async () => {
    setTestingTelegram(true);
    try {
      await save(["telegram_bot_token", "telegram_admin_chat_id"]);
      const res = await fetch(`${BASE}/api/admin/test-telegram`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (data.ok) toast({ title: "✅ Telegram test thành công!" });
      else toast({ title: "❌ Test thất bại", description: data.error, variant: "destructive" });
    } catch { toast({ title: "Lỗi test Telegram", variant: "destructive" }); }
    finally { setTestingTelegram(false); }
  };

  const testSmtp = async () => {
    if (!testEmail) { toast({ title: "Nhập email nhận test", variant: "destructive" }); return; }
    setTestingSmtp(true);
    try {
      await save(["smtp_host","smtp_port","smtp_secure","smtp_user","smtp_pass","smtp_from_name","smtp_from_email","smtp_enabled"]);
      const res = await fetch(`${BASE}/api/admin/test-smtp`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ testEmail }),
      });
      const data = await res.json();
      if (data.ok) toast({ title: "✅ Email test đã gửi!", description: `Kiểm tra hộp thư ${testEmail}` });
      else toast({ title: "❌ SMTP thất bại", description: data.error, variant: "destructive" });
    } catch { toast({ title: "Lỗi test SMTP", variant: "destructive" }); }
    finally { setTestingSmtp(false); }
  };

  if (isLoading) return <DashboardLayout isAdminLayout><div className="text-center py-16 text-muted-foreground">Đang tải...</div></DashboardLayout>;

  const GENERAL_KEYS = ["site_name","site_description","site_keywords","site_author","support_email","hotline","address","fanpage_url","timezone","copyright_left","copyright_right","vnd_exchange_rate","referral_commission"];
  const BRANDING_KEYS = ["logo_url","favicon_url"];
  const BANK_KEYS = ["bank_name","bank_account_number","bank_account_name","bank_bin","sepay_webhook_secret","sepay_enabled","min_deposit","max_deposit","card_partner_id","card_partner_key","card_api_url"];
  const TELEGRAM_KEYS = ["telegram_bot_token","telegram_admin_chat_id","telegram_notify_new_order","telegram_notify_new_deposit","telegram_notify_new_ticket"];
  const SMTP_KEYS = ["smtp_host","smtp_port","smtp_secure","smtp_user","smtp_pass","smtp_from_name","smtp_from_email","smtp_enabled"];
  const SECURITY_KEYS = ["google_client_id","google_client_secret","google_oauth_enabled","turnstile_site_key","turnstile_secret_key","turnstile_enabled"];
  const SYSTEM_KEYS = ["min_order_balance","min_deposit","max_deposit","maintenance_mode","registration_open","cron_secret"];

  return (
    <DashboardLayout isAdminLayout>
      <div className="max-w-4xl mx-auto space-y-6 pb-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold font-display">Cài đặt hệ thống</h2>
            <p className="text-muted-foreground mt-1">Cấu hình toàn bộ website</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => refetch()}><RefreshCw className="w-4 h-4" /></Button>
        </div>

        <Tabs defaultValue="general">
          <TabsList className="flex flex-wrap gap-1 h-auto">
            <TabsTrigger value="general" className="gap-1.5 text-xs"><Globe className="w-3.5 h-3.5" />Chung</TabsTrigger>
            <TabsTrigger value="branding" className="gap-1.5 text-xs"><Image className="w-3.5 h-3.5" />Giao diện</TabsTrigger>
            <TabsTrigger value="bank" className="gap-1.5 text-xs"><Building2 className="w-3.5 h-3.5" />SePay/Bank</TabsTrigger>
            <TabsTrigger value="smtp" className="gap-1.5 text-xs"><Mail className="w-3.5 h-3.5" />SMTP Email</TabsTrigger>
            <TabsTrigger value="telegram" className="gap-1.5 text-xs"><Send className="w-3.5 h-3.5" />Telegram</TabsTrigger>
            <TabsTrigger value="security" className="gap-1.5 text-xs"><Shield className="w-3.5 h-3.5" />Bảo mật</TabsTrigger>
            <TabsTrigger value="system" className="gap-1.5 text-xs"><Settings className="w-3.5 h-3.5" />Hệ thống</TabsTrigger>
          </TabsList>

          {/* ===== TAB CHUNG ===== */}
          <TabsContent value="general" className="space-y-4 mt-4">
            <SettingsSection title="Thông tin website" icon={<Globe className="w-4 h-4" />}>
              <Field label="Tên website" id="site_name" value={form.site_name || ""} onChange={set("site_name")} placeholder="SMM Pro" />
              <Field label="Mô tả (SEO Description)" id="site_description" value={form.site_description || ""} onChange={set("site_description")} placeholder="The #1 SMM Panel" multiline />
              <Field label="Từ khóa (SEO Keywords)" id="site_keywords" value={form.site_keywords || ""} onChange={set("site_keywords")} placeholder="smm panel, instagram, facebook..." />
              <Field label="Tác giả (Author)" id="site_author" value={form.site_author || ""} onChange={set("site_author")} placeholder="SMM Pro" />
              <Field label="Múi giờ" id="timezone" value={form.timezone || "Asia/Ho_Chi_Minh"} onChange={set("timezone")} placeholder="Asia/Ho_Chi_Minh" description="Ví dụ: Asia/Ho_Chi_Minh, UTC, America/New_York" />
            </SettingsSection>

            <SettingsSection title="Liên hệ" icon={<Phone className="w-4 h-4" />}>
              <Field label="Email hỗ trợ" id="support_email" value={form.support_email || ""} onChange={set("support_email")} placeholder="support@smmpro.com" type="email" />
              <Field label="Hotline / Zalo" id="hotline" value={form.hotline || ""} onChange={set("hotline")} placeholder="0901 234 567" />
              <Field label="Địa chỉ" id="address" value={form.address || ""} onChange={set("address")} placeholder="123 Nguyễn Trãi, TP.HCM" />
              <Field label="Fanpage Facebook" id="fanpage_url" value={form.fanpage_url || ""} onChange={set("fanpage_url")} placeholder="https://facebook.com/smmpro" />
            </SettingsSection>

            <SettingsSection title="Footer" icon={<Layout className="w-4 h-4" />}>
              <Field label="Copyright trái" id="copyright_left" value={form.copyright_left || ""} onChange={set("copyright_left")} placeholder="© 2025 SMM Pro. All rights reserved." />
              <Field label="Copyright phải" id="copyright_right" value={form.copyright_right || ""} onChange={set("copyright_right")} placeholder="Powered by SMM Pro" />
            </SettingsSection>

            <SettingsSection title="Tài chính" icon={<Info className="w-4 h-4" />}>
              <Field label="Tỉ giá VND/USD" id="vnd_exchange_rate" value={form.vnd_exchange_rate || "24000"} onChange={set("vnd_exchange_rate")} type="number" description="1 USD = X VND" />
              <Field label="Hoa hồng giới thiệu (%)" id="referral_commission" value={form.referral_commission || "5"} onChange={set("referral_commission")} type="number" />
            </SettingsSection>

            <Button onClick={() => save(GENERAL_KEYS)} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />{saving ? "Đang lưu..." : "Lưu cài đặt chung"}
            </Button>
          </TabsContent>

          {/* ===== TAB GIAO DIỆN / BRANDING ===== */}
          <TabsContent value="branding" className="space-y-4 mt-4">
            <SettingsSection title="Logo & Favicon" description="Nhập URL hình ảnh (hỗ trợ PNG, JPG, SVG, ICO)" icon={<Image className="w-4 h-4" />}>
              <div className="space-y-4">
                <Field
                  label="Logo URL"
                  id="logo_url"
                  value={form.logo_url || ""}
                  onChange={set("logo_url")}
                  placeholder="https://example.com/logo.png"
                  description="Logo hiển thị trên header. Khuyến nghị: PNG trong suốt, tỉ lệ ngang, chiều cao ~40px."
                />
                {form.logo_url && (
                  <div className="p-4 border rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-2">Xem trước logo:</p>
                    <img src={form.logo_url} alt="Logo preview" className="h-10 object-contain" onError={e => (e.currentTarget.style.display = "none")} />
                  </div>
                )}
                <Field
                  label="Favicon URL"
                  id="favicon_url"
                  value={form.favicon_url || ""}
                  onChange={set("favicon_url")}
                  placeholder="https://example.com/favicon.ico"
                  description="Icon hiển thị trên tab trình duyệt. Khuyến nghị: ICO hoặc PNG 32×32px."
                />
                {form.favicon_url && (
                  <div className="p-4 border rounded-lg bg-muted/30 flex items-center gap-3">
                    <img src={form.favicon_url} alt="Favicon preview" className="w-8 h-8 object-contain" onError={e => (e.currentTarget.style.display = "none")} />
                    <p className="text-xs text-muted-foreground">Favicon preview</p>
                  </div>
                )}
              </div>
            </SettingsSection>

            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 text-sm text-blue-700 dark:text-blue-400">
              <p className="font-medium mb-1">💡 Hướng dẫn upload hình ảnh:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Dùng dịch vụ lưu trữ ảnh: <strong>imgur.com</strong>, <strong>cloudinary.com</strong>, hoặc <strong>imgbb.com</strong></li>
                <li>Upload ảnh → lấy URL direct link → dán vào đây</li>
                <li>Hoặc upload lên GitHub repo rồi dùng raw URL</li>
              </ul>
            </div>

            <Button onClick={() => save(BRANDING_KEYS)} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />{saving ? "Đang lưu..." : "Lưu cài đặt giao diện"}
            </Button>
          </TabsContent>

          {/* ===== TAB SEPAY / BANK ===== */}
          <TabsContent value="bank" className="space-y-4 mt-4">
            <SettingsSection title="Thông tin ngân hàng" icon={<Building2 className="w-4 h-4" />}>
              <Field label="Tên ngân hàng" id="bank_name" value={form.bank_name || ""} onChange={set("bank_name")} placeholder="MB Bank" />
              <Field label="Số tài khoản" id="bank_account_number" value={form.bank_account_number || ""} onChange={set("bank_account_number")} placeholder="0397700999" />
              <Field label="Tên chủ tài khoản" id="bank_account_name" value={form.bank_account_name || ""} onChange={set("bank_account_name")} placeholder="NGUYEN VAN A" />
              <Field label="BIN ngân hàng (SePay)" id="bank_bin" value={form.bank_bin || ""} onChange={set("bank_bin")} placeholder="970422" description="Mã BIN dùng cho QR SePay. MB Bank = 970422" />
            </SettingsSection>
            <SettingsSection title="SePay Webhook" icon={<Zap className="w-4 h-4" />}>
              <Field label="SePay Webhook Secret" id="sepay_webhook_secret" value={form.sepay_webhook_secret || ""} onChange={set("sepay_webhook_secret")} sensitive description="Cấu hình trong SePay Dashboard → Webhook" />
              <div className="flex items-center gap-3">
                <Switch checked={form.sepay_enabled === "true"} onCheckedChange={() => toggle("sepay_enabled")} id="sepay_enabled" />
                <Label htmlFor="sepay_enabled" className="text-green-600 font-medium">Bật SePay tự động xác nhận nạp tiền</Label>
              </div>
              <Field label="Nạp tối thiểu ($)" id="min_deposit" value={form.min_deposit || "1"} onChange={set("min_deposit")} type="number" />
              <Field label="Nạp tối đa ($)" id="max_deposit" value={form.max_deposit || "10000"} onChange={set("max_deposit")} type="number" />
            </SettingsSection>
            <SettingsSection title="Thẻ cào điện thoại (gachthevip.vn)" icon={<span className="text-base">📱</span>}>
              <p className="text-xs text-muted-foreground">Đăng ký đối tác tại <a href="https://gachthevip.vn" target="_blank" rel="noopener noreferrer" className="underline text-primary">gachthevip.vn</a> để lấy Partner ID và Partner Key.</p>
              <Field label="API URL" id="card_api_url" value={form.card_api_url || ""} onChange={set("card_api_url")} placeholder="https://thesieure.com/chargingws/v2" description="URL API nạp thẻ (mặc định: thesieure.com)" />
              <Field label="Partner ID" id="card_partner_id" value={form.card_partner_id || ""} onChange={set("card_partner_id")} placeholder="Partner ID" />
              <Field label="Partner Key" id="card_partner_key" value={form.card_partner_key || ""} onChange={set("card_partner_key")} sensitive placeholder="Partner Key" />
              <div className="space-y-1">
                <p className="text-xs font-medium">Callback URL (nhập vào gachthevip.vn):</p>
                <div className="flex items-center gap-2 bg-muted border rounded px-3 py-2 font-mono text-xs break-all">
                  <span className="flex-1 select-all">{`${window.location.origin}/api/wallet/cards/callback`}</span>
                  <button type="button" className="shrink-0 hover:text-primary transition-colors"
                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}/api/wallet/cards/callback`)}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                  </button>
                </div>
              </div>
            </SettingsSection>
            <Button onClick={() => save(BANK_KEYS)} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />{saving ? "Đang lưu..." : "Lưu cài đặt SePay/Bank & Thẻ cào"}
            </Button>
          </TabsContent>

          {/* ===== TAB SMTP ===== */}
          <TabsContent value="smtp" className="space-y-4 mt-4">
            <SettingsSection title="Cấu hình SMTP Email" description="Gửi email xác nhận đăng ký, reset mật khẩu, thông báo đơn hàng" icon={<Mail className="w-4 h-4" />}>
              <div className="flex items-center gap-3">
                <Switch checked={form.smtp_enabled === "true"} onCheckedChange={() => toggle("smtp_enabled")} id="smtp_enabled" />
                <Label htmlFor="smtp_enabled" className="font-medium">Bật SMTP Email</Label>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Field label="SMTP Host" id="smtp_host" value={form.smtp_host || ""} onChange={set("smtp_host")} placeholder="smtp.gmail.com" />
                </div>
                <Field label="Port" id="smtp_port" value={form.smtp_port || "587"} onChange={set("smtp_port")} type="number" placeholder="587" />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={form.smtp_secure === "true"} onCheckedChange={() => toggle("smtp_secure")} id="smtp_secure" />
                <Label htmlFor="smtp_secure">SSL/TLS (port 465)</Label>
              </div>
              <Field label="SMTP Username" id="smtp_user" value={form.smtp_user || ""} onChange={set("smtp_user")} placeholder="your@gmail.com" />
              <Field label="SMTP Password / App Password" id="smtp_pass" value={form.smtp_pass || ""} onChange={set("smtp_pass")} sensitive placeholder="App password từ Google" />
              <Field label="Tên người gửi" id="smtp_from_name" value={form.smtp_from_name || ""} onChange={set("smtp_from_name")} placeholder="SMM Pro" />
              <Field label="Email người gửi" id="smtp_from_email" value={form.smtp_from_email || ""} onChange={set("smtp_from_email")} type="email" placeholder="noreply@smmpro.com" />
            </SettingsSection>

            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Kiểm tra SMTP</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Field label="Email nhận test" id="test_email" value={testEmail} onChange={setTestEmail} type="email" placeholder="your@email.com" />
                <Button onClick={testSmtp} disabled={testingSmtp} variant="outline" className="gap-2">
                  {testingSmtp ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
                  Gửi email test
                </Button>
              </CardContent>
            </Card>

            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 text-sm text-blue-700 dark:text-blue-400 space-y-2">
              <p className="font-medium">📧 Hướng dẫn Gmail:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Bật <strong>2-Step Verification</strong> trong Google Account</li>
                <li>Vào <strong>App Passwords</strong> (myaccount.google.com/apppasswords)</li>
                <li>Tạo App Password → chọn Mail → chọn Device</li>
                <li>Dán password 16 ký tự vào SMTP Password</li>
                <li>Host: <code>smtp.gmail.com</code>, Port: <code>587</code>, SSL: <code>tắt</code></li>
              </ol>
            </div>

            <Button onClick={() => save(SMTP_KEYS)} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />{saving ? "Đang lưu..." : "Lưu cài đặt SMTP"}
            </Button>
          </TabsContent>

          {/* ===== TAB TELEGRAM ===== */}
          <TabsContent value="telegram" className="space-y-4 mt-4">
            <SettingsSection title="Telegram Bot Notification" description="Nhận thông báo đơn hàng, nạp tiền, ticket qua Telegram" icon={<Send className="w-4 h-4" />}>
              <Field label="Bot Token" id="telegram_bot_token" value={form.telegram_bot_token || ""} onChange={set("telegram_bot_token")} sensitive placeholder="123456:ABC-DEF..." description="Lấy từ @BotFather trên Telegram" />
              <Field label="Admin Chat ID" id="telegram_admin_chat_id" value={form.telegram_admin_chat_id || ""} onChange={set("telegram_admin_chat_id")} placeholder="-100123456789" description="Chat ID của bạn hoặc group admin. Dùng @userinfobot để lấy ID" />
              <div className="space-y-2 pt-2">
                <p className="text-sm font-medium">Loại thông báo:</p>
                {[
                  { key: "telegram_notify_new_order", label: "Đơn hàng mới" },
                  { key: "telegram_notify_new_deposit", label: "Nạp tiền thành công" },
                  { key: "telegram_notify_new_ticket", label: "Ticket hỗ trợ mới" },
                ].map(item => (
                  <div key={item.key} className="flex items-center gap-3">
                    <Switch checked={form[item.key] !== "false"} onCheckedChange={() => toggle(item.key)} id={item.key} />
                    <Label htmlFor={item.key}>{item.label}</Label>
                  </div>
                ))}
              </div>
            </SettingsSection>
            <div className="flex gap-3">
              <Button onClick={testTelegram} disabled={testingTelegram} variant="outline" className="gap-2">
                {testingTelegram ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
                Test Telegram
              </Button>
              <Button onClick={() => save(TELEGRAM_KEYS)} disabled={saving} className="gap-2">
                <Save className="w-4 h-4" />{saving ? "Đang lưu..." : "Lưu Telegram"}
              </Button>
            </div>
          </TabsContent>

          {/* ===== TAB BẢO MẬT ===== */}
          <TabsContent value="security" className="space-y-4 mt-4">
            <SettingsSection title="Đăng nhập Google OAuth" description="Cho phép user đăng nhập bằng tài khoản Google" icon={<Chrome className="w-4 h-4" />}>
              <div className="flex items-center gap-3">
                <Switch checked={form.google_oauth_enabled === "true"} onCheckedChange={() => toggle("google_oauth_enabled")} id="google_oauth_enabled" />
                <Label htmlFor="google_oauth_enabled" className="font-medium">Bật đăng nhập Google</Label>
              </div>
              <Field label="Google Client ID" id="google_client_id" value={form.google_client_id || ""} onChange={set("google_client_id")} placeholder="123456789-xxxx.apps.googleusercontent.com" />
              <Field label="Google Client Secret" id="google_client_secret" value={form.google_client_secret || ""} onChange={set("google_client_secret")} sensitive />
              <div className="p-3 rounded-lg bg-muted text-xs space-y-1">
                <p className="font-medium">Callback URL cần cấu hình trong Google Console:</p>
                <code className="text-xs bg-background px-2 py-1 rounded border block break-all">
                  {typeof window !== "undefined" ? `${window.location.origin}/api/auth/google/callback` : "/api/auth/google/callback"}
                </code>
              </div>
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 text-xs text-amber-700 dark:text-amber-400 space-y-1">
                <p className="font-medium">Hướng dẫn:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Vào <strong>console.cloud.google.com</strong></li>
                  <li>Tạo project → APIs &amp; Services → Credentials</li>
                  <li>OAuth 2.0 Client ID → Web application</li>
                  <li>Thêm Authorized redirect URI (URL ở trên)</li>
                  <li>Lấy Client ID và Client Secret</li>
                </ol>
              </div>
            </SettingsSection>

            <SettingsSection title="Cloudflare Turnstile" description="Bảo vệ form đăng nhập / đăng ký khỏi bot và spam" icon={<Shield className="w-4 h-4" />}>
              <div className="flex items-center gap-3">
                <Switch checked={form.turnstile_enabled === "true"} onCheckedChange={() => toggle("turnstile_enabled")} id="turnstile_enabled" />
                <Label htmlFor="turnstile_enabled" className="font-medium">Bật Cloudflare Turnstile</Label>
              </div>
              <Field label="Site Key (Public)" id="turnstile_site_key" value={form.turnstile_site_key || ""} onChange={set("turnstile_site_key")} placeholder="0x4AAAAAAA..." />
              <Field label="Secret Key" id="turnstile_secret_key" value={form.turnstile_secret_key || ""} onChange={set("turnstile_secret_key")} sensitive />
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 text-xs text-amber-700 dark:text-amber-400 space-y-1">
                <p className="font-medium">Hướng dẫn:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Vào <strong>dash.cloudflare.com</strong> → Turnstile</li>
                  <li>Add Site → nhập domain của bạn</li>
                  <li>Lấy Site Key (public) và Secret Key</li>
                  <li>Dán vào đây và bật tính năng</li>
                </ol>
              </div>
            </SettingsSection>

            <Button onClick={() => save(SECURITY_KEYS)} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />{saving ? "Đang lưu..." : "Lưu cài đặt bảo mật"}
            </Button>
          </TabsContent>

          {/* ===== TAB HỆ THỐNG ===== */}
          <TabsContent value="system" className="space-y-4 mt-4">
            <DbStatusCard />

            <SettingsSection title="Cài đặt đơn hàng" icon={<Settings className="w-4 h-4" />}>
              <Field label="Số dư tối thiểu để đặt hàng ($)" id="min_order_balance" value={form.min_order_balance || "0.01"} onChange={set("min_order_balance")} type="number" />
              <Field label="Nạp tối thiểu ($)" id="min_deposit" value={form.min_deposit || "1"} onChange={set("min_deposit")} type="number" />
              <Field label="Nạp tối đa ($)" id="max_deposit" value={form.max_deposit || "10000"} onChange={set("max_deposit")} type="number" />
              <div className="flex items-center gap-3">
                <Switch checked={form.maintenance_mode === "true"} onCheckedChange={() => toggle("maintenance_mode")} id="maintenance_mode" />
                <Label htmlFor="maintenance_mode" className="text-red-600 font-medium">Chế độ bảo trì</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={form.registration_open !== "false"} onCheckedChange={() => toggle("registration_open")} id="registration_open" />
                <Label htmlFor="registration_open">Cho phép đăng ký tài khoản mới</Label>
              </div>
            </SettingsSection>

            <SettingsSection title="Cron Secret" description="Bảo vệ link tự động cập nhật" icon={<Lock className="w-4 h-4" />}>
              <Field label="Cron Secret Key" id="cron_secret" value={form.cron_secret || ""} onChange={set("cron_secret")} sensitive placeholder="MySecretCron2025!" description="Key để bảo vệ các Cron Links bên dưới" />
              {form.cron_secret && (
                <div className="space-y-2 mt-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cron Links (dùng cho cron-job.org):</p>
                  {[
                    { label: "Đồng bộ tất cả dịch vụ", path: "/api/cron/sync-all" },
                    { label: "Cập nhật trạng thái đơn hàng", path: "/api/cron/update-orders" },
                  ].map(({ label, path }) => (
                    <div key={path} className="text-xs space-y-0.5">
                      <p className="text-muted-foreground">{label}:</p>
                      <div className="flex items-center gap-2 bg-muted border rounded px-3 py-2 font-mono break-all">
                        <span className="flex-1 select-all">{`${window.location.origin}${path}?secret=${form.cron_secret}`}</span>
                        <button type="button" className="shrink-0 hover:text-primary transition-colors"
                          onClick={() => navigator.clipboard.writeText(`${window.location.origin}${path}?secret=${form.cron_secret}`)}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SettingsSection>

            <SettingsSection title="API Endpoint" icon={<Globe className="w-4 h-4" />}>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border font-mono text-sm">
                <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="flex-1 text-xs break-all">{typeof window !== "undefined" ? `${window.location.origin}/api/v2` : "/api/v2"}</span>
                <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/api/v2`); }} className="p-1.5 hover:bg-background rounded">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </SettingsSection>

            <Button onClick={() => save(SYSTEM_KEYS)} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />{saving ? "Đang lưu..." : "Lưu cài đặt hệ thống"}
            </Button>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
