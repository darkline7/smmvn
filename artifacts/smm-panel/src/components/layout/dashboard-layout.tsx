import React, { useState } from "react";
import { useLocation, Link } from "wouter";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { 
  LayoutDashboard, ShoppingCart, ListOrdered, Layers, 
  Wallet, Receipt, Ticket as TicketIcon, Key, 
  User, Bell, LogOut, Menu, X, Users, Shield, Settings,
  Database, Activity, Volume2, ShieldCheck, CreditCard,
  Zap, Droplets, RefreshCw, UserPlus, Grid3X3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type SidebarItem = {
  title: string;
  href: string;
  icon: React.ElementType;
};

const userNav: SidebarItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Đặt hàng mới", href: "/new-order", icon: ShoppingCart },
  { title: "Lịch sử đơn hàng", href: "/orders", icon: ListOrdered },
  { title: "Bảng giá dịch vụ", href: "/services-list", icon: Layers },
  { title: "Đặt hàng hàng loạt", href: "/mass-order", icon: Zap },
  { title: "Drip Feed", href: "/drip-feed", icon: Droplets },
  { title: "Subscriptions", href: "/subscriptions", icon: RefreshCw },
  { title: "Nạp tiền", href: "/add-funds", icon: Wallet },
  { title: "Lịch sử giao dịch", href: "/transactions", icon: Receipt },
  { title: "Hỗ trợ", href: "/tickets", icon: TicketIcon },
  { title: "API", href: "/api", icon: Key },
  { title: "Giới thiệu", href: "/referrals", icon: UserPlus },
  { title: "Thông báo", href: "/notifications", icon: Bell },
  { title: "Hồ sơ", href: "/profile", icon: User },
];

const adminNav: SidebarItem[] = [
  { title: "Tổng quan", href: "/admin", icon: Activity },
  { title: "Users", href: "/admin/users", icon: Users },
  { title: "Đơn hàng", href: "/admin/orders", icon: ListOrdered },
  { title: "Dịch vụ", href: "/admin/services", icon: Layers },
  { title: "Danh mục", href: "/admin/categories", icon: Database },
  { title: "Providers", href: "/admin/providers", icon: ShieldCheck },
  { title: "Nạp tiền", href: "/admin/payments", icon: CreditCard },
  { title: "Hỗ trợ", href: "/admin/tickets", icon: TicketIcon },
  { title: "Thông báo HT", href: "/admin/announcements", icon: Volume2 },
  { title: "API Logs", href: "/admin/api-logs", icon: Grid3X3 },
  { title: "Cài đặt", href: "/admin/settings", icon: Settings },
];

export function DashboardLayout({ children, isAdminLayout = false }: { children: React.ReactNode, isAdminLayout?: boolean }) {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading } = useGetMe();
  const logoutMut = useLogout();
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auth protection
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
        toast({ title: "Logged out successfully" });
        window.location.href = "/login"; // Hard redirect to clear query cache
      }
    });
  };

  if (isLoading || !user) {
    return <div className="flex h-screen w-full items-center justify-center bg-background"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  const navItems = isAdminLayout ? adminNav : userNav;

  const NavLinks = () => (
    <>
      {navItems.map((item) => {
        const isActive = location === item.href || (item.href !== "/dashboard" && item.href !== "/admin" && location.startsWith(item.href));
        return (
          <Link key={item.href} href={item.href}>
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer ${isActive ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 font-medium' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
              <item.icon className="h-5 w-5" />
              <span>{item.title}</span>
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
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold font-display text-xl shadow-lg shadow-primary/20">
            S
          </div>
          <span className="font-display font-bold tracking-tight text-xl text-foreground">
            SMM <span className="text-primary">Pro</span>
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1 scrollbar-hide">
          <div className="mb-6 px-4 py-3 bg-secondary/50 rounded-xl border border-border/50">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Balance</p>
            <p className="text-2xl font-bold text-foreground font-display">{formatCurrency(user.balance, user.currency)}</p>
          </div>
          
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2 mt-4">
            {isAdminLayout ? 'Administration' : 'Menu'}
          </p>
          <NavLinks />
        </div>

        <div className="p-4 border-t border-border bg-card">
          {user.role === 'admin' && !isAdminLayout && (
            <Link href="/admin">
              <Button variant="outline" className="w-full justify-start mb-2 text-primary border-primary/20">
                <Shield className="mr-2 h-4 w-4" /> Admin Panel
              </Button>
            </Link>
          )}
          {isAdminLayout && (
            <Link href="/dashboard">
              <Button variant="outline" className="w-full justify-start mb-2">
                <User className="mr-2 h-4 w-4" /> Back to App
              </Button>
            </Link>
          )}
          
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-foreground truncate">{user.username}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
          
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Log out
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 w-full overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 bg-card border-b border-border z-20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold">S</div>
            <span className="font-display font-bold text-lg">SMM Pro</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Balance</p>
              <p className="font-bold text-sm text-primary">{formatCurrency(user.balance, user.currency)}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(true)}>
              <Menu className="h-6 w-6" />
            </Button>
          </div>
        </header>

        {/* Top bar for desktop */}
        <header className="hidden md:flex h-16 items-center justify-between px-8 bg-background border-b border-border/50 shrink-0">
          <h1 className="text-xl font-display font-semibold text-foreground capitalize">
            {location.split('/')[location.split('/').length - 1] || 'Dashboard'}
          </h1>
          <div className="flex items-center gap-4">
            <Link href="/notifications">
              <Button variant="ghost" size="icon" className="relative rounded-full">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full"></span>
              </Button>
            </Link>
            <Link href="/profile">
              <Button variant="outline" className="rounded-full gap-2 pl-2">
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <span>Profile</span>
              </Button>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-background p-4 md:p-8 relative">
          {/* Subtle background pattern */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.02]" style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/dashboard-pattern.png)`, backgroundSize: '100px' }} />
          <div className="relative z-10 max-w-7xl mx-auto h-full">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}></div>
          <div className="relative w-[280px] max-w-sm bg-card h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <span className="font-display font-bold text-lg">Menu</span>
              <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              <NavLinks />
            </div>
            <div className="p-4 border-t border-border">
              {user.role === 'admin' && !isAdminLayout && (
                <Link href="/admin">
                  <Button variant="outline" className="w-full justify-start mb-2" onClick={() => setMobileMenuOpen(false)}>
                    <Shield className="mr-2 h-4 w-4" /> Admin Panel
                  </Button>
                </Link>
              )}
              {isAdminLayout && (
                <Link href="/dashboard">
                  <Button variant="outline" className="w-full justify-start mb-2" onClick={() => setMobileMenuOpen(false)}>
                    <User className="mr-2 h-4 w-4" /> Back to App
                  </Button>
                </Link>
              )}
              <Button variant="destructive" className="w-full justify-start" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" /> Log out
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
