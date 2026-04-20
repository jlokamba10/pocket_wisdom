import { useEffect, useMemo, useState } from "react";
import DashboardEmbed from "../../components/DashboardEmbed";
import Pagination from "../../components/Pagination";
import TableToolbar from "../../components/TableToolbar";
import { apiRequest } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import { buildQuery } from "../../lib/query";
import { useAuth } from "../../state/auth";

type DashboardTemplate = {
  id: number;
  name: string;
  equipment_type: string | null;
  grafana_uid: string | null;
};

type TenantSummary = {
  id: number;
  code: string;
  name: string;
};

type Equipment = { id: number; name: string; site_id?: number | null; serial_number?: string | null } | null;

type User = { id: number; full_name: string } | null;

type Assignment = {
  id: number;
  tenant_id: number;
  created_at: string;
  template: DashboardTemplate;
  equipment: Equipment;
  supervisor: User;
  created_by: User;
  tenant?: TenantSummary | null;
};

type PaginatedAssignments = {
  items: Assignment[];
  total: number;
  limit: number;
  offset: number;
};

const DEFAULT_LIMIT = 10;

export default function TechnicianDashboards() {
  const { token, user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState("");
  const [scopeFilter, setScopeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const loadAssignments = async (nextOffset = offset) => {
    if (!token) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = buildQuery({
        q: query,
        equipment_type: equipmentFilter || undefined,
        scope: scopeFilter || undefined,
        limit: DEFAULT_LIMIT,
        offset: nextOffset,
      });
      const data = await apiRequest<PaginatedAssignments>(`/dashboard-assignments${params}`, { method: "GET" }, token);
      setAssignments(data.items);
      setTotal(data.total);
      setOffset(data.offset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load dashboards.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssignments(0);
  }, [token, query, equipmentFilter, scopeFilter]);

  useEffect(() => {
    if (assignments.length > 0 && !assignments.find((assignment) => assignment.id === selectedId)) {
      setSelectedId(assignments[0].id);
    }
    if (assignments.length === 0) {
      setSelectedId(null);
    }
  }, [assignments, selectedId]);

  const selectedAssignment = useMemo(
    () => assignments.find((assignment) => assignment.id === selectedId) ?? null,
    [assignments, selectedId]
  );
  const tenantTag = (selectedAssignment?.tenant?.code ?? user?.tenant?.code ?? "").toLowerCase();

  return (
    <section className="page">
      <div className="page-header">
        <h2>Dashboards</h2>
        <p>Dashboards assigned to your supervisor scope.</p>
      </div>

      <div className="panel">
        <TableToolbar>
          <input
            type="search"
            placeholder="Search dashboards"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <input
            type="text"
            placeholder="Equipment type"
            value={equipmentFilter}
            onChange={(event) => setEquipmentFilter(event.target.value.toUpperCase())}
          />
          <select value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value)}>
            <option value="">All scopes</option>
            <option value="FLEET">Fleet</option>
            <option value="EQUIPMENT">Equipment</option>
          </select>
        </TableToolbar>

        {loading ? (
          <div className="table-state">Loading dashboard assignments...</div>
        ) : error ? (
          <div className="form-error">{error}</div>
        ) : assignments.length === 0 ? (
          <div className="empty-state">No dashboards assigned yet.</div>
        ) : (
          <div className="dashboard-layout">
            <div className="dashboard-list">
              {assignments.map((assignment) => (
                <button
                  key={assignment.id}
                  className={`dashboard-card${selectedId === assignment.id ? " active" : ""}`}
                  type="button"
                  onClick={() => setSelectedId(assignment.id)}
                >
                  <div className="dashboard-card-header">
                    <div className="dashboard-card-title">{assignment.template.name}</div>
                    {assignment.template.equipment_type ? (
                      <span className="chip">{assignment.template.equipment_type}</span>
                    ) : null}
                  </div>
                  <div className="dashboard-card-meta">Scope: {assignment.equipment?.name ?? "Fleet"}</div>
                  <div className="dashboard-card-meta">Assigned {formatDateTime(assignment.created_at)}</div>
                  <div className="dashboard-card-meta">Assigned by {assignment.created_by?.full_name ?? "-"}</div>
                </button>
              ))}
            </div>
            <div>
              {selectedAssignment ? (
                <DashboardEmbed
                  uid={selectedAssignment.template.grafana_uid}
                  title={selectedAssignment.template.name}
                  description={`Scope: ${selectedAssignment.equipment?.name ?? "Fleet"}`}
                  variables={{
                    tenant_id: selectedAssignment.tenant_id,
                    site_id: selectedAssignment.equipment?.site_id,
                    equipment_id: selectedAssignment.equipment?.id,
                    tenant_tag: tenantTag,
                  }}
                />
              ) : (
                <div className="empty-state">Select a dashboard to preview.</div>
              )}
            </div>
          </div>
        )}

        <Pagination total={total} limit={DEFAULT_LIMIT} offset={offset} onPageChange={loadAssignments} />
      </div>
    </section>
  );
}
