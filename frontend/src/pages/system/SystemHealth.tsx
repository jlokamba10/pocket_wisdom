import { useEffect, useState } from "react";
import MetricCard from "../../components/MetricCard";
import { apiRequest } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import { getGrafanaBaseUrl } from "../../lib/grafana";
import { useAuth } from "../../state/auth";

type HealthPayload = {
  status: string;
  service: string;
};

type MetricsPayload = {
  tenants: number;
  users: number;
  equipment: number;
  sensors: number;
  alert_rules: number;
};

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8002";

export default function SystemHealth() {
  const { token } = useAuth();
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [metrics, setMetrics] = useState<MetricsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!token) {
        return;
      }
      setError(null);
      try {
        const [healthData, metricsData] = await Promise.all([
          apiRequest<HealthPayload>("/health", { method: "GET" }, token),
          apiRequest<MetricsPayload>("/metrics", { method: "GET" }, token),
        ]);
        setHealth(healthData);
        setMetrics(metricsData);
        setLastChecked(new Date());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load system status.");
      }
    };
    load();
  }, [token]);

  const grafanaUrl = getGrafanaBaseUrl();

  return (
    <section className="page">
      <div className="page-header">
        <h2>System Health</h2>
        <p>Diagnostics for the PocketWisdom control plane and observability stack.</p>
      </div>

      {error ? <div className="form-error">{error}</div> : null}

      <div className="card-grid">
        <MetricCard title="Admin API" value={health?.status ?? "Checking"} helper={health?.service} />
        <MetricCard title="Tenants" value={metrics?.tenants ?? "-"} helper="Provisioned" />
        <MetricCard title="Users" value={metrics?.users ?? "-"} helper="All roles" />
        <MetricCard title="Equipment" value={metrics?.equipment ?? "-"} helper="Tracked assets" />
        <MetricCard title="Sensors" value={metrics?.sensors ?? "-"} helper="Active + inactive" />
        <MetricCard title="Alert Rules" value={metrics?.alert_rules ?? "-"} helper="Configured" />
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>Service Endpoints</h3>
          <p className="muted">Open core services in new tabs for deeper inspection.</p>
        </div>
        <div className="details-grid">
          <div className="card">
            <h4>Admin API</h4>
            <p className="muted">{API_URL}</p>
            <a className="link" href={API_URL} target="_blank" rel="noreferrer">
              Open API
            </a>
          </div>
          <div className="card">
            <h4>Grafana</h4>
            <p className="muted">{grafanaUrl ?? "Not configured"}</p>
            {grafanaUrl ? (
              <a className="link" href={grafanaUrl} target="_blank" rel="noreferrer">
                Open Grafana
              </a>
            ) : null}
          </div>
          <div className="card">
            <h4>InfluxDB</h4>
            <p className="muted">http://localhost:8086</p>
          </div>
          <div className="card">
            <h4>Redpanda Console</h4>
            <p className="muted">http://localhost:8080</p>
          </div>
        </div>
        <p className="muted section-note">
          Last checked: {lastChecked ? formatDateTime(lastChecked) : "Pending"}
        </p>
      </div>
    </section>
  );
}
