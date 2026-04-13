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
        />
        <Route
          path="client"
          element={
            <RequireRole allowed={["CLIENT_ADMIN"]}>
              <ClientConsole />
            </RequireRole>
          }
        />
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
