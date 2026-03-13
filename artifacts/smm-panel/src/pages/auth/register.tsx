import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRegister } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Layers, Eye, EyeOff } from "lucide-react";

const registerSchema = z.object({
  username: z.string().min(3, "Username phải ít nhất 3 ký tự").max(30).regex(/^[a-zA-Z0-9_]+$/, "Chỉ dùng chữ, số, gạch dưới"),
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
  confirmPassword: z.string(),
  referralCode: z.string().optional(),
}).refine(d => d.password === d.confirmPassword, { message: "Mật khẩu xác nhận không khớp", path: ["confirmPassword"] });

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const registerMut = useRegister();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: "", email: "", password: "", confirmPassword: "", referralCode: "" },
  });

  const onSubmit = (values: z.infer<typeof registerSchema>) => {
    registerMut.mutate({ data: { username: values.username, email: values.email, password: values.password } }, {
      onSuccess: () => {
        toast({ title: "Đăng ký thành công!", description: "Chào mừng bạn đến với SMM Pro." });
        setLocation("/dashboard");
      },
      onError: (err: any) => {
        toast({ title: "Đăng ký thất bại", description: err?.message || "Email hoặc username đã tồn tại", variant: "destructive" });
      },
    });
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800 flex-col justify-between p-12 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMwLTkuOTQtOC4wNi0xOC0xOC0xOCIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9Ii4wNSIgc3Ryb2tlLXdpZHRoPSIyIi8+PC9nPjwvc3ZnPg==')] opacity-20"></div>
        <div className="relative">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold">SMM Pro</span>
          </Link>
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
          © 2025 SMM Pro. All rights reserved.
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold">SMM Pro</span>
          </div>

          <div>
            <h1 className="text-3xl font-bold text-foreground">Tạo tài khoản</h1>
            <p className="text-muted-foreground mt-2">Bắt đầu tăng trưởng mạng xã hội của bạn ngay hôm nay.</p>
          </div>

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
                      <Input type={showPassword ? "text" : "password"} placeholder="Tối thiểu 6 ký tự" {...field} />
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
              <Button type="submit" className="w-full h-11" disabled={registerMut.isPending}>
                {registerMut.isPending ? "Đang tạo tài khoản..." : "Tạo tài khoản miễn phí"}
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
