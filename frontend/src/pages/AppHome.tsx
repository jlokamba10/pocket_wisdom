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

  return (
    <section className="page">
      <div className="page-header">
        <h1>Welcome back, {user.full_name}.</h1>
        <p>
          This workspace is ready for the next phase. Navigation tiles will
          activate as modules are implemented.
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
