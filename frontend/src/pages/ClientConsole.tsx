import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { label: "Overview", to: "/app/client/overview" },
  { label: "Users", to: "/app/client/users" },
  { label: "Sites", to: "/app/client/sites" },
  { label: "Equipment", to: "/app/client/equipment" },
  { label: "Sensors", to: "/app/client/sensors" },
  { label: "Alerts", to: "/app/client/alerts" },
  { label: "Dashboards", to: "/app/client/dashboards" },
];

export default function ClientConsole() {
  return (
    <div className="console-layout">
      <div className="console-header">
        <div>
          <h1>Client Administration</h1>
          <p>Configure your tenant, assets, and team access.</p>
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
