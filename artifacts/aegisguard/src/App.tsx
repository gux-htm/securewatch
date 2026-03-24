import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

// Layout & Pages
import { Layout } from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Devices from "@/pages/Devices";
import Networks from "@/pages/Networks";
import Firewall from "@/pages/Firewall";
import IdsIps from "@/pages/IdsIps";
import FileMonitor from "@/pages/FileMonitor";
import AuditLogs from "@/pages/AuditLogs";
import Policies from "@/pages/Policies";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/devices" component={Devices} />
        <Route path="/networks" component={Networks} />
        <Route path="/firewall" component={Firewall} />
        <Route path="/ids" component={IdsIps} />
        <Route path="/files" component={FileMonitor} />
        <Route path="/audit" component={AuditLogs} />
        <Route path="/policies" component={Policies} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
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
