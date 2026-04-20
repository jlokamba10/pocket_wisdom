import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import AttentionPanel from "../../components/AttentionPanel";
import MetricCard from "../../components/MetricCard";
import { apiRequest } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { useAuth } from "../../state/auth";

type ClientSummary = {
  counts: {
    active_sensors: number;
    active_equipment: number;
    alerts_triggered_yesterday: number;
  };
  equipment_by_site: Array<{ site_id: number; site: string; count: number }>;
  sensor_distribution: Array<{ equipment_id: number; equipment: string; count: number }>;
  alerts_yesterday: { total: number; cleared_by: Array<{ user_id: number; name: string; count: number }> };
  alerts_last_7_days: Array<{ date: string; count: number }>;
  recent_user_activity: Array<{
    id: number;
    action: string;
    entity_type: string;
    entity_id: string | null;
    user: string | null;
    created_at: string;
  }>;
  recent_equipment_additions: Array<{ id: number; details: { name?: string } | null; created_at: string }>;
};

export default function ClientOverview() {
  const { token } = useAuth();
  const [summary, setSummary] = useState<ClientSummary | null>(null);
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
        const data = await apiRequest<ClientSummary>("/summary/client-admin", { method: "GET" }, token);
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
        <p>Loading client overview...</p>
      </section>
    );
  }

  if (error || !summary) {
    return (
      <section className="page">
        <div className="form-error">{error ?? "No summary data."}</div>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-header">
        <h2>Tenant Overview</h2>
        <p>Operational health, alerts, and recent activity.</p>
      </div>

      <div className="card-grid">
        <NavLink className="card-link" to="/app/client/sensors">
          <MetricCard title="Active Sensors" value={summary.counts.active_sensors} helper="Online telemetry points" />
        </NavLink>
        <NavLink className="card-link" to="/app/client/equipment">
          <MetricCard title="Active Equipment" value={summary.counts.active_equipment} helper="Operational assets" />
        </NavLink>
        <NavLink className="card-link" to="/app/client/alerts">
          <MetricCard
            title="Alerts Yesterday"
            value={summary.counts.alerts_triggered_yesterday}
            helper="Triggered in last 24 hours"
          />
        </NavLink>
      </div>

      <AttentionPanel
        title="Attention Now"
        subtitle="Prioritize these actions to keep your tenant healthy."
        items={[
          {
            label: "Triggered alerts (yesterday)",
            value: summary.counts.alerts_triggered_yesterday,
            hint: "Investigate unresolved conditions first",
            to: "/app/client/alerts",
            tone: summary.counts.alerts_triggered_yesterday > 0 ? "danger" : "neutral",
          },
          {
            label: "Active equipment",
            value: summary.counts.active_equipment,
            hint: "Check assets without sensor coverage",
            to: "/app/client/equipment",
            tone: summary.counts.active_equipment === 0 ? "warning" : "info",
          },
          {
            label: "Active sensors",
            value: summary.counts.active_sensors,
            hint: "Validate telemetry and stale streams",
            to: "/app/client/sensors",
            tone: summary.counts.active_sensors === 0 ? "warning" : "info",
          },
        ]}
      />

      <div className="panel-grid">
        <div className="panel">
          <h3>Equipment by Site</h3>
          {summary.equipment_by_site.length === 0 ? (
            <div className="empty-state">No equipment found.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Equipment Count</th>
                </tr>
              </thead>
              <tbody>
                {summary.equipment_by_site.map((site) => (
                  <tr key={site.site_id}>
                    <td>{site.site}</td>
                    <td>{site.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <h3>Sensor Distribution</h3>
          {summary.sensor_distribution.length === 0 ? (
            <div className="empty-state">No sensors configured.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Equipment</th>
                  <th>Sensor Count</th>
                </tr>
              </thead>
              <tbody>
                {summary.sensor_distribution.map((item) => (
                  <tr key={item.equipment_id}>
                    <td>{item.equipment}</td>
                    <td>{item.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="panel">
        <h3>Alerts in the Last 7 Days</h3>
        {summary.alerts_last_7_days.length === 0 ? (
          <div className="empty-state">No alert activity in the last week.</div>
        ) : (
          <div className="list-stack">
            {summary.alerts_last_7_days.map((item) => (
              <div key={item.date} className="list-row">
                <span>{formatDate(item.date)}</span>
                <span className="metric small">{item.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel-grid">
        <div className="panel">
          <h3>Yesterday's Alerts</h3>
          <p className="muted">Total triggered: {summary.alerts_yesterday.total}</p>
          {summary.alerts_yesterday.cleared_by.length === 0 ? (
            <div className="empty-state">No alerts cleared yet.</div>
          ) : (
            <div className="list-stack">
              {summary.alerts_yesterday.cleared_by.map((item) => (
                <div key={item.user_id} className="list-row">
                  <span>{item.name}</span>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <h3>Recent User Activity</h3>
          {summary.recent_user_activity.length === 0 ? (
            <div className="empty-state">No recent user activity.</div>
          ) : (
            <div className="list-stack">
              {summary.recent_user_activity.map((entry) => (
                <div key={entry.id} className="list-row">
                  <span>
                    {entry.action} ({entry.entity_type}
                    {entry.entity_id ? ` ${entry.entity_id}` : ""})
                  </span>
                  <span className="muted">
                    {entry.user ?? "System"} - {formatDate(entry.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <h3>Recent Equipment Additions</h3>
        {summary.recent_equipment_additions.length === 0 ? (
          <div className="empty-state">No equipment additions logged yet.</div>
        ) : (
          <div className="list-stack">
            {summary.recent_equipment_additions.map((entry) => (
              <div key={entry.id} className="list-row">
                <span>{entry.details?.name ? String(entry.details.name) : "Equipment"}</span>
                <span className="muted">{formatDate(entry.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
