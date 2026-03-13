import { Suspense, lazy, useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

// --- Lazy load all pages ---
// Public
const Home = lazy(() => import("./pages/public/home"));
const Services = lazy(() => import("./pages/public/services"));
const ApiDocs = lazy(() => import("./pages/public/api-docs"));
const Pricing = lazy(() => import("./pages/public/pricing"));
const FAQ = lazy(() => import("./pages/public/faq"));

// Auth
const Login = lazy(() => import("./pages/auth/login"));
const Register = lazy(() => import("./pages/auth/register"));

// User dashboard
const Dashboard = lazy(() => import("./pages/dashboard/index"));
const NewOrder = lazy(() => import("./pages/dashboard/new-order"));
const Orders = lazy(() => import("./pages/dashboard/orders"));
const AddFunds = lazy(() => import("./pages/dashboard/add-funds"));
const Transactions = lazy(() => import("./pages/dashboard/transactions"));
const Tickets = lazy(() => import("./pages/dashboard/tickets"));
const ApiKeyPage = lazy(() => import("./pages/dashboard/api-key"));
const Profile = lazy(() => import("./pages/dashboard/profile"));
const Notifications = lazy(() => import("./pages/dashboard/notifications"));
const Referrals = lazy(() => import("./pages/dashboard/referrals"));
const ServicesList = lazy(() => import("./pages/dashboard/services-list"));
const MassOrder = lazy(() => import("./pages/dashboard/mass-order"));
const DripFeed = lazy(() => import("./pages/dashboard/drip-feed"));
const Subscriptions = lazy(() => import("./pages/dashboard/subscriptions"));

// Admin
const AdminDashboard = lazy(() => import("./pages/admin/index"));
const AdminUsers = lazy(() => import("./pages/admin/users"));
const AdminServices = lazy(() => import("./pages/admin/services"));
const AdminOrders = lazy(() => import("./pages/admin/orders"));
const AdminPayments = lazy(() => import("./pages/admin/payments"));
const AdminCategories = lazy(() => import("./pages/admin/categories"));
const AdminTickets = lazy(() => import("./pages/admin/tickets"));
const AdminAnnouncements = lazy(() => import("./pages/admin/announcements"));
const AdminApiLogs = lazy(() => import("./pages/admin/api-logs"));
const AdminSettings = lazy(() => import("./pages/admin/settings"));
const AdminProviders = lazy(() => import("./pages/admin/providers"));

const NotFound = lazy(() => import("./pages/not-found"));

// --- Page loading fallback ---
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Đang tải...</p>
      </div>
    </div>
  );
}

// --- Dynamic Branding: apply logo/favicon from settings ---
function BrandingApplicator() {
  const { data } = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/public/settings`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!data) return;
    // Apply favicon
    if (data.favicon_url) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = data.favicon_url;
    }
    // Apply site title
    if (data.site_name) {
      const current = document.title;
      if (!current.includes(data.site_name)) {
        document.title = data.site_name;
      }
    }
    // Meta description
    if (data.site_description) {
      let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "description";
        document.head.appendChild(meta);
      }
      meta.content = data.site_description;
    }
  }, [data]);

  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        {/* Public */}
        <Route path="/" component={Home} />
        <Route path="/services" component={Services} />
        <Route path="/api-docs" component={ApiDocs} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/faq" component={FAQ} />

        {/* Auth */}
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />

        {/* User Dashboard */}
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/new-order" component={NewOrder} />
        <Route path="/orders" component={Orders} />
        <Route path="/add-funds" component={AddFunds} />
        <Route path="/transactions" component={Transactions} />
        <Route path="/tickets" component={Tickets} />
        <Route path="/api" component={ApiKeyPage} />
        <Route path="/profile" component={Profile} />
        <Route path="/notifications" component={Notifications} />
        <Route path="/referrals" component={Referrals} />
        <Route path="/services-list" component={ServicesList} />
        <Route path="/mass-order" component={MassOrder} />
        <Route path="/drip-feed" component={DripFeed} />
        <Route path="/subscriptions" component={Subscriptions} />

        {/* Admin */}
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/admin/users" component={AdminUsers} />
        <Route path="/admin/services" component={AdminServices} />
        <Route path="/admin/orders" component={AdminOrders} />
        <Route path="/admin/payments" component={AdminPayments} />
        <Route path="/admin/categories" component={AdminCategories} />
        <Route path="/admin/tickets" component={AdminTickets} />
        <Route path="/admin/announcements" component={AdminAnnouncements} />
        <Route path="/admin/api-logs" component={AdminApiLogs} />
        <Route path="/admin/settings" component={AdminSettings} />
        <Route path="/admin/providers" component={AdminProviders} />

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrandingApplicator />
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
