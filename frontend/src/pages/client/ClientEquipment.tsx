import { FormEvent, useEffect, useState } from "react";
import Pagination from "../../components/Pagination";
import StatusBadge from "../../components/StatusBadge";
import { apiRequest } from "../../lib/api";
import { buildQuery } from "../../lib/query";
import { useAuth } from "../../state/auth";

type Site = {
  id: number;
  name: string;
  status?: string;
};

type User = {
  id: number;
  full_name: string;
  role?: string;
  status?: string;
};

type Equipment = {
  id: number;
  name: string;
  equipment_type: string;
  serial_number: string | null;
  status: string;
  site_id: number;
  supervisor_user_id: number | null;
  site?: Site | null;
  supervisor?: User | null;
  criticality: string | null;
};

type PaginatedEquipment = {
  items: Equipment[];
  total: number;
  limit: number;
  offset: number;
};

type PaginatedSites = {
  items: Site[];
};

type PaginatedUsers = {
  items: User[];
};

const DEFAULT_LIMIT = 10;

export default function ClientEquipment() {
  const { token } = useAuth();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [name, setName] = useState("");
  const [equipmentType, setEquipmentType] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [siteId, setSiteId] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [criticality, setCriticality] = useState("");
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const sitesAvailable = sites.length > 0;

  const loadEquipment = async (nextOffset = offset) => {
    if (!token) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = buildQuery({
        q: query,
        site_id: siteFilter || undefined,
        status: statusFilter || undefined,
        limit: DEFAULT_LIMIT,
        offset: nextOffset,
      });
      const data = await apiRequest<PaginatedEquipment>(`/client/equipment${params}`, { method: "GET" }, token);
      setEquipment(data.items);
      setTotal(data.total);
      setOffset(data.offset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load equipment.");
    } finally {
      setLoading(false);
    }
  };

  const loadSites = async () => {
    if (!token) {
      return;
    }
    try {
      const data = await apiRequest<PaginatedSites>("/client/sites?limit=100&offset=0&status=ACTIVE", { method: "GET" }, token);
      const activeSites = data.items.filter((site) => site.status === "ACTIVE");
      setSites(activeSites);
    } catch (err) {
      setSites([]);
    }
  };

  const loadSupervisors = async () => {
    if (!token) {
      return;
    }
    try {
      const params = buildQuery({ limit: 100, offset: 0, status: "ACTIVE" });
      const data = await apiRequest<PaginatedUsers>(`/client/users${params}`, { method: "GET" }, token);
      const activeSupers = data.items.filter((user) => user.role === "SUPERVISOR" && user.status === "ACTIVE");
      setSupervisors(activeSupers);
    } catch (err) {
      setSupervisors([]);
    }
  };

  useEffect(() => {
    loadEquipment(0);
  }, [token, query, siteFilter, statusFilter]);

  useEffect(() => {
    loadSites();
    loadSupervisors();
  }, [token]);

  const resetForm = () => {
    setEditing(null);
    setName("");
    setEquipmentType("");
    setSerialNumber("");
    setSiteId("");
    setSupervisorId("");
    setCriticality("");
    setFormMessage(null);
  };

  const startEdit = (item: Equipment) => {
    setEditing(item);
    setName(item.name);
    setEquipmentType(item.equipment_type);
    setSerialNumber(item.serial_number ?? "");
    setSiteId(String(item.site_id));
    setSupervisorId(item.supervisor_user_id ? String(item.supervisor_user_id) : "");
    setCriticality(item.criticality ?? "");
    setShowForm(true);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) {
      return;
    }
    setFormMessage(null);
    const payload = {
      name,
      equipment_type: equipmentType,
      serial_number: serialNumber || null,
      site_id: Number(siteId),
      supervisor_user_id: supervisorId ? Number(supervisorId) : null,
      criticality: criticality || null,
    };
    try {
      if (editing) {
        await apiRequest(`/client/equipment/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) }, token);
        setFormMessage("Equipment updated.");
      } else {
        await apiRequest(`/client/equipment`, { method: "POST", body: JSON.stringify(payload) }, token);
        setFormMessage("Equipment created.");
      }
      setShowForm(false);
      resetForm();
      await loadEquipment(0);
    } catch (err) {
      setFormMessage(err instanceof Error ? err.message : "Save failed.");
    }
  };

  const toggleStatus = async (item: Equipment) => {
    if (!token) {
      return;
    }
    const action = item.status === "ACTIVE" ? "inactivate" : "activate";
    if (!window.confirm(`Are you sure you want to ${action} ${item.name}?`)) {
      return;
    }
    await apiRequest(`/client/equipment/${item.id}/${action}`, { method: "POST" }, token);
    await loadEquipment(offset);
  };

  return (
    <section className="page">
      <div className="page-header">
        <h2>Equipment</h2>
        <p>Track equipment assets and assign supervisors.</p>
      </div>

      <div className="panel">
        <div className="table-toolbar">
          <input
            type="search"
            placeholder="Search equipment"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)}>
            <option value="">All sites</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <button className="primary" type="button" onClick={() => { resetForm(); setShowForm(true); }}>
            New Equipment
          </button>
        </div>

        {showForm ? (
          <form className="form-grid" onSubmit={onSubmit}>
            <label>
              Equipment name
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label>
              Equipment type
              <input value={equipmentType} onChange={(event) => setEquipmentType(event.target.value)} required />
            </label>
            <label>
              Serial number
              <input value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} />
            </label>
            <label>
              Site
              <select value={siteId} onChange={(event) => setSiteId(event.target.value)} required>
                <option value="">Select site</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Supervisor
              <select value={supervisorId} onChange={(event) => setSupervisorId(event.target.value)}>
                <option value="">Unassigned</option>
                {supervisors.map((sup) => (
                  <option key={sup.id} value={sup.id}>
                    {sup.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Criticality
              <input value={criticality} onChange={(event) => setCriticality(event.target.value)} />
            </label>
            <div className="form-actions">
              <button className="primary" type="submit" disabled={!sitesAvailable}>
                {editing ? "Save changes" : "Create equipment"}
              </button>
              <button className="ghost" type="button" onClick={() => setShowForm(false)}>
                Close
              </button>
            </div>
            {!sitesAvailable ? (
              <div className="form-error">Add an active site before creating equipment.</div>
            ) : null}
            {formMessage ? <div className="form-error">{formMessage}</div> : null}
          </form>
        ) : null}

        {loading ? (
          <div className="table-state">Loading equipment...</div>
        ) : error ? (
          <div className="form-error">{error}</div>
        ) : equipment.length === 0 ? (
          <div className="empty-state">No equipment added yet.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Site</th>
                <th>Criticality</th>
                <th>Status</th>
                <th>Supervisor</th>
                <th>Actions</th>
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
                  <td>{item.supervisor?.full_name ?? "Unassigned"}</td>
                  <td>
                    <div className="table-actions">
                      <button className="ghost" type="button" onClick={() => startEdit(item)}>
                        Edit
                      </button>
                      <button className="ghost" type="button" onClick={() => toggleStatus(item)}>
                        {item.status === "ACTIVE" ? "Inactivate" : "Activate"}
                      </button>
                    </div>
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
