import { useEffect, useState } from "react";
import Pagination from "../../components/Pagination";
import StatusBadge from "../../components/StatusBadge";
import { apiRequest } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import { buildQuery } from "../../lib/query";
import { useAuth } from "../../state/auth";

type Equipment = { id: number; name: string };

type Sensor = { id: number; name: string };

type User = { id: number; full_name: string };

type AlertEvent = {
  id: number;
  severity: string;
  status: string;
  triggered_at: string;
  cleared_at: string | null;
  equipment?: Equipment | null;
  sensor?: Sensor | null;
  cleared_by?: User | null;
};

type PaginatedAlerts = {
  items: AlertEvent[];
  total: number;
  limit: number;
  offset: number;
};

const DEFAULT_LIMIT = 12;

export default function ClientAlerts() {
  const { token } = useAuth();
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAlerts = async (nextOffset = offset) => {
    if (!token) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = buildQuery({
        q: query,
        status: statusFilter || undefined,
        severity: severityFilter || undefined,
        limit: DEFAULT_LIMIT,
        offset: nextOffset,
      });
      const data = await apiRequest<PaginatedAlerts>(`/client/alerts${params}`, { method: "GET" }, token);
      setAlerts(data.items);
      setTotal(data.total);
      setOffset(data.offset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load alerts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts(0);
  }, [token, query, statusFilter, severityFilter]);

  return (
    <section className="page">
      <div className="page-header">
        <h2>Alerts</h2>
        <p>Review alert history for your tenant.</p>
      </div>

      <div className="panel">
        <div className="table-toolbar">
          <input
            type="search"
            placeholder="Search alerts"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}>
            <option value="">All severity</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All status</option>
            <option value="OPEN">OPEN</option>
            <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
            <option value="CLEARED">CLEARED</option>
          </select>
        </div>

        {loading ? (
          <div className="table-state">Loading alerts...</div>
        ) : error ? (
          <div className="form-error">{error}</div>
        ) : alerts.length === 0 ? (
          <div className="empty-state">No alerts found.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Equipment</th>
                <th>Sensor</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Triggered</th>
                <th>Cleared By</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr key={alert.id}>
                  <td>{alert.equipment?.name ?? "-"}</td>
                  <td>{alert.sensor?.name ?? "-"}</td>
                  <td>{alert.severity}</td>
                  <td>
                    <StatusBadge status={alert.status} />
                  </td>
                  <td>{formatDateTime(alert.triggered_at)}</td>
                  <td>{alert.cleared_by?.full_name ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <Pagination total={total} limit={DEFAULT_LIMIT} offset={offset} onPageChange={loadAlerts} />
      </div>
    </section>
  );
}
