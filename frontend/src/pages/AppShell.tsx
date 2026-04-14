import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../state/auth";

type NavItem = {
  label: string;
  to?: string;
  roles: string[];
  disabled?: boolean;
};

const navItems: NavItem[] = [
  { label: "System Console", to: "/app/system/overview", roles: ["SYSTEM_ADMIN"] },
  { label: "Client Console", to: "/app/client/overview", roles: ["CLIENT_ADMIN"] },
  {
    label: "Supervisor Console",
    to: "/app/supervisor/overview",
    roles: ["SUPERVISOR"],
  },
  {
    label: "Engineer Console",
    to: "/app/engineer/overview",
    roles: ["ENGINEER"],
  },
  {
    label: "Technician Console",
    to: "/app/technician/overview",
    roles: ["TECHNICIAN"],
  },
  {
    label: "Profile",
    to: "/app/profile",
    roles: ["SYSTEM_ADMIN", "CLIENT_ADMIN", "SUPERVISOR", "ENGINEER", "TECHNICIAN"],
  },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  if (!user) {
    return null;
  }

  const visibleNav = navItems.filter((item) => item.roles.includes(user.role));
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">PW</div>
          <div>
            <div className="brand-name">PocketWisdom</div>
            <div className="brand-subtitle">Industrial Insight</div>
          </div>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Navigation</div>
          <NavLink
            to="/app"
            end
            className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
          >
            Overview
          </NavLink>
          {visibleNav.map((item) =>
            item.to ? (
              <NavLink
                key={item.label}
                to={item.to}
                className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
              >
                {item.label}
              </NavLink>
            ) : null
          )}
        </div>
      </aside>

      <div className="shell-main">
        <header className="topbar">
          <div>
            <div className="topbar-title">Tenant Workspace</div>
            <div className="topbar-subtitle">
              {user.tenant?.name || "Platform Administration"}
            </div>
          </div>
          <div className="topbar-actions">
            <div className="user-chip">
              <div className="user-name">{user.full_name}</div>
              <div className="user-role">{user.role}</div>
            </div>
            <button className="ghost" onClick={logout}>
              Logout
            </button>
          </div>
        </header>

        <main className="shell-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
