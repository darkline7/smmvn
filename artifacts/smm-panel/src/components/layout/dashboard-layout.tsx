import React, { useState } from "react";
import { useLocation, Link } from "wouter";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard, ShoppingCart, ListOrdered, Layers,
  Wallet, Receipt, Ticket as TicketIcon, Key,
  User, Bell, LogOut, Menu, X, Users, Shield, Settings,
  Database, Activity, Volume2, ShieldCheck, CreditCard,
  Zap, UserPlus, Grid3X3, Globe, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type SidebarItem = {
  title: string;
  href: string;
  icon: React.ElementType;
};

const userNav: SidebarItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Lịch sử đơn hàng", href: "/orders", icon: ListOrdered },
  { title: "Bảng giá dịch vụ", href: "/services-list", icon: Layers },
  { title: "Đặt hàng hàng loạt", href: "/mass-order", icon: Zap },
  { title: "Nạp tiền", href: "/add-funds", icon: Wallet },
  { title: "Lịch sử giao dịch", href: "/transactions", icon: Receipt },
  { title: "Hỗ trợ", href: "/tickets", icon: TicketIcon },
  { title: "API", href: "/api", icon: Key },
  { title: "Tạo web con", href: "/subdomains", icon: Grid3X3 },
  { title: "Giới thiệu", href: "/referrals", icon: UserPlus },
  { title: "Thông báo", href: "/notifications", icon: Bell },
  { title: "Hồ sơ", href: "/profile", icon: User },
];

const adminNav: SidebarItem[] = [
  { title: "Tổng quan", href: "/admin", icon: Activity },
  { title: "Người dùng", href: "/admin/users", icon: Users },
  { title: "Đơn hàng", href: "/admin/orders", icon: ListOrdered },
  { title: "Dịch vụ", href: "/admin/services", icon: Layers },
  { title: "Danh mục", href: "/admin/categories", icon: Database },
  { title: "Providers", href: "/admin/providers", icon: ShieldCheck },
  { title: "Nạp tiền", href: "/admin/payments", icon: CreditCard },
  { title: "Hỗ trợ", href: "/admin/tickets", icon: TicketIcon },
  { title: "Web con", href: "/admin/subdomains", icon: Globe },
  { title: "Thông báo HT", href: "/admin/announcements", icon: Volume2 },
  { title: "API Logs", href: "/admin/api-logs", icon: Grid3X3 },
  { title: "Cài đặt", href: "/admin/settings", icon: Settings },
];

const mobileBottomNav = [
  { title: "Trang chủ", href: "/dashboard", icon: LayoutDashboard },
  { title: "Nạp tiền", href: "/add-funds", icon: Wallet },
  { title: "Tạo đơn", href: "/new-order", icon: ShoppingCart, center: true },
  { title: "Đơn hàng", href: "/orders", icon: ListOrdered },
  { title: "Tài khoản", href: "/profile", icon: User },
];

const PAGE_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  orders: "Lịch sử đơn hàng",
  "new-order": "Đặt hàng mới",
  "mass-order": "Đặt hàng hàng loạt",
  "drip-feed": "Drip Feed",
  "services-list": "Bảng giá dịch vụ",
  "add-funds": "Nạp tiền",
  transactions: "Lịch sử giao dịch",
  tickets: "Hỗ trợ",
  api: "Cài đặt API",
  subdomains: "Web con",
  referrals: "Giới thiệu",
  notifications: "Thông báo",
  profile: "Hồ sơ",
  users: "Quản lý người dùng",
  services: "Quản lý dịch vụ",
  categories: "Danh mục",
  providers: "Providers",
  payments: "Nạp tiền",
  settings: "Cài đặt hệ thống",
  announcements: "Thông báo hệ thống",
  "api-logs": "API Logs",
};

