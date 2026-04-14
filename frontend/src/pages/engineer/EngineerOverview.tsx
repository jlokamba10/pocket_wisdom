import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { apiRequest } from "../../lib/api";
import { useAuth } from "../../state/auth";

type EngineerSummary = {
  counts: {
    equipment: number;
    active_sensors: number;
    open_alerts: number;
    dashboard_assignments: number;
  };
  alerts_cleared_yesterday: number;
};

export default function EngineerOverview() {
  const { token } = useAuth();
  const [summary, setSummary] = useState<EngineerSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSummary = async () => {
      if (!token) {
        return;
      }
      try {
        const data = await apiRequest<EngineerSummary>("/summary/engineer", { method: "GET" }, token);
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
          <h2>Engineer Overview</h2>
          <p>Scope performance snapshot.</p>
        </div>
        {error ? <div className="form-error">{error}</div> : <div className="table-state">Loading summary...</div>}
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-header">
        <h2>Engineer Overview</h2>
        <p>Monitor equipment health and alert posture.</p>
      </div>

      <div className="card-grid">
        <NavLink className="card card-link" to="/app/engineer/equipment">
          <h3>Equipment in Scope</h3>
          <p className="metric">{summary.counts.equipment}</p>
        </NavLink>
        <div className="card">
          <h3>Active Sensors</h3>
          <p className="metric">{summary.counts.active_sensors}</p>
        </div>
        <NavLink className="card card-link" to="/app/engineer/alerts">
          <h3>Open Alerts</h3>
          <p className="metric">{summary.counts.open_alerts}</p>
        </NavLink>
        <NavLink className="card card-link" to="/app/engineer/dashboards">
          <h3>Dashboards</h3>
          <p className="metric">{summary.counts.dashboard_assignments}</p>
        </NavLink>
        <div className="card">
          <h3>Cleared Yesterday</h3>
          <p className="metric">{summary.alerts_cleared_yesterday}</p>
        </div>
      </div>
    </section>
  );
}
