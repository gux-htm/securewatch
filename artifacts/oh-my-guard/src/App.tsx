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
import Alerts from "@/pages/Alerts";
import Sessions from "@/pages/Sessions";
import Accounts from "@/pages/Accounts";
import Groups from "@/pages/Groups";
import Zones from "@/pages/Zones";
import Resources from "@/pages/Resources";
import Integrations from "@/pages/Integrations";
import Settings from "@/pages/Settings";
import EndDevicePortal from "@/pages/EndDevicePortal";
import DeviceRegistrationPage from "@/pages/DeviceRegistrationPage";
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
    <Switch>
      {/* Public routes — no admin shell */}
      <Route path="/register" component={DeviceRegistrationPage} />
      <Route path="/portal" component={EndDevicePortal} />

      {/* Admin shell routes */}
      <Route>
        <Layout>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/alerts" component={Alerts} />
            <Route path="/sessions" component={Sessions} />
            <Route path="/devices" component={Devices} />
            <Route path="/networks" component={Networks} />
            <Route path="/zones" component={Zones} />
            <Route path="/firewall" component={Firewall} />
            <Route path="/ids" component={IdsIps} />
            <Route path="/files" component={FileMonitor} />
            <Route path="/resources" component={Resources} />
            <Route path="/audit" component={AuditLogs} />
            <Route path="/accounts" component={Accounts} />
            <Route path="/groups" component={Groups} />
            <Route path="/policies" component={Policies} />
            <Route path="/integrations" component={Integrations} />
            <Route path="/settings" component={Settings} />
            <Route path="/end-device" component={EndDevicePortal} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
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
