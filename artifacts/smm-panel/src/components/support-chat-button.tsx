import { useState } from "react";
import { X, MessageCircle, Facebook, MessageSquare, Phone, Mail, Globe } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

interface SupportChannel {
  label: string;
  icon: React.ReactNode;
  url?: string;
  text?: string;
  color: string;
}

export function SupportChatButton() {
  const [isOpen, setIsOpen] = useState(false);

  const { data: settings } = useQuery<any>({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/public/settings`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 5 * 60_000,
  });

  const channels: SupportChannel[] = [];

  // Facebook
  if (settings?.fanpage_url) {
    channels.push({
      label: "Facebook",
      icon: <Facebook className="w-5 h-5" />,
      url: settings.fanpage_url,
      color: "from-blue-500 to-blue-600",
    });
  }

  // Zalo
  if (settings?.hotline) {
    channels.push({
      label: "Zalo",
      icon: <MessageSquare className="w-5 h-5" />,
      url: `https://zalo.me/${settings.hotline.replace(/\D/g, "")}`,
      color: "from-sky-400 to-blue-500",
    });
  }

  // Telegram
  if (settings?.telegram_admin_chat_id) {
    channels.push({
      label: "Telegram",
      icon: <MessageCircle className="w-5 h-5" />,
      url: "https://t.me/your_telegram_bot", // User should configure this
      color: "from-cyan-500 to-blue-500",
    });
  }

  // Email
  if (settings?.support_email) {
    channels.push({
      label: "Email",
      icon: <Mail className="w-5 h-5" />,
      text: settings.support_email,
      url: `mailto:${settings.support_email}`,
      color: "from-red-500 to-pink-600",
    });
  }

  // Phone
  if (settings?.hotline) {
    channels.push({
      label: "Hotline",
      icon: <Phone className="w-5 h-5" />,
      text: settings.hotline,
      url: `tel:${settings.hotline.replace(/\D/g, "")}`,
      color: "from-green-500 to-emerald-600",
    });
  }

  // Website
  if (settings?.site_url) {
    channels.push({
      label: "Website",
      icon: <Globe className="w-5 h-5" />,
      url: settings.site_url,
      color: "from-amber-500 to-orange-600",
    });
  }

  if (channels.length === 0) return null;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center group"
        title="Hỗ trợ & Liên hệ"
      >
        <MessageCircle className="w-6 h-6 group-hover:scale-0 transition-transform" />
        <span className="absolute scale-0 group-hover:scale-100 transition-transform font-semibold text-sm">Liên hệ</span>
      </button>

      {/* Modal/Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 animate-in fade-in">
          <Card className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95">
            <div className="p-6 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-lg font-bold">Hỗ trợ & Liên hệ</h3>
                  <p className="text-xs text-muted-foreground">Chọn kênh để liên hệ với chúng tôi</p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Channels Grid */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                {channels.map((channel, idx) => (
                  <a
                    key={idx}
                    href={channel.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`p-4 rounded-xl bg-gradient-to-br ${channel.color} text-white flex flex-col items-center justify-center gap-2 hover:shadow-lg hover:scale-105 transition-all duration-300 group`}
                  >
                    <div className="p-2 bg-white/20 rounded-lg group-hover:bg-white/30 transition-colors">
                      {channel.icon}
                    </div>
                    <span className="text-xs font-semibold text-center">{channel.label}</span>
                    {channel.text && <span className="text-xs opacity-90 truncate">{channel.text}</span>}
                  </a>
                ))}
              </div>

              {/* Info Message */}
              <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground text-center">
                ⏱️ Thời gian phản hồi: 15-30 phút (giờ hành chính)
              </div>

              {/* Close Button */}
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                className="w-full"
              >
                Đóng
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
