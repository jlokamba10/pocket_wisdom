import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./pages/AppShell";
import AppHome from "./pages/AppHome";
import ClientConsole from "./pages/ClientConsole";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import SupervisorConsole from "./pages/supervisor/SupervisorConsole";
import SupervisorOverview from "./pages/supervisor/SupervisorOverview";
import SupervisorTeam from "./pages/supervisor/SupervisorTeam";
import SupervisorEquipment from "./pages/supervisor/SupervisorEquipment";
import SupervisorSensors from "./pages/supervisor/SupervisorSensors";
import SupervisorAlerts from "./pages/supervisor/SupervisorAlerts";
import SupervisorDashboardTemplates from "./pages/supervisor/SupervisorDashboardTemplates";
import EngineerConsole from "./pages/engineer/EngineerConsole";
import EngineerOverview from "./pages/engineer/EngineerOverview";
import EngineerEquipment from "./pages/engineer/EngineerEquipment";
import EngineerAlerts from "./pages/engineer/EngineerAlerts";
import EngineerDashboards from "./pages/engineer/EngineerDashboards";
import TechnicianConsole from "./pages/technician/TechnicianConsole";
import TechnicianOverview from "./pages/technician/TechnicianOverview";
import TechnicianEquipment from "./pages/technician/TechnicianEquipment";
import TechnicianAlerts from "./pages/technician/TechnicianAlerts";
import TechnicianDashboards from "./pages/technician/TechnicianDashboards";
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
import SystemDashboardAssignments from "./pages/system/SystemDashboardAssignments";
import SystemHealth from "./pages/system/SystemHealth";
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
          <Route path="dashboard-assignments" element={<SystemDashboardAssignments />} />
          <Route path="audit" element={<SystemAudit />} />
          <Route path="health" element={<SystemHealth />} />
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
          path="supervisor"
          element={
            <RequireRole allowed={["SUPERVISOR"]}>
              <SupervisorConsole />
            </RequireRole>
          }
        >
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<SupervisorOverview />} />
          <Route path="team" element={<SupervisorTeam />} />
          <Route path="equipment" element={<SupervisorEquipment />} />
          <Route path="sensors" element={<SupervisorSensors />} />
          <Route path="alerts" element={<SupervisorAlerts />} />
          <Route path="dashboard-templates" element={<SupervisorDashboardTemplates />} />
        </Route>
        <Route
          path="engineer"
          element={
            <RequireRole allowed={["ENGINEER"]}>
              <EngineerConsole />
            </RequireRole>
          }
        >
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<EngineerOverview />} />
          <Route path="equipment" element={<EngineerEquipment />} />
          <Route path="alerts" element={<EngineerAlerts />} />
          <Route path="dashboards" element={<EngineerDashboards />} />
        </Route>
        <Route
          path="technician"
          element={
            <RequireRole allowed={["TECHNICIAN"]}>
              <TechnicianConsole />
            </RequireRole>
          }
        >
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<TechnicianOverview />} />
          <Route path="equipment" element={<TechnicianEquipment />} />
          <Route path="alerts" element={<TechnicianAlerts />} />
          <Route path="dashboards" element={<TechnicianDashboards />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
