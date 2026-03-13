import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Layers, Zap, Globe, Shield, Headphones, BarChart3 } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: "Miễn phí",
    description: "Bắt đầu trải nghiệm dịch vụ",
    features: ["100+ dịch vụ", "Đặt hàng thủ công", "API v2 cơ bản", "Hỗ trợ ticket", "Số dư tối thiểu $1"],
    cta: "Bắt đầu miễn phí",
    href: "/register",
    popular: false,
    color: "border-border",
  },
  {
    name: "Business",
    price: "$0 / tháng",
    description: "Trả theo đơn hàng, không phí cố định",
    features: ["500+ dịch vụ cao cấp", "Drip Feed & Mass Order", "API v2 đầy đủ", "Ưu tiên hỗ trợ 24/7", "Tỉ giá tốt nhất", "Refill & Cancel tự động", "Dashboard analytics"],
    cta: "Đăng ký ngay",
    href: "/register",
    popular: true,
    color: "border-primary ring-2 ring-primary/30",
  },
  {
    name: "Reseller",
    price: "Liên hệ",
    description: "Cho các nhà phân phối",
    features: ["Giá wholesale đặc biệt", "API không giới hạn", "White-label tùy chọn", "Quản lý sub-reseller", "Hỗ trợ kỹ thuật riêng", "Credit 24h", "SLA đảm bảo"],
    cta: "Liên hệ chúng tôi",
    href: "/login",
    popular: false,
    color: "border-border",
  },
];

const features = [
  { icon: Zap, title: "Tự động 24/7", desc: "Đơn hàng được xử lý tức thì, không cần can thiệp thủ công" },
  { icon: Shield, title: "Bảo mật cao", desc: "SSL, mã hóa dữ liệu, và bảo vệ tài khoản đa lớp" },
  { icon: Globe, title: "API v2 chuẩn quốc tế", desc: "Tương thích với mọi phần mềm quản lý SMM panel" },
  { icon: Headphones, title: "Hỗ trợ 24/7", desc: "Đội ngũ hỗ trợ sẵn sàng giải quyết mọi vấn đề của bạn" },
  { icon: BarChart3, title: "Báo cáo chi tiết", desc: "Theo dõi tất cả đơn hàng và giao dịch trong thời gian thực" },
  { icon: Layers, title: "500+ dịch vụ", desc: "Instagram, TikTok, YouTube, Facebook, Twitter và nhiều nền tảng khác" },
];

export default function Pricing() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center"><Layers className="w-4 h-4 text-white" /></div>
            SMM Pro
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login"><Button variant="ghost" size="sm">Đăng nhập</Button></Link>
            <Link href="/register"><Button size="sm">Bắt đầu</Button></Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4 text-primary border-primary/30">Minh bạch - Không phí ẩn</Badge>
          <h1 className="text-5xl font-bold mb-4">Giá cả đơn giản</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Không phí đăng ký, không phí hàng tháng. Chỉ trả tiền cho dịch vụ bạn sử dụng.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-20">
          {plans.map(plan => (
            <div key={plan.name} className={`relative rounded-2xl border p-8 bg-card shadow-sm flex flex-col ${plan.color}`}>
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground shadow-lg shadow-primary/30 px-4">⭐ Phổ biến nhất</Badge>
                </div>
              )}
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <div className="mb-2">
                  <span className="text-3xl font-bold">{plan.price}</span>
                </div>
                <p className="text-muted-foreground text-sm mb-6">{plan.description}</p>
                <ul className="space-y-3">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-3 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Link href={plan.href} className="mt-8">
                <Button className="w-full" variant={plan.popular ? "default" : "outline"} size="lg">{plan.cta}</Button>
              </Link>
            </div>
          ))}
        </div>

        <div>
          <h2 className="text-3xl font-bold text-center mb-10">Tất cả đều bao gồm</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4 p-5 rounded-xl border bg-card hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{title}</h3>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-20 text-center">
          <h2 className="text-3xl font-bold mb-3">Bắt đầu ngay hôm nay</h2>
          <p className="text-muted-foreground mb-6">Tạo tài khoản miễn phí. Không cần thẻ tín dụng.</p>
          <Link href="/register"><Button size="lg" className="gap-2">Tạo tài khoản miễn phí →</Button></Link>
        </div>
      </div>
    </div>
  );
}
