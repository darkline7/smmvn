import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Layers, ChevronDown, ChevronUp } from "lucide-react";

const faqs = [
  {
    q: "SMM Panel là gì?",
    a: "SMM Panel (Social Media Marketing Panel) là nền tảng cung cấp dịch vụ tăng tương tác mạng xã hội như followers, likes, views, comments... tự động và nhanh chóng. Phù hợp cho cá nhân và doanh nghiệp muốn tăng độ phủ thương hiệu."
  },
  {
    q: "Các dịch vụ có an toàn không?",
    a: "Chúng tôi cung cấp dịch vụ từ các nguồn uy tín, đảm bảo an toàn cho tài khoản của bạn. Tuy nhiên, việc sử dụng dịch vụ theo đúng giới hạn của từng nền tảng là trách nhiệm của người dùng."
  },
  {
    q: "Đơn hàng mất bao lâu để hoàn thành?",
    a: "Tùy theo dịch vụ, hầu hết đơn hàng bắt đầu xử lý trong vài phút đến 24 giờ. Một số dịch vụ đặc biệt có thể mất vài ngày để hoàn thành hoàn toàn."
  },
  {
    q: "Nạp tiền như thế nào?",
    a: "Hỗ trợ chuyển khoản ngân hàng Việt Nam (MB Bank). Sau khi chuyển khoản với đúng nội dung, hệ thống SePay sẽ tự động xác nhận và cộng tiền vào tài khoản trong 1-5 phút, hoạt động 24/7."
  },
  {
    q: "Tôi có thể hoàn tiền không?",
    a: "Chúng tôi hỗ trợ hoàn tiền cho các đơn hàng không hoàn thành hoặc lỗi kỹ thuật. Số dư sẽ được cộng lại vào tài khoản của bạn. Không hoàn tiền mặt."
  },
  {
    q: "API v2 hoạt động như thế nào?",
    a: "API v2 cho phép bạn tích hợp tất cả dịch vụ vào website hoặc phần mềm của mình. Hỗ trợ các action: services, add, status, balance, refill, cancel. Xem tài liệu API đầy đủ tại /api-docs."
  },
  {
    q: "Dịch vụ refill là gì?",
    a: "Refill là tính năng tự động bổ sung số lượng nếu dịch vụ bị giảm sau khi hoàn thành. Ví dụ nếu mua 1000 followers nhưng sau đó bị giảm, hệ thống sẽ tự động bổ sung lại miễn phí trong thời gian bảo hành."
  },
  {
    q: "Có hỗ trợ Drip Feed không?",
    a: "Có! Drip Feed cho phép chia nhỏ đơn hàng thành nhiều đợt theo lịch cố định, giúp tăng trưởng trông tự nhiên hơn và ít bị phát hiện hơn bởi các thuật toán."
  },
  {
    q: "Làm sao để trở thành reseller?",
    a: "Đăng ký tài khoản, nạp tiền và sử dụng API v2 để tạo panel riêng của bạn. Reseller nhận giá ưu đãi hơn người dùng thông thường. Liên hệ admin để được hỗ trợ."
  },
  {
    q: "Quên mật khẩu phải làm sao?",
    a: "Nhấn vào 'Quên mật khẩu' trên trang đăng nhập, nhập email đã đăng ký và làm theo hướng dẫn được gửi vào hộp thư của bạn."
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-xl overflow-hidden transition-shadow hover:shadow-sm">
      <button className="w-full text-left flex items-center justify-between p-5 gap-4 font-medium" onClick={() => setOpen(!open)}>
        <span>{q}</span>
        {open ? <ChevronUp className="w-5 h-5 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />}
      </button>
      {open && <div className="px-5 pb-5 text-muted-foreground leading-relaxed text-sm border-t bg-muted/20 pt-4">{a}</div>}
    </div>
  );
}

export default function FAQ() {
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

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-3">Câu hỏi thường gặp</h1>
          <p className="text-muted-foreground text-lg">Tìm câu trả lời cho các thắc mắc phổ biến nhất</p>
        </div>

        <div className="space-y-3">
          {faqs.map(({ q, a }) => <FaqItem key={q} q={q} a={a} />)}
        </div>

        <div className="mt-12 text-center p-8 rounded-2xl bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20 border">
          <h2 className="text-2xl font-bold mb-2">Vẫn còn thắc mắc?</h2>
          <p className="text-muted-foreground mb-5">Đội ngũ hỗ trợ 24/7 sẵn sàng giải đáp</p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/login"><Button variant="outline" size="lg">Tạo ticket hỗ trợ</Button></Link>
            <Link href="/register"><Button size="lg">Đăng ký miễn phí →</Button></Link>
          </div>
        </div>
      </div>
    </div>
  );
}
