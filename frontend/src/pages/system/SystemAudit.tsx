import { useEffect, useState } from "react";
import Pagination from "../../components/Pagination";
import { apiRequest } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import { buildQuery } from "../../lib/query";
import { useAuth } from "../../state/auth";

type Tenant = {
  id: number;
  name: string;
};

type UserSummary = {
  id: number;
  full_name: string;
  email: string;
};

type AuditEntry = {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  tenant?: Tenant | null;
  user?: UserSummary | null;
};

type PaginatedAudit = {
  items: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
};

const DEFAULT_LIMIT = 12;

export default function SystemAudit() {
  const { token } = useAuth();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [tenantFilter, setTenantFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAudit = async (nextOffset = offset) => {
    if (!token) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = buildQuery({
        q: query,
        action: actionFilter || undefined,
        entity_type: entityFilter || undefined,
        tenant_id: tenantFilter || undefined,
        limit: DEFAULT_LIMIT,
        offset: nextOffset,
      });
      const data = await apiRequest<PaginatedAudit>(`/audit${params}`, { method: "GET" }, token);
      setEntries(data.items);
      setTotal(data.total);
      setOffset(data.offset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load audit log.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAudit(0);
  }, [token, query, actionFilter, entityFilter, tenantFilter]);

  return (
    <section className="page">
      <div className="page-header">
        <h2>Audit Log</h2>
        <p>Track administrative actions across tenants.</p>
      </div>

      <div className="panel">
        <div className="table-toolbar">
          <input
            type="search"
            placeholder="Search audit entries"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <input
            type="text"
            placeholder="Action"
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
          />
          <input
            type="text"
            placeholder="Entity type"
            value={entityFilter}
            onChange={(event) => setEntityFilter(event.target.value)}
          />
          <input
            type="text"
            placeholder="Tenant ID"
            value={tenantFilter}
            onChange={(event) => setTenantFilter(event.target.value)}
          />
        </div>

        {loading ? (
          <div className="table-state">Loading audit entries...</div>
        ) : error ? (
          <div className="form-error">{error}</div>
        ) : entries.length === 0 ? (
          <div className="empty-state">No audit activity yet.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Tenant</th>
                <th>User</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDateTime(entry.created_at)}</td>
                  <td>{entry.action}</td>
                  <td>
                    {entry.entity_type} {entry.entity_id ?? ""}
                  </td>
                  <td>{entry.tenant?.name ?? entry.tenant?.id ?? "-"}</td>
                  <td>{entry.user?.full_name ?? "System"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <Pagination total={total} limit={DEFAULT_LIMIT} offset={offset} onPageChange={loadAudit} />
      </div>
    </section>
  );
}
