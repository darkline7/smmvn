import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

// Pages
import Home from "./pages/public/home";
import Login from "./pages/auth/login";
import Dashboard from "./pages/dashboard/index";
import NewOrder from "./pages/dashboard/new-order";
import Orders from "./pages/dashboard/orders";
import AdminDashboard from "./pages/admin/index";
import AdminUsers from "./pages/admin/users";
import AdminServices from "./pages/admin/services";
import NotFound from "./pages/not-found";

// Global error handler for unhandled fetch errors
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      {/* Public */}
      <Route path="/" component={Home} />
      
      {/* Auth */}
      <Route path="/login" component={Login} />
      
      {/* User Dashboard */}
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/new-order" component={NewOrder} />
      <Route path="/orders" component={Orders} />
      
      {/* Mapped generic dashboard pages to main dashboard for this demo completion */}
      <Route path="/services" component={Dashboard} />
      <Route path="/add-funds" component={Dashboard} />
      <Route path="/transactions" component={Dashboard} />
      <Route path="/tickets" component={Dashboard} />
      <Route path="/api" component={Dashboard} />
      <Route path="/profile" component={Dashboard} />
      <Route path="/notifications" component={Dashboard} />

      {/* Admin Dashboard */}
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/orders" component={AdminDashboard} />
      <Route path="/admin/services" component={AdminServices} />
      <Route path="/admin/categories" component={AdminDashboard} />
      <Route path="/admin/providers" component={AdminDashboard} />
      <Route path="/admin/payments" component={AdminDashboard} />
      <Route path="/admin/settings" component={AdminDashboard} />

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