function getPageTitle(path: string): string {
  const segments = path.split("/").filter(Boolean);
  const last = segments[segments.length - 1] || "dashboard";
  return PAGE_TITLES[last] || last.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export function DashboardLayout({ children, isAdminLayout = false }: { children: React.ReactNode; isAdminLayout?: boolean }) {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading } = useGetMe();
  const logoutMut = useLogout();
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: pubSettings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/public/settings`);
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: notifData } = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/notifications`, { credentials: "include" });
      if (!res.ok) return { unread: 0 };
      return res.json();
    },
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
    enabled: !!user,
  });

  const unreadCount: number = notifData?.unread || 0;

  const logoUrl: string = pubSettings?.logoUrl || "";
  const siteName: string = pubSettings?.siteName || "SMM Pro";

  React.useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    } else if (!isLoading && user && isAdminLayout && user.role !== "admin") {
      setLocation("/dashboard");
    }
  }, [user, isLoading, setLocation, isAdminLayout]);

  const handleLogout = () => {
    logoutMut.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "Đã đăng xuất thành công" });
        window.location.href = "/login";
      },
    });
  };

  if (isLoading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  const navItems = isAdminLayout ? adminNav : userNav;
  const pageTitle = getPageTitle(location);

  const NavLinks = ({ onClose }: { onClose?: () => void }) => (
    <>
      {navItems.map((item) => {
        const isActive =
          location === item.href ||
          (item.href !== "/dashboard" && item.href !== "/admin" && location.startsWith(item.href));
        return (
          <Link key={item.href} href={item.href} onClick={onClose}>
            <div
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 font-medium"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              <span>{item.title}</span>
              {item.href === "/notifications" && unreadCount > 0 && (
                <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </div>
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-card border-r border-border z-20 flex-shrink-0">
        <div className="p-6 flex items-center gap-3 border-b border-border/50">
          {logoUrl ? (
            <img src={logoUrl} alt={siteName} className="h-9 max-w-[140px] object-contain" />
          ) : (
            <>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold font-display text-xl shadow-lg shadow-primary/20">
                {siteName.charAt(0).toUpperCase()}
              </div>
              <span className="font-display font-bold tracking-tight text-xl text-foreground">
                {siteName.includes(" ") ? (
                  <>
                    {siteName.split(" ")[0]}{" "}
                    <span className="text-primary">{siteName.split(" ").slice(1).join(" ")}</span>
                  </>
                ) : (
                  <span>{siteName}</span>
                )}
              </span>
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-4 space-y-1 scrollbar-hide">
          {/* Balance card */}
          <div className="mb-4 px-4 py-3 bg-secondary/50 rounded-xl border border-border/50">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Số dư</p>
            <p className="text-2xl font-bold text-foreground font-display">{formatCurrency(user.balance, user.currency)}</p>
          </div>

          {/* New Order CTA — only for user layout */}
          {!isAdminLayout && (
            <Link href="/new-order">
              <Button className="w-full mb-3 gap-2 shadow-md shadow-primary/20 rounded-xl h-10">
                <Plus className="h-4 w-4" /> Tạo đơn hàng mới
              </Button>
            </Link>
          )}

          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2 mt-2">
            {isAdminLayout ? "Quản trị" : "Menu"}
          </p>
          <NavLinks />
        </div>

        <div className="p-4 border-t border-border bg-card">
          {user.role === "admin" && !isAdminLayout && (
            <Link href="/admin">
              <Button variant="outline" className="w-full justify-start mb-2 text-primary border-primary/20">
                <Shield className="mr-2 h-4 w-4" /> Admin Panel
              </Button>
            </Link>
          )}
          {isAdminLayout && (
            <Link href="/dashboard">
              <Button variant="outline" className="w-full justify-start mb-2">
                <User className="mr-2 h-4 w-4" /> Về trang người dùng
              </Button>
            </Link>
          )}
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-foreground truncate">{user.username}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" /> Đăng xuất
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 w-full overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-border z-20">
          <div className="flex items-center gap-2">
            {logoUrl ? (
              <img src={logoUrl} alt={siteName} className="h-8 max-w-[120px] object-contain" />
            ) : (
              <>
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold">
                  {siteName.charAt(0).toUpperCase()}
                </div>
                <span className="font-display font-bold text-base">{siteName}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground leading-none">Số dư</p>
              <p className="font-bold text-sm text-primary leading-tight">{formatCurrency(user.balance, user.currency)}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMobileMenuOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* Desktop Topbar */}
        <header className="hidden md:flex h-16 items-center justify-between px-8 bg-background border-b border-border/50 shrink-0">
          <h1 className="text-xl font-display font-semibold text-foreground">{pageTitle}</h1>
          <div className="flex items-center gap-4">
            <Link href="/notifications">
              <Button variant="ghost" size="icon" className="relative rounded-full">
                <Bell className="h-5 w-5 text-muted-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>
            </Link>
            <Link href="/profile">
              <Button variant="outline" className="rounded-full gap-2 pl-2">
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <span>{user.username}</span>
              </Button>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-background p-4 md:p-8 pb-24 md:pb-8 relative">
          <div className="relative z-10 max-w-7xl mx-auto">{children}</div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      {!isAdminLayout && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border/60 safe-area-bottom shadow-xl">
          <div className="flex items-stretch h-16">
            {mobileBottomNav.map((item) => {
              const isActive =
                location === item.href ||
                (item.href !== "/dashboard" && location.startsWith(item.href));
              if (item.center) {
                return (
                  <Link key={item.href} href={item.href} className="flex-1 flex items-center justify-center">
                    <div
                      className={cn(
                        "w-14 h-14 -mt-5 rounded-full flex flex-col items-center justify-center shadow-lg shadow-primary/30 transition-transform active:scale-95",
                        "bg-gradient-to-br from-primary to-accent text-primary-foreground"
                      )}
                    >
                      <item.icon className="w-6 h-6" />
                    </div>
                  </Link>
                );
              }
              return (
                <Link key={item.href} href={item.href} className="flex-1">
                  <div
                    className={cn(
                      "h-full flex flex-col items-center justify-center gap-1 transition-colors relative",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    <div className="relative">
                      <item.icon className={cn("w-5 h-5", isActive && "drop-shadow-sm")} />
                      {item.href === "/notifications" && unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-destructive rounded-full border border-card" />
                      )}
                    </div>
                    <span className="text-[10px] font-medium leading-none">{item.title}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-[280px] max-w-sm bg-card h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <span className="font-display font-bold text-lg">Menu</span>
              <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            {!isAdminLayout && (
              <div className="px-4 pt-4">
                <Link href="/new-order" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full gap-2 mb-2 rounded-xl">
                    <Plus className="h-4 w-4" /> Tạo đơn hàng mới
                  </Button>
                </Link>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              <NavLinks onClose={() => setMobileMenuOpen(false)} />
            </div>
            <div className="p-4 border-t border-border">
              {user.role === "admin" && !isAdminLayout && (
                <Link href="/admin">
                  <Button
                    variant="outline"
                    className="w-full justify-start mb-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Shield className="mr-2 h-4 w-4" /> Admin Panel
                  </Button>
                </Link>
              )}
              {isAdminLayout && (
                <Link href="/dashboard">
                  <Button
                    variant="outline"
                    className="w-full justify-start mb-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <User className="mr-2 h-4 w-4" /> Về trang người dùng
                  </Button>
                </Link>
              )}
              <Button variant="destructive" className="w-full justify-start" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" /> Đăng xuất
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
