import { useEffect, useMemo, useState } from "react";
import DashboardEmbed from "../../components/DashboardEmbed";
import Pagination from "../../components/Pagination";
import TableToolbar from "../../components/TableToolbar";
import { apiRequest } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import { buildQuery } from "../../lib/query";
import { useAuth } from "../../state/auth";

type TenantSummary = {
  id: number;
  name: string;
  code: string;
};

type DashboardTemplate = {
  id: number;
  name: string;
  equipment_type: string | null;
  grafana_uid: string | null;
};

type Equipment = { id: number; name: string; site_id?: number | null } | null;

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

type PaginatedTenants = {
  items: TenantSummary[];
};

const DEFAULT_LIMIT = 10;

export default function SystemDashboardAssignments() {
  const { token } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [tenantFilter, setTenantFilter] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState("");
  const [scopeFilter, setScopeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const loadTenants = async () => {
    if (!token) {
      return;
    }
    try {
      const data = await apiRequest<PaginatedTenants>("/clients?limit=100&offset=0", { method: "GET" }, token);
      setTenants(data.items);
    } catch {
      setTenants([]);
    }
  };

  const loadAssignments = async (nextOffset = offset) => {
    if (!token) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = buildQuery({
        q: query,
        tenant_id: tenantFilter ? Number(tenantFilter) : undefined,
        equipment_type: equipmentFilter || undefined,
        scope: scopeFilter || undefined,
        limit: DEFAULT_LIMIT,
        offset: nextOffset,
      });
      const data = await apiRequest<PaginatedAssignments>(`/system/dashboard-assignments${params}`, { method: "GET" }, token);
      setAssignments(data.items);
      setTotal(data.total);
      setOffset(data.offset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load dashboard assignments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, [token]);

  useEffect(() => {
    loadAssignments(0);
  }, [token, query, tenantFilter, equipmentFilter, scopeFilter]);

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

  return (
    <section className="page">
      <div className="page-header">
        <h2>Dashboard Assignments</h2>
        <p>Inspect dashboard coverage across tenants and operational scopes.</p>
      </div>

      <div className="panel">
        <TableToolbar>
          <input
            type="search"
            placeholder="Search assignments"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select value={tenantFilter} onChange={(event) => setTenantFilter(event.target.value)}>
            <option value="">All tenants</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
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
          <div className="empty-state">No dashboard assignments found.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Template</th>
                <th>Tenant</th>
                <th>Scope</th>
                <th>Supervisor</th>
                <th>Created By</th>
                <th>Assigned</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td>
                    {assignment.template.name}
                    {assignment.template.equipment_type ? (
                      <span className="chip">{assignment.template.equipment_type}</span>
                    ) : null}
                  </td>
                  <td>{assignment.tenant?.name ?? `Tenant ${assignment.tenant_id}`}</td>
                  <td>{assignment.equipment?.name ?? "Fleet"}</td>
                  <td>{assignment.supervisor?.full_name ?? "-"}</td>
                  <td>{assignment.created_by?.full_name ?? "-"}</td>
                  <td>{formatDateTime(assignment.created_at)}</td>
                  <td>
                    <button className="ghost" type="button" onClick={() => setSelectedId(assignment.id)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <Pagination total={total} limit={DEFAULT_LIMIT} offset={offset} onPageChange={loadAssignments} />
      </div>

      <div className="panel">
        {selectedAssignment ? (
          <DashboardEmbed
            uid={selectedAssignment.template.grafana_uid}
            title={selectedAssignment.template.name}
            description={
              <>
                Scope: {selectedAssignment.equipment?.name ?? "Fleet"} • Tenant:{" "}
                {selectedAssignment.tenant?.name ?? selectedAssignment.tenant_id}
              </>
            }
            variables={{
              tenant_id: selectedAssignment.tenant_id,
              site_id: selectedAssignment.equipment?.site_id,
              equipment_id: selectedAssignment.equipment?.id,
            }}
          />
        ) : (
          <div className="empty-state">Select an assignment to preview the embedded dashboard.</div>
        )}
      </div>
    </section>
  );
}
