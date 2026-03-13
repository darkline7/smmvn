import { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGetMe, useGetProfile, useUpdateProfile } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { User, Shield, Bell, Save, Eye, EyeOff } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";

const profileSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, { message: "Mật khẩu không khớp", path: ["confirmPassword"] });

export default function Profile() {
  const { toast } = useToast();
  const { data: me } = useGetMe();
  const { data: profile } = useGetProfile();
  const updateMut = useUpdateProfile();
  const [showPwd, setShowPwd] = useState(false);

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

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6 pb-8 animate-in fade-in duration-500">
        <div>
          <h2 className="text-3xl font-bold font-display">Hồ sơ</h2>
          <p className="text-muted-foreground mt-1">Quản lý thông tin tài khoản của bạn</p>
        </div>

        <div className="flex items-center gap-4 p-5 rounded-2xl border bg-card shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
            {me?.username?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold">{me?.username}</h3>
            <p className="text-muted-foreground">{me?.email}</p>
            <div className="flex items-center gap-3 mt-2">
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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="info" className="gap-2"><User className="w-4 h-4" />Thông tin</TabsTrigger>
            <TabsTrigger value="security" className="gap-2"><Shield className="w-4 h-4" />Bảo mật</TabsTrigger>
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
                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground text-xs">API Key</Label>
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg font-mono text-xs">
                        <span className="truncate">{profile?.apiKey || "—"}</span>
                      </div>
                    </div>
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
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
