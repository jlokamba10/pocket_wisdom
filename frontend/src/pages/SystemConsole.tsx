import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { label: "Overview", to: "/app/system/overview" },
  { label: "Clients", to: "/app/system/clients" },
  { label: "Users", to: "/app/system/users" },
  { label: "Dashboard Templates", to: "/app/system/dashboard-templates" },
  { label: "Dashboard Assignments", to: "/app/system/dashboard-assignments" },
  { label: "Audit Log", to: "/app/system/audit" },
  { label: "System Health", to: "/app/system/health" },
];

export default function SystemConsole() {
  return (
    <div className="console-layout">
      <div className="console-header">
        <div>
          <h1>System Administration</h1>
          <p>Monitor platform health, tenants, and global access controls.</p>
        </div>
      </div>
      <div className="subnav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `subnav-link${isActive ? " active" : ""}`}
          >
            {item.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
