import { useEffect, useState } from "react";
import Pagination from "../../components/Pagination";
import StatusBadge from "../../components/StatusBadge";
import { apiRequest } from "../../lib/api";
import { buildQuery } from "../../lib/query";
import { useAuth } from "../../state/auth";

type Site = { id: number; name: string };

type Equipment = {
  id: number;
  name: string;
  equipment_type: string;
  status: string;
  site?: Site | null;
  criticality?: string | null;
};

type PaginatedEquipment = {
  items: Equipment[];
  total: number;
  limit: number;
  offset: number;
};

const DEFAULT_LIMIT = 10;

export default function EngineerEquipment() {
  const { token } = useAuth();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEquipment = async (nextOffset = offset) => {
    if (!token) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = buildQuery({
        q: query,
        status: statusFilter || undefined,
        limit: DEFAULT_LIMIT,
        offset: nextOffset,
      });
      const data = await apiRequest<PaginatedEquipment>(`/equipment${params}`, { method: "GET" }, token);
      setEquipment(data.items);
      setTotal(data.total);
      setOffset(data.offset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load equipment.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEquipment(0);
  }, [token, query, statusFilter]);

  return (
    <section className="page">
      <div className="page-header">
        <h2>Equipment</h2>
        <p>Equipment and sites aligned to your supervisor scope.</p>
      </div>

      <div className="panel">
        <div className="table-toolbar">
          <input
            type="search"
            placeholder="Search equipment"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        {loading ? (
          <div className="table-state">Loading equipment...</div>
        ) : error ? (
          <div className="form-error">{error}</div>
        ) : equipment.length === 0 ? (
          <div className="empty-state">No equipment in scope.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Site</th>
                <th>Criticality</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {equipment.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.equipment_type}</td>
                  <td>{item.site?.name ?? "-"}</td>
                  <td>{item.criticality ?? "-"}</td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <Pagination total={total} limit={DEFAULT_LIMIT} offset={offset} onPageChange={loadEquipment} />
      </div>
    </section>
  );
}
