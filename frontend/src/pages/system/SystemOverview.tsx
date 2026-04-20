import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import StatusBadge from "../../components/StatusBadge";
import AttentionPanel from "../../components/AttentionPanel";
import MetricCard from "../../components/MetricCard";
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
        <MetricCard title="Active Clients" value={summary.counts.active_clients} helper="Tenant accounts in service" />
        <MetricCard title="Inactive Clients" value={summary.counts.inactive_clients} helper="Currently not in service" />
        <MetricCard title="Online Sensors" value={summary.counts.total_online_sensors} helper="Connected telemetry points" />
        <MetricCard title="Total Equipment" value={summary.counts.total_equipment} helper="Tracked assets platform-wide" />
        <MetricCard title="Open Alerts" value={summary.counts.total_open_alerts} helper="Awaiting acknowledgment or clearance" />
      </div>

      <AttentionPanel
        title="Attention Now"
        subtitle="Immediate checks to keep platform operations stable."
        items={[
          {
            label: "Open platform alerts",
            value: summary.counts.total_open_alerts,
            hint: "Review critical events across tenants",
            to: "/app/system/overview",
            tone: summary.counts.total_open_alerts > 0 ? "danger" : "neutral",
          },
          {
            label: "Inactive clients",
            value: summary.counts.inactive_clients,
            hint: "Potential onboarding or billing follow-up",
            to: "/app/system/clients",
            tone: summary.counts.inactive_clients > 0 ? "warning" : "neutral",
          },
          {
            label: "Dashboard assignment coverage",
            value: summary.breakdown_by_client.length,
            hint: "Tenants reporting in this overview",
            to: "/app/system/dashboard-assignments",
            tone: "info",
          },
        ]}
      />

      <div className="panel">
        <h3>Platform Usage</h3>
        <div className="card-grid compact">
          <MetricCard title="Total Users" value={summary.platform_usage.total_users} helper="All user accounts" />
          <MetricCard title="Active Users" value={summary.platform_usage.active_users} helper="Enabled and operational" />
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
              <div className="list-stack">
                {summary.recent_onboarding.clients.map((client) => (
                  <div key={client.id} className="list-row">
                    <div className="list-item">
                      <span className="list-item-title">{client.name}</span>
                      <span className="list-item-meta">Code: {client.code}</span>
                    </div>
                    <div className="list-item align-end">
                      <StatusBadge status={client.status} />
                      <span className="list-item-meta">{formatDateTime(client.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <h4>Users</h4>
            {summary.recent_onboarding.users.length === 0 ? (
              <div className="empty-state">No recent users.</div>
            ) : (
              <div className="list-stack">
                {summary.recent_onboarding.users.map((user) => (
                  <div key={user.id} className="list-row">
                    <div className="list-item">
                      <span className="list-item-title">{user.full_name}</span>
                      <span className="list-item-meta">
                        {user.role}
                        {user.tenant?.name ? ` - ${user.tenant.name}` : ""}
                      </span>
                    </div>
                    <div className="list-item align-end">
                      <StatusBadge status={user.status} />
                      <span className="list-item-meta">{formatDateTime(user.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
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
