import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import StatusBadge from "../../components/StatusBadge";
import { useAuth } from "../../state/auth";

type TenantSummary = {
  id: number;
  name: string;
  code: string;
  status: string;
  created_at: string;
};

type UserSummary = {
  id: number;
  full_name: string;
  email: string;
  role: string;
  status: string;
  tenant?: { name: string } | null;
  created_at: string;
};

type SystemSummary = {
  counts: {
    active_clients: number;
    inactive_clients: number;
    total_online_sensors: number;
    total_equipment: number;
    total_open_alerts: number;
  };
  platform_usage: {
    total_users: number;
    active_users: number;
    roles: Record<string, number>;
  };
  breakdown_by_client: Array<{
    tenant_id: number;
    name: string;
    code: string;
    status: string;
    active_users: number;
    equipment: number;
    sensors: number;
    open_alerts: number;
  }>;
  recent_onboarding: {
    clients: TenantSummary[];
    users: UserSummary[];
  };
  recent_alert_activity: Array<{
    id: number;
    tenant: string | null;
    equipment: string | null;
    sensor: string | null;
    severity: string;
    status: string;
    triggered_at: string;
    cleared_at: string | null;
  }>;
};

export default function SystemOverview() {
  const { token } = useAuth();
  const [summary, setSummary] = useState<SystemSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!token) {
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await apiRequest<SystemSummary>("/summary/system-admin", { method: "GET" }, token);
        setSummary(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load summary.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  if (loading) {
    return (
      <section className="page center">
        <div className="loader" />
        <p>Loading system overview...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="page">
        <div className="form-error">{error}</div>
      </section>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <section className="page">
      <div className="page-header">
        <h2>Platform Overview</h2>
        <p>Track client onboarding, fleet assets, and alert posture across the platform.</p>
      </div>

      <div className="card-grid">
        <div className="card">
          <h3>Active Clients</h3>
          <p className="metric">{summary.counts.active_clients}</p>
        </div>
        <div className="card">
          <h3>Inactive Clients</h3>
          <p className="metric">{summary.counts.inactive_clients}</p>
        </div>
        <div className="card">
          <h3>Online Sensors</h3>
          <p className="metric">{summary.counts.total_online_sensors}</p>
        </div>
        <div className="card">
          <h3>Total Equipment</h3>
          <p className="metric">{summary.counts.total_equipment}</p>
        </div>
        <div className="card">
          <h3>Open Alerts</h3>
          <p className="metric">{summary.counts.total_open_alerts}</p>
        </div>
      </div>

      <div className="panel">
        <h3>Platform Usage</h3>
        <div className="card-grid compact">
          <div className="card">
            <h4>Total Users</h4>
            <p className="metric">{summary.platform_usage.total_users}</p>
          </div>
          <div className="card">
            <h4>Active Users</h4>
            <p className="metric">{summary.platform_usage.active_users}</p>
          </div>
          <div className="card">
            <h4>Roles</h4>
            <div className="chip-row">
              {Object.entries(summary.platform_usage.roles).map(([role, count]) => (
                <span key={role} className="chip">
                  {role}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>Client Breakdown</h3>
          <p>Drill into tenant health and activity.</p>
        </div>
        {summary.breakdown_by_client.length === 0 ? (
          <div className="empty-state">No clients found yet.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Code</th>
                <th>Status</th>
                <th>Active Users</th>
                <th>Equipment</th>
                <th>Sensors</th>
                <th>Open Alerts</th>
              </tr>
            </thead>
            <tbody>
              {summary.breakdown_by_client.map((client) => (
                <tr key={client.tenant_id}>
                  <td>{client.name}</td>
                  <td>{client.code}</td>
                  <td>
                    <StatusBadge status={client.status} />
                  </td>
                  <td>{client.active_users}</td>
                  <td>{client.equipment}</td>
                  <td>{client.sensors}</td>
                  <td>{client.open_alerts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel-grid">
        <div className="panel">
          <h3>Recent Onboarding</h3>
          <div className="list-stack">
            <h4>Clients</h4>
            {summary.recent_onboarding.clients.length === 0 ? (
              <div className="empty-state">No recent clients.</div>
            ) : (
              <ul>
                {summary.recent_onboarding.clients.map((client) => (
                  <li key={client.id}>
                    <div className="list-row">
                      <span>{client.name}</span>
                      <span className="muted">{formatDateTime(client.created_at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <h4>Users</h4>
            {summary.recent_onboarding.users.length === 0 ? (
              <div className="empty-state">No recent users.</div>
            ) : (
              <ul>
                {summary.recent_onboarding.users.map((user) => (
                  <li key={user.id}>
                    <div className="list-row">
                      <span>
                        {user.full_name} ({user.role})
                      </span>
                      <span className="muted">{formatDateTime(user.created_at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="panel">
          <h3>Recent Alert Activity</h3>
          {summary.recent_alert_activity.length === 0 ? (
            <div className="empty-state">No alerts yet.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Equipment</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Triggered</th>
                </tr>
              </thead>
              <tbody>
                {summary.recent_alert_activity.map((alert) => (
                  <tr key={alert.id}>
                    <td>{alert.tenant ?? "-"}</td>
                    <td>{alert.equipment ?? "-"}</td>
                    <td>{alert.severity}</td>
                    <td>
                      <StatusBadge status={alert.status} />
                    </td>
                    <td>{formatDateTime(alert.triggered_at)}</td>
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
