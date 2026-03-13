import { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGetMe, useGetProfile, useUpdateProfile, useRegenerateApiKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { User, Shield, Save, Eye, EyeOff, Key, Copy, CheckCircle2, RefreshCw } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";

const profileSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, "Chỉ được dùng chữ, số và dấu _"),
  email: z.string().email("Email không hợp lệ"),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Nhập mật khẩu hiện tại"),
  newPassword: z.string().min(6, "Tối thiểu 6 ký tự"),
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, { message: "Mật khẩu không khớp", path: ["confirmPassword"] });

export default function Profile() {
  const { toast } = useToast();
  const { data: me } = useGetMe();
  const { data: profile, refetch: refetchProfile } = useGetProfile();
  const updateMut = useUpdateProfile();
  const regenMut = useRegenerateApiKey();
  const [showPwd, setShowPwd] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    values: { username: me?.username || "", email: me?.email || "" },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const saveProfile = (values: z.infer<typeof profileSchema>) => {
    updateMut.mutate({ data: values }, {
      onSuccess: () => toast({ title: "Cập nhật thành công!" }),
      onError: () => toast({ title: "Lỗi cập nhật", variant: "destructive" }),
    });
  };

  const changePassword = async (values: z.infer<typeof passwordSchema>) => {
    try {
      const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
      const res = await fetch(`${BASE}/api/profile/password`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast({ title: "Đổi mật khẩu thành công!" });
      passwordForm.reset();
    } catch (e: any) {
      toast({ title: e.message || "Lỗi đổi mật khẩu", variant: "destructive" });
    }
  };

  const regenKey = () => {
    if (!confirm("Tạo API Key mới sẽ vô hiệu hóa key cũ. Tiếp tục?")) return;
    regenMut.mutate(undefined, {
      onSuccess: () => { refetchProfile(); toast({ title: "✅ Tạo API Key mới thành công!" }); },
      onError: () => toast({ title: "Lỗi tạo API Key", variant: "destructive" }),
    });
  };

  const copyKey = () => {
    const key = profile?.apiKey;
    if (!key) return;
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
    toast({ title: "Đã sao chép API Key!" });
  };

  const apiKey = profile?.apiKey || "";
  const maskedKey = apiKey ? (apiKey.slice(0, 8) + "•".repeat(Math.max(0, apiKey.length - 12)) + apiKey.slice(-4)) : "";

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6 pb-8 animate-in fade-in duration-500">
        <div>
          <h2 className="text-3xl font-bold font-display">Hồ sơ</h2>
          <p className="text-muted-foreground mt-1">Quản lý thông tin tài khoản của bạn</p>
        </div>

        <div className="flex items-center gap-4 p-5 rounded-2xl border bg-card shadow-sm flex-wrap">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
            {me?.username?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold">{me?.username}</h3>
            <p className="text-muted-foreground">{me?.email}</p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${me?.role === "admin" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                {me?.role === "admin" ? "Admin" : "User"}
              </span>
              <span className="text-xs text-muted-foreground">Tham gia {me?.createdAt ? format(new Date(me.createdAt), "dd/MM/yyyy") : ""}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">{formatCurrency(Number(me?.balance || 0))}</p>
            <p className="text-xs text-muted-foreground">Số dư tài khoản</p>
          </div>
        </div>

        <Tabs defaultValue="info">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info" className="gap-2"><User className="w-4 h-4" />Thông tin</TabsTrigger>
            <TabsTrigger value="security" className="gap-2"><Shield className="w-4 h-4" />Bảo mật</TabsTrigger>
            <TabsTrigger value="apikey" className="gap-2"><Key className="w-4 h-4" />API Key</TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle>Thông tin cá nhân</CardTitle>
                <CardDescription>Cập nhật thông tin hồ sơ của bạn</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...profileForm}>
                  <form onSubmit={profileForm.handleSubmit(saveProfile)} className="space-y-4">
                    <FormField control={profileForm.control} name="username" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={profileForm.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl><Input type="email" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <Button type="submit" className="gap-2" disabled={updateMut.isPending}>
                      <Save className="w-4 h-4" />
                      {updateMut.isPending ? "Đang lưu..." : "Lưu thay đổi"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle>Đổi mật khẩu</CardTitle>
                <CardDescription>Đảm bảo sử dụng mật khẩu mạnh và độc nhất</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...passwordForm}>
                  <form onSubmit={passwordForm.handleSubmit(changePassword)} className="space-y-4">
                    <FormField control={passwordForm.control} name="currentPassword" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mật khẩu hiện tại</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input type={showPwd ? "text" : "password"} {...field} />
                            <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={passwordForm.control} name="newPassword" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mật khẩu mới</FormLabel>
                        <FormControl><Input type="password" placeholder="Tối thiểu 6 ký tự" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={passwordForm.control} name="confirmPassword" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Xác nhận mật khẩu mới</FormLabel>
                        <FormControl><Input type="password" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <Button type="submit" variant="destructive" className="gap-2">
                      <Shield className="w-4 h-4" />Đổi mật khẩu
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="apikey">
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Key className="w-5 h-5" />API Key</CardTitle>
                <CardDescription>Dùng API key để kết nối với SMM Panel từ ứng dụng khác</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {apiKey ? (
                  <>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">API Key của bạn</p>
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-xl border font-mono text-sm">
                        <span className="flex-1 truncate select-all">{showKey ? apiKey : maskedKey}</span>
                        <button onClick={() => setShowKey(!showKey)} className="p-1.5 hover:bg-background rounded-md transition-colors text-muted-foreground">
                          {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button onClick={copyKey} className="p-1.5 hover:bg-background rounded-md transition-colors text-muted-foreground">
                          {copiedKey ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-muted/50 border space-y-2">
                      <p className="text-sm font-medium">API Endpoint</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-background border rounded-lg px-3 py-2 flex-1 font-mono text-primary break-all">
                          {window.location.origin}{import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}/api/v2
                        </code>
                        <button onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}${import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}/api/v2`);
                          toast({ title: "Đã sao chép URL!" });
                        }} className="p-2 hover:bg-background rounded-md transition-colors text-muted-foreground flex-shrink-0">
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border bg-blue-50 dark:bg-blue-950/30 text-sm text-blue-700 dark:text-blue-300">
                      Truy cập <strong>Hướng dẫn API</strong> trong menu để xem tài liệu đầy đủ và ví dụ code.
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Key className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="mb-4">Bạn chưa có API Key</p>
                  </div>
                )}

                <Button onClick={regenKey} variant={apiKey ? "outline" : "default"} className="gap-2 w-full" disabled={regenMut.isPending}>
                  <RefreshCw className={`w-4 h-4 ${regenMut.isPending ? "animate-spin" : ""}`} />
                  {regenMut.isPending ? "Đang tạo..." : apiKey ? "Tạo API Key mới" : "Tạo API Key"}
                </Button>

                {apiKey && (
                  <p className="text-xs text-muted-foreground text-center">
                    ⚠️ Tạo key mới sẽ vô hiệu hóa key cũ ngay lập tức
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
