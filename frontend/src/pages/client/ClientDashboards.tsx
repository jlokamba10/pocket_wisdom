import { useEffect, useState } from "react";
import Pagination from "../../components/Pagination";
import { apiRequest } from "../../lib/api";
import { buildQuery } from "../../lib/query";
import { useAuth } from "../../state/auth";

type DashboardTemplate = {
  id: number;
  name: string;
  equipment_type: string | null;
};

type Equipment = { id: number; name: string } | null;

type User = { id: number; full_name: string } | null;

type Assignment = {
  id: number;
  template: DashboardTemplate;
  equipment: Equipment;
  supervisor: User;
  created_by: User;
};

type PaginatedAssignments = {
  items: Assignment[];
  total: number;
  limit: number;
  offset: number;
};

const DEFAULT_LIMIT = 10;

export default function ClientDashboards() {
  const { token } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAssignments = async (nextOffset = offset) => {
    if (!token) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = buildQuery({ q: query, limit: DEFAULT_LIMIT, offset: nextOffset });
      const data = await apiRequest<PaginatedAssignments>(`/client/dashboards${params}`, { method: "GET" }, token);
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
  }, [token, query]);

  return (
    <section className="page">
      <div className="page-header">
        <h2>Dashboards</h2>
        <p>Current dashboard assignments for your tenant.</p>
      </div>

      <div className="panel">
        <div className="table-toolbar">
          <input
            type="search"
            placeholder="Search dashboards"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        {loading ? (
          <div className="table-state">Loading dashboard assignments...</div>
        ) : error ? (
          <div className="form-error">{error}</div>
        ) : assignments.length === 0 ? (
          <div className="empty-state">No dashboards assigned yet.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Template</th>
                <th>Equipment</th>
                <th>Supervisor</th>
                <th>Created By</th>
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
                  <td>{assignment.equipment?.name ?? "Fleet"}</td>
                  <td>{assignment.supervisor?.full_name ?? "-"}</td>
                  <td>{assignment.created_by?.full_name ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <Pagination total={total} limit={DEFAULT_LIMIT} offset={offset} onPageChange={loadAssignments} />
      </div>
    </section>
  );
}
