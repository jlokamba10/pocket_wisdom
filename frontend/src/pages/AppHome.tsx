import { Navigate } from "react-router-dom";
import { useAuth } from "../state/auth";

export default function AppHome() {
  const { user } = useAuth();
  if (!user) {
    return null;
  }

  if (user.role === "SYSTEM_ADMIN") {
    return <Navigate to="/app/system/overview" replace />;
  }

  if (user.role === "CLIENT_ADMIN") {
    return <Navigate to="/app/client/overview" replace />;
  }

  if (user.role === "SUPERVISOR") {
    return <Navigate to="/app/supervisor/overview" replace />;
  }

  if (user.role === "ENGINEER") {
    return <Navigate to="/app/engineer/overview" replace />;
  }

  if (user.role === "TECHNICIAN") {
    return <Navigate to="/app/technician/overview" replace />;
  }

  return (
    <section className="page">
      <div className="page-header">
        <h1>Welcome back, {user.full_name}.</h1>
        <p>
          Your workspace is ready. Use the console navigation to monitor assets, alerts, and dashboards.
        </p>
      </div>

      <div className="card-grid">
        <div className="card">
          <h3>Your Role</h3>
          <p>{user.role}</p>
        </div>
        <div className="card">
          <h3>Tenant</h3>
          <p>{user.tenant?.name || "Platform Admin"}</p>
        </div>
        <div className="card">
          <h3>Status</h3>
          <p>{user.status}</p>
        </div>
      </div>
    </section>
  );
}
