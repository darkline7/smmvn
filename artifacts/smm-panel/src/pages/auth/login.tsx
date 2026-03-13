import { useState, useRef, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useLogin } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Layers, Loader2, Eye, EyeOff } from "lucide-react";
import { Turnstile } from "@marsidev/react-turnstile";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const loginSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(1, "Nhập mật khẩu"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const loginMut = useLogin();
  const [showPass, setShowPass] = useState(false);
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

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    if (authConfig?.turnstileEnabled && !turnstileToken) {
      toast({ title: "Vui lòng xác minh bạn không phải robot", variant: "destructive" });
      return;
    }
    const payload: any = { ...values };
    if (authConfig?.turnstileEnabled && turnstileToken) payload.turnstileToken = turnstileToken;
    loginMut.mutate({ data: payload }, {
      onSuccess: () => {
        toast({ title: "Đăng nhập thành công!" });
        setLocation("/dashboard");
      },
      onError: (error: any) => {
        toast({ variant: "destructive", title: "Đăng nhập thất bại", description: error?.message || "Email hoặc mật khẩu không đúng" });
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
    <div className="min-h-screen grid lg:grid-cols-2 bg-background font-sans">
      {/* Left Branding Panel */}
      <div className="hidden lg:flex flex-col justify-between relative p-12 overflow-hidden bg-primary">
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/60" />
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 25% 25%, white 1px, transparent 0), radial-gradient(circle at 75% 75%, white 1px, transparent 0)", backgroundSize: "40px 40px" }} />
        <div className="relative z-10">
          <div className="flex items-center gap-3 text-white">
            {logoUrl ? (
              <img src={logoUrl} alt={siteName} className="h-10 object-contain" onError={e => (e.currentTarget.style.display = "none")} />
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                  <Layers className="h-6 w-6" />
                </div>
                <span className="font-bold text-2xl">{siteName}</span>
              </div>
            )}
          </div>
        </div>
        <div className="relative z-10 text-white max-w-md">
          <h1 className="text-4xl font-bold leading-tight mb-4">Bảng điều khiển SMM hàng đầu Việt Nam</h1>
          <p className="text-primary-foreground/80 text-lg">Tăng tương tác mạng xã hội tự động, nhanh chóng và an toàn.</p>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="flex flex-col justify-center items-center p-8 lg:p-12">
        <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="text-center">
            <div className="lg:hidden flex items-center justify-center gap-2 mb-6">
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
            <h2 className="text-3xl font-bold">Chào mừng trở lại</h2>
            <p className="text-muted-foreground mt-2">Đăng nhập để quản lý đơn hàng của bạn.</p>
          </div>

          <div className="bg-card p-8 rounded-2xl shadow-xl border border-border/50 space-y-5">
            {authConfig?.googleEnabled && (
              <>
                <Button type="button" variant="outline" className="w-full h-12 gap-3 text-base" onClick={handleGoogleLogin}>
                  <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  Đăng nhập với Google
                </Button>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                  <div className="relative flex justify-center text-xs uppercase text-muted-foreground">
                    <span className="bg-card px-2">hoặc</span>
                  </div>
                </div>
              </>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input placeholder="name@company.com" className="h-11 bg-secondary/50" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Mật khẩu</FormLabel>
                      <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">Quên mật khẩu?</Link>
                    </div>
                    <FormControl>
                      <div className="relative">
                        <Input type={showPass ? "text" : "password"} placeholder="••••••••" className="h-11 bg-secondary/50 pr-10" {...field} />
                        <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </FormControl>
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

                <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={loginMut.isPending}>
                  {loginMut.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Đang đăng nhập...</> : "Đăng nhập"}
                </Button>
              </form>
            </Form>
          </div>

          <p className="text-center text-muted-foreground">
            Chưa có tài khoản?{" "}
            <Link href="/register" className="font-semibold text-primary hover:underline">Đăng ký miễn phí</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
