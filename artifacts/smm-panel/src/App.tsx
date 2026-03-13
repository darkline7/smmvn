import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

// Public pages
import Home from "./pages/public/home";
import Services from "./pages/public/services";
import ApiDocs from "./pages/public/api-docs";
import Pricing from "./pages/public/pricing";
import FAQ from "./pages/public/faq";

// Auth pages
import Login from "./pages/auth/login";
import Register from "./pages/auth/register";

// User dashboard pages
import Dashboard from "./pages/dashboard/index";
import NewOrder from "./pages/dashboard/new-order";
import Orders from "./pages/dashboard/orders";
import AddFunds from "./pages/dashboard/add-funds";
import Transactions from "./pages/dashboard/transactions";
import Tickets from "./pages/dashboard/tickets";
import ApiKeyPage from "./pages/dashboard/api-key";
import Profile from "./pages/dashboard/profile";
import Notifications from "./pages/dashboard/notifications";
import Referrals from "./pages/dashboard/referrals";
import ServicesList from "./pages/dashboard/services-list";
import MassOrder from "./pages/dashboard/mass-order";
import DripFeed from "./pages/dashboard/drip-feed";
import Subscriptions from "./pages/dashboard/subscriptions";

// Admin pages
import AdminDashboard from "./pages/admin/index";
import AdminUsers from "./pages/admin/users";
import AdminServices from "./pages/admin/services";
import AdminOrders from "./pages/admin/orders";
import AdminPayments from "./pages/admin/payments";
import AdminCategories from "./pages/admin/categories";
import AdminTickets from "./pages/admin/tickets";
import AdminAnnouncements from "./pages/admin/announcements";
import AdminApiLogs from "./pages/admin/api-logs";
import AdminSettings from "./pages/admin/settings";
import AdminProviders from "./pages/admin/providers";

import NotFound from "./pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

function Router() {
  return (
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
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
