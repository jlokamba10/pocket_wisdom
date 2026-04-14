import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./pages/AppShell";
import AppHome from "./pages/AppHome";
import ClientConsole from "./pages/ClientConsole";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import OpsConsole from "./pages/OpsConsole";
import ProfilePage from "./pages/ProfilePage";
import SystemConsole from "./pages/SystemConsole";
import UnauthorizedPage from "./pages/UnauthorizedPage";
import RequireAuth from "./state/RequireAuth";
import RequireRole from "./state/RequireRole";
import SystemOverview from "./pages/system/SystemOverview";
import SystemClients from "./pages/system/SystemClients";
import SystemClientDetail from "./pages/system/SystemClientDetail";
import SystemUsers from "./pages/system/SystemUsers";
import SystemTemplates from "./pages/system/SystemTemplates";
import SystemAudit from "./pages/system/SystemAudit";
import ClientOverview from "./pages/client/ClientOverview";
import ClientUsers from "./pages/client/ClientUsers";
import ClientSites from "./pages/client/ClientSites";
import ClientEquipment from "./pages/client/ClientEquipment";
import ClientSensors from "./pages/client/ClientSensors";
import ClientAlerts from "./pages/client/ClientAlerts";
import ClientDashboards from "./pages/client/ClientDashboards";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<AppHome />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route
          path="system"
          element={
            <RequireRole allowed={["SYSTEM_ADMIN"]}>
              <SystemConsole />
            </RequireRole>
          }
        >
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<SystemOverview />} />
          <Route path="clients" element={<SystemClients />} />
          <Route path="clients/:id" element={<SystemClientDetail />} />
          <Route path="users" element={<SystemUsers />} />
          <Route path="dashboard-templates" element={<SystemTemplates />} />
          <Route path="audit" element={<SystemAudit />} />
        </Route>
        <Route
          path="client"
          element={
            <RequireRole allowed={["CLIENT_ADMIN"]}>
              <ClientConsole />
            </RequireRole>
          }
        >
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<ClientOverview />} />
          <Route path="users" element={<ClientUsers />} />
          <Route path="sites" element={<ClientSites />} />
          <Route path="equipment" element={<ClientEquipment />} />
          <Route path="sensors" element={<ClientSensors />} />
          <Route path="alerts" element={<ClientAlerts />} />
          <Route path="dashboards" element={<ClientDashboards />} />
        </Route>
        <Route
          path="ops"
          element={
            <RequireRole allowed={["SUPERVISOR", "ENGINEER", "TECHNICIAN"]}>
              <OpsConsole />
            </RequireRole>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
