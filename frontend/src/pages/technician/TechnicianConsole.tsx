import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { label: "Overview", to: "/app/technician/overview" },
  { label: "Equipment", to: "/app/technician/equipment" },
  { label: "Alerts", to: "/app/technician/alerts" },
  { label: "Dashboards", to: "/app/technician/dashboards" },
];

export default function TechnicianConsole() {
  return (
    <div className="console-layout">
      <div className="console-header">
        <div>
          <h1>Technician Workspace</h1>
          <p>Track equipment status and clear alerts in the field.</p>
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
