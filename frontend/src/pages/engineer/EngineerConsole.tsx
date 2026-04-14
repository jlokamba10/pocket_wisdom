import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { label: "Overview", to: "/app/engineer/overview" },
  { label: "Equipment", to: "/app/engineer/equipment" },
  { label: "Alerts", to: "/app/engineer/alerts" },
  { label: "Dashboards", to: "/app/engineer/dashboards" },
];

export default function EngineerConsole() {
  return (
    <div className="console-layout">
      <div className="console-header">
        <div>
          <h1>Engineer Workspace</h1>
          <p>Analyze equipment, manage alert rules, and clear alerts.</p>
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
