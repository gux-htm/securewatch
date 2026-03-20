import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Inbox from './pages/Inbox';
import Sessions from './pages/Sessions';
import Resources from './pages/Resources';
import Integrations from './pages/Integrations';
import Accounts from './pages/Accounts';
import AuditLog from './pages/AuditLog';
import FileEventHistory from './pages/FileEventHistory';
import Devices from './pages/Devices';
import Zones from './pages/Zones';
import Groups from './pages/Groups';
import Settings from './pages/Settings';
import { useAuthStore } from './stores/useAuthStore';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/inbox" replace />} />
          <Route path="inbox"        element={<Inbox />} />
          <Route path="sessions"     element={<Sessions />} />
          <Route path="resources"    element={<Resources />} />
          <Route path="resources/:resourceId/events" element={<FileEventHistory />} />
          <Route path="integrations" element={<Integrations />} />
          <Route path="accounts"     element={<Accounts />} />
          <Route path="devices"      element={<Devices />} />
          <Route path="zones"        element={<Zones />} />
          <Route path="groups"       element={<Groups />} />
          <Route path="audit-log"    element={<AuditLog />} />
          <Route path="settings"     element={<Settings />} />
        </Route>
        {/* Catch-all → login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
