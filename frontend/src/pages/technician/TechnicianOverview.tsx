import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { apiRequest } from "../../lib/api";
import { useAuth } from "../../state/auth";

type TechnicianSummary = {
  counts: {
    equipment: number;
    open_alerts: number;
  };
};

export default function TechnicianOverview() {
  const { token } = useAuth();
  const [summary, setSummary] = useState<TechnicianSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSummary = async () => {
      if (!token) {
        return;
      }
      try {
        const data = await apiRequest<TechnicianSummary>("/summary/technician", { method: "GET" }, token);
        setSummary(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load summary.");
      }
    };
    loadSummary();
  }, [token]);

  if (!summary) {
    return (
      <section className="page">
        <div className="page-header">
          <h2>Technician Overview</h2>
          <p>Field readiness snapshot.</p>
        </div>
        {error ? <div className="form-error">{error}</div> : <div className="table-state">Loading summary...</div>}
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-header">
        <h2>Technician Overview</h2>
        <p>Quick visibility into equipment and open alerts.</p>
      </div>

      <div className="card-grid">
        <NavLink className="card card-link" to="/app/technician/equipment">
          <h3>Equipment</h3>
          <p className="metric">{summary.counts.equipment}</p>
        </NavLink>
        <NavLink className="card card-link" to="/app/technician/alerts">
          <h3>Open Alerts</h3>
          <p className="metric">{summary.counts.open_alerts}</p>
        </NavLink>
        <NavLink className="card card-link" to="/app/technician/dashboards">
          <h3>Dashboards</h3>
          <p className="metric">View</p>
        </NavLink>
      </div>
    </section>
  );
}
