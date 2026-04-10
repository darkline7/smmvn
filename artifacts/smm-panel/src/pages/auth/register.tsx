import { useState, useRef, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useRegister, useGetMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Layers, Eye, EyeOff, Loader2 } from "lucide-react";
import { Turnstile } from "@marsidev/react-turnstile";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const registerSchema = z.object({
  username: z.string().min(3, "Username phải ít nhất 3 ký tự").max(30).regex(/^[a-zA-Z0-9_]+$/, "Chỉ dùng chữ, số, gạch dưới"),
  email: z.string().email("Email không hợp lệ"),
  password: z.string()
    .min(8, "Mật khẩu tối thiểu 8 ký tự")
    .regex(/[A-Z]/, "Mật khẩu phải có ít nhất 1 chữ hoa")
    .regex(/[a-z]/, "Mật khẩu phải có ít nhất 1 chữ thường")
    .regex(/[0-9]/, "Mật khẩu phải có ít nhất 1 chữ số"),
  confirmPassword: z.string(),
  referralCode: z.string().optional(),
}).refine(d => d.password === d.confirmPassword, { message: "Mật khẩu xác nhận không khớp", path: ["confirmPassword"] });

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const registerMut = useRegister();
  const { data: user, isLoading: userLoading } = useGetMe();

  useEffect(() => {
    if (!userLoading && user) {
      setLocation("/dashboard");
    }
  }, [user, userLoading, setLocation]);

  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<any>(null);

  const { data: authConfig } = useQuery({
    queryKey: ["auth-config"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/auth/config`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60_000,
  });

  const { data: siteSettings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/public/settings`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 5 * 60_000,
  });

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: "", email: "", password: "", confirmPassword: "", referralCode: "" },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      form.setValue("referralCode", ref);
    }
  }, [form]);

  const onSubmit = (values: z.infer<typeof registerSchema>) => {
    if (authConfig?.turnstileEnabled && !turnstileToken) {
      toast({ title: "Vui lòng xác minh bạn không phải robot", variant: "destructive" });
      return;
    }
    const payload: any = { username: values.username, email: values.email, password: values.password, referralCode: values.referralCode };
    if (authConfig?.turnstileEnabled && turnstileToken) payload.turnstileToken = turnstileToken;
    registerMut.mutate({ data: payload }, {
      onSuccess: () => {
        toast({ title: "Đăng ký thành công!", description: "Chào mừng bạn đến với SMM Pro." });
        setLocation("/dashboard");
      },
      onError: (err: any) => {
        toast({ title: "Đăng ký thất bại", description: err?.message || "Email hoặc username đã tồn tại", variant: "destructive" });
        if (turnstileRef.current) turnstileRef.current.reset();
        setTurnstileToken(null);
      },
    });
  };

  const handleGoogleLogin = () => {
    window.location.href = `${window.location.origin}${BASE}/api/auth/google`;
  };

  const siteName = siteSettings?.siteName || "SMM Pro";
  const logoUrl = siteSettings?.logoUrl || "";

  return (
    <div className="min-h-screen flex">
      {/* Left Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800 flex-col justify-between p-12 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 25% 25%, white 1px, transparent 0)", backgroundSize: "40px 40px" }} />
        <div className="relative">
          {logoUrl ? (
            <img src={logoUrl} alt={siteName} className="h-10 object-contain" onError={e => (e.currentTarget.style.display = "none")} />
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                <Layers className="w-5 h-5 text-white" />
              </div>
              <span className="text-2xl font-bold">{siteName}</span>
            </div>
          )}
        </div>
        <div className="relative space-y-6">
          <h2 className="text-4xl font-bold leading-tight">Bắt đầu miễn phí<br />ngay hôm nay</h2>
          <div className="space-y-4">
            {[
              { emoji: "🚀", text: "Tự động hoàn toàn 24/7" },
              { emoji: "💎", text: "Hàng trăm dịch vụ SMM" },
              { emoji: "🔒", text: "Thanh toán an toàn & nhanh" },
              { emoji: "📊", text: "API v2 đầy đủ cho reseller" },
            ].map(({ emoji, text }) => (
              <div key={text} className="flex items-center gap-3">
                <span className="text-2xl">{emoji}</span>
                <span className="text-white/90">{text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-white/50 text-sm">
          © 2025 {siteName}. All rights reserved.
        </div>
      </div>

      {/* Right Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background overflow-y-auto">
        <div className="w-full max-w-md space-y-6 py-8">
          <div className="lg:hidden flex items-center gap-2 mb-4">
            {logoUrl ? (
              <img src={logoUrl} alt={siteName} className="h-8 object-contain" />
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Layers className="w-4 h-4 text-white" />
                </div>
                <span className="text-xl font-bold">{siteName}</span>
              </div>
            )}
          </div>

          <div>
            <h1 className="text-3xl font-bold text-foreground">Tạo tài khoản</h1>
            <p className="text-muted-foreground mt-2">Bắt đầu tăng trưởng mạng xã hội ngay hôm nay.</p>
          </div>

          {authConfig?.googleEnabled && (
            <>
              <Button type="button" variant="outline" className="w-full h-12 gap-3 text-base" onClick={handleGoogleLogin}>
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Đăng ký với Google
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs uppercase text-muted-foreground">
                  <span className="bg-background px-2">hoặc đăng ký bằng email</span>
                </div>
              </div>
            </>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="username" render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl><Input placeholder="john_doe" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input type="email" placeholder="name@company.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Mật khẩu</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input type={showPassword ? "text" : "password"} placeholder="Tối thiểu 8 ký tự, gồm hoa thường và số" {...field} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel>Xác nhận mật khẩu</FormLabel>
                  <FormControl><Input type="password" placeholder="Nhập lại mật khẩu" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {authConfig?.turnstileEnabled && authConfig?.turnstileSiteKey && (
                <div className="flex justify-center">
                  <Turnstile
                    ref={turnstileRef}
                    siteKey={authConfig.turnstileSiteKey}
                    onSuccess={setTurnstileToken}
                    onExpire={() => setTurnstileToken(null)}
                    onError={() => setTurnstileToken(null)}
                  />
                </div>
              )}

              <Button type="submit" className="w-full h-11" disabled={registerMut.isPending}>
                {registerMut.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Đang tạo tài khoản...</> : "Tạo tài khoản miễn phí"}
              </Button>
            </form>
          </Form>

          <p className="text-center text-sm text-muted-foreground">
            Đã có tài khoản?{" "}
            <Link href="/login" className="text-primary font-medium hover:underline">Đăng nhập ngay</Link>
          </p>
          <p className="text-center text-xs text-muted-foreground">
            Bằng cách đăng ký, bạn đồng ý với{" "}
            <span className="text-primary cursor-pointer hover:underline">Điều khoản dịch vụ</span> và{" "}
            <span className="text-primary cursor-pointer hover:underline">Chính sách bảo mật</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
