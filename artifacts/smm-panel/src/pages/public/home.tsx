import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, ShieldCheck, BarChart3, Clock, Star, Users, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export default function Home() {
  const { data: settings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/public/settings`);
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 5 * 60_000,
  });

  const siteName = settings?.siteName || "SMM Pro";
  const logoUrl = settings?.logoUrl || "";

  return (
    <div className="min-h-screen bg-background font-sans selection:bg-primary/20 selection:text-primary">

      {/* Navbar */}
      <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img src={logoUrl} alt={siteName} className="h-9 object-contain" onError={e => (e.currentTarget.style.display = "none")} />
              ) : (
                <>
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-primary/30">S</div>
                  <span className="font-display font-bold text-xl tracking-tight text-foreground">{siteName}</span>
                </>
              )}
            </div>
            <nav className="hidden md:flex gap-8">
              <Link href="/services" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Dịch vụ</Link>
              <Link href="/api-docs" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">API</Link>
              <Link href="/pricing" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Bảng giá</Link>
              <Link href="/faq" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">FAQ</Link>
            </nav>
            <div className="flex items-center gap-3">
              <Link href="/login">
                <Button variant="ghost" className="text-sm font-semibold hidden sm:inline-flex">Đăng nhập</Button>
              </Link>
              <Link href="/register">
                <Button className="text-sm font-semibold shadow-md shadow-primary/20 px-5 rounded-xl">Đăng ký miễn phí</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 lg:pt-44 lg:pb-32 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-2/3 h-[600px] bg-primary/5 rounded-full blur-[140px] -z-10 translate-x-1/3 -translate-y-1/4"></div>
        <div className="absolute bottom-0 left-0 w-1/2 h-[400px] bg-violet-500/10 rounded-full blur-[100px] -z-10 -translate-x-1/3 translate-y-1/4"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium bg-primary/10 text-primary mb-8 border border-primary/20">
            <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></span>
            API V2 đã ra mắt — Nhanh hơn bao giờ hết
          </div>
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-display font-extrabold tracking-tight text-foreground max-w-4xl mx-auto leading-[1.1]">
            Tăng tương tác mạng xã hội{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-violet-500">tự động.</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Nền tảng SMM Panel hàng đầu Việt Nam — Hàng trăm dịch vụ tăng follower, like, view tự động 24/7. Thanh toán VND qua chuyển khoản ngân hàng.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/register">
              <Button size="lg" className="h-13 px-8 text-base w-full sm:w-auto shadow-xl shadow-primary/30 hover:scale-105 transition-transform duration-300 rounded-xl">
                Tạo tài khoản miễn phí <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/services">
              <Button size="lg" variant="outline" className="h-13 px-8 text-base w-full sm:w-auto rounded-xl">
                Xem bảng giá
              </Button>
            </Link>
          </div>
          {/* Social proof */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>Thanh toán VND tự động</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>Xử lý 24/7</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>API V2 đầy đủ</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>Hỗ trợ qua Zalo/Telegram</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats banner */}
      <section className="py-10 border-y border-border/40 bg-secondary/20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: "10,000+", label: "Đơn hàng mỗi ngày" },
              { value: "500+", label: "Dịch vụ sẵn có" },
              { value: "99.9%", label: "Uptime đảm bảo" },
              { value: "24/7", label: "Hỗ trợ tận tâm" },
            ].map(s => (
              <div key={s.label}>
                <p className="text-3xl font-bold font-display text-foreground">{s.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 sm:py-28 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-5xl font-display font-bold text-foreground">Tại sao chọn {siteName}?</h2>
            <p className="mt-4 text-lg text-muted-foreground">Được thiết kế cho tốc độ, độ tin cậy và quy mô lớn.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Zap, color: "text-yellow-500 bg-yellow-500/10",
                title: "Xử lý tức thì",
                desc: "Đặt hàng được xử lý tự động ngay lập tức. Không cần chờ đợi, không cần phê duyệt thủ công.",
              },
              {
                icon: ShieldCheck, color: "text-green-500 bg-green-500/10",
                title: "An toàn & Bảo mật",
                desc: "Bảo mật SSL 100%. Dữ liệu tài khoản được mã hóa. Thanh toán an toàn qua ngân hàng Việt Nam.",
              },
              {
                icon: BarChart3, color: "text-blue-500 bg-blue-500/10",
                title: "Theo dõi thời gian thực",
                desc: "Theo dõi trạng thái đơn hàng theo thời gian thực. Dashboard trực quan, dễ sử dụng.",
              },
              {
                icon: Clock, color: "text-purple-500 bg-purple-500/10",
                title: "Hoạt động 24/7",
                desc: "Hệ thống hoạt động liên tục 24/7, 365 ngày. Đặt hàng bất kỳ lúc nào, bất kỳ đâu.",
              },
              {
                icon: Users, color: "text-pink-500 bg-pink-500/10",
                title: "Dành cho Reseller",
                desc: "API V2 đầy đủ để tích hợp và bán lại. Giá sỉ hấp dẫn, hỗ trợ nhiều tỉ giá.",
              },
              {
                icon: Star, color: "text-orange-500 bg-orange-500/10",
                title: "Dịch vụ chất lượng cao",
                desc: "Kết nối trực tiếp với các nhà cung cấp hàng đầu thế giới. Chất lượng cao, tỉ lệ hoàn thành tốt.",
              },
            ].map(f => (
              <div key={f.title} className="bg-card p-7 rounded-2xl shadow-sm border border-border/60 hover:-translate-y-1 transition-transform duration-300">
                <div className={`w-12 h-12 ${f.color} rounded-xl flex items-center justify-center mb-5`}>
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platforms Section */}
      <section className="py-16 bg-secondary/20 border-y border-border/40">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-4xl font-display font-bold mb-4">Hỗ trợ tất cả nền tảng lớn</h2>
          <p className="text-muted-foreground mb-10">Từ Instagram, Facebook, TikTok đến YouTube, Telegram và nhiều hơn nữa</p>
          <div className="flex flex-wrap justify-center gap-4">
            {["📸 Instagram", "👤 Facebook", "🎵 TikTok", "▶️ YouTube", "✈️ Telegram", "🐦 Twitter/X", "🎧 Spotify", "💬 Discord", "🎮 Twitch", "⚡ Kick"].map(p => (
              <span key={p} className="px-4 py-2 bg-background border border-border/60 rounded-full text-sm font-medium shadow-sm">{p}</span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 sm:py-28">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-5xl font-display font-bold text-foreground mb-6">
            Sẵn sàng bắt đầu?
          </h2>
          <p className="text-lg text-muted-foreground mb-10">
            Đăng ký miễn phí, nạp tiền và đặt hàng ngay trong vài phút. Không cần thẻ tín dụng.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="h-13 px-10 text-base shadow-xl shadow-primary/30 hover:scale-105 transition-transform rounded-xl w-full sm:w-auto">
                Tạo tài khoản ngay <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="h-13 px-8 text-base rounded-xl w-full sm:w-auto">
                Đăng nhập
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-10 bg-secondary/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-sm">S</div>
              <span className="font-display font-bold text-lg">{siteName}</span>
            </div>
            <nav className="flex flex-wrap gap-6 text-sm text-muted-foreground justify-center">
              <Link href="/services" className="hover:text-foreground transition-colors">Dịch vụ</Link>
              <Link href="/api-docs" className="hover:text-foreground transition-colors">API</Link>
              <Link href="/pricing" className="hover:text-foreground transition-colors">Bảng giá</Link>
              <Link href="/faq" className="hover:text-foreground transition-colors">FAQ</Link>
              <Link href="/login" className="hover:text-foreground transition-colors">Đăng nhập</Link>
            </nav>
            <p className="text-xs text-muted-foreground">
              {settings?.copyrightLeft || `© 2025 ${siteName}. All rights reserved.`}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
