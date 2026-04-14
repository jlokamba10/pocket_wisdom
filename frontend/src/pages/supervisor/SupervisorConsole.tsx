import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { label: "Overview", to: "/app/supervisor/overview" },
  { label: "Team", to: "/app/supervisor/team" },
  { label: "Equipment", to: "/app/supervisor/equipment" },
  { label: "Sensors", to: "/app/supervisor/sensors" },
  { label: "Alerts", to: "/app/supervisor/alerts" },
  { label: "Dashboard Templates", to: "/app/supervisor/dashboard-templates" },
];

export default function SupervisorConsole() {
  return (
    <div className="console-layout">
      <div className="console-header">
        <div>
          <h1>Supervisor Operations</h1>
          <p>Manage your team, assets, alert rules, and dashboards.</p>
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
