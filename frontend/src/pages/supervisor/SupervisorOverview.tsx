import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { apiRequest } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import { useAuth } from "../../state/auth";
import StatusBadge from "../../components/StatusBadge";

type ClearedSeries = { date: string; count: number };

type TeamMember = { id: number; name: string; role: string; status: string };

type SupervisorSummary = {
  counts: {
    equipment: number;
    active_sensors: number;
    open_alerts: number;
    team_members: number;
    dashboard_assignments: number;
  };
  alerts_cleared_yesterday: number;
  alerts_cleared_last_7_days: ClearedSeries[];
  team: TeamMember[];
};

export default function SupervisorOverview() {
  const { token, user } = useAuth();
  const [summary, setSummary] = useState<SupervisorSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSummary = async () => {
      if (!token) {
        return;
      }
      try {
        const data = await apiRequest<SupervisorSummary>("/summary/supervisor", { method: "GET" }, token);
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
          <h2>Supervisor Overview</h2>
          <p>{user?.tenant?.name ?? "Operational scope"}</p>
        </div>
        {error ? <div className="form-error">{error}</div> : <div className="table-state">Loading summary...</div>}
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-header">
        <h2>Supervisor Overview</h2>
        <p>Daily readiness for your crew and equipment scope.</p>
      </div>

      <div className="card-grid">
        <NavLink className="card card-link" to="/app/supervisor/equipment">
          <h3>Equipment</h3>
          <p className="metric">{summary.counts.equipment}</p>
        </NavLink>
        <NavLink className="card card-link" to="/app/supervisor/sensors">
          <h3>Active Sensors</h3>
          <p className="metric">{summary.counts.active_sensors}</p>
        </NavLink>
        <NavLink className="card card-link" to="/app/supervisor/alerts">
          <h3>Open Alerts</h3>
          <p className="metric">{summary.counts.open_alerts}</p>
        </NavLink>
        <NavLink className="card card-link" to="/app/supervisor/team">
          <h3>Team Members</h3>
          <p className="metric">{summary.counts.team_members}</p>
        </NavLink>
        <NavLink className="card card-link" to="/app/supervisor/dashboard-templates">
          <h3>Dashboard Assignments</h3>
          <p className="metric">{summary.counts.dashboard_assignments}</p>
        </NavLink>
        <div className="card">
          <h3>Cleared Yesterday</h3>
          <p className="metric">{summary.alerts_cleared_yesterday}</p>
        </div>
      </div>

      <div className="panel-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h3>Cleared Alerts (Last 7 Days)</h3>
              <p className="muted">Daily totals for cleared alerts.</p>
            </div>
          </div>
          {summary.alerts_cleared_last_7_days.length === 0 ? (
            <div className="empty-state">No cleared alerts in the past week.</div>
          ) : (
            <div className="list-stack">
              {summary.alerts_cleared_last_7_days.map((item) => (
                <div key={item.date} className="list-row">
                  <span>{formatDateTime(`${item.date}T00:00:00Z`)}</span>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h3>Team On Duty</h3>
              <p className="muted">Engineers and technicians under your scope.</p>
            </div>
            <NavLink className="link" to="/app/supervisor/team">
              Manage team
            </NavLink>
          </div>
          {summary.team.length === 0 ? (
            <div className="empty-state">No team members assigned yet.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {summary.team.map((member) => (
                  <tr key={member.id}>
                    <td>{member.name}</td>
                    <td>{member.role}</td>
                    <td>
                      <StatusBadge status={member.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
