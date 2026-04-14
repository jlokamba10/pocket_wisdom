import { FormEvent, useEffect, useMemo, useState } from "react";
import Pagination from "../../components/Pagination";
import StatusBadge from "../../components/StatusBadge";
import { apiRequest } from "../../lib/api";
import { buildQuery } from "../../lib/query";
import { useAuth } from "../../state/auth";

type Site = {
  id: number;
  name: string;
};

type Equipment = {
  id: number;
  name: string;
  equipment_type: string;
  serial_number: string | null;
  status: string;
  site_id: number;
  site?: Site | null;
  criticality: string | null;
};

type PaginatedEquipment = {
  items: Equipment[];
  total: number;
  limit: number;
  offset: number;
};

const DEFAULT_LIMIT = 10;

export default function SupervisorEquipment() {
  const { token } = useAuth();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
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
  const [criticality, setCriticality] = useState("");
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [siteOptions, setSiteOptions] = useState<Site[]>([]);

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

  const loadSites = async () => {
    if (!token) {
      return;
    }
    try {
      const data = await apiRequest<PaginatedEquipment>("/equipment?limit=100&offset=0", { method: "GET" }, token);
      const uniqueSites = new Map<number, Site>();
      data.items.forEach((item) => {
        if (item.site) {
          uniqueSites.set(item.site.id, item.site);
        }
      });
      setSiteOptions(Array.from(uniqueSites.values()));
    } catch {
      setSiteOptions([]);
    }
  };

  useEffect(() => {
    loadEquipment(0);
  }, [token, query, siteFilter, statusFilter]);

  useEffect(() => {
    loadSites();
  }, [token]);

  const resetForm = () => {
    setEditing(null);
    setName("");
    setEquipmentType("");
    setSerialNumber("");
    setSiteId("");
    setCriticality("");
    setFormMessage(null);
  };

  const startEdit = (item: Equipment) => {
    setEditing(item);
    setName(item.name);
    setEquipmentType(item.equipment_type);
    setSerialNumber(item.serial_number ?? "");
    setSiteId(String(item.site_id));
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
      criticality: criticality || null,
    };
    try {
      if (editing) {
        await apiRequest(`/equipment/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) }, token);
        setFormMessage("Equipment updated.");
      } else {
        await apiRequest(`/equipment`, { method: "POST", body: JSON.stringify(payload) }, token);
        setFormMessage("Equipment created.");
      }
      setShowForm(false);
      resetForm();
      await loadEquipment(0);
      await loadSites();
    } catch (err) {
      setFormMessage(err instanceof Error ? err.message : "Save failed.");
    }
  };

  const sitesInScope = useMemo(() => {
    if (siteOptions.length > 0) {
      return siteOptions;
    }
    const uniqueSites = new Map<number, Site>();
    equipment.forEach((item) => {
      if (item.site) {
        uniqueSites.set(item.site.id, item.site);
      }
    });
    return Array.from(uniqueSites.values());
  }, [siteOptions, equipment]);

  const sitesAvailable = sitesInScope.length > 0;

  return (
    <section className="page">
      <div className="page-header">
        <h2>Equipment</h2>
        <p>Track equipment assigned to your supervision scope.</p>
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
            {sitesInScope.map((site) => (
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
          <button className="primary" type="button" onClick={() => { resetForm(); setShowForm(true); }} disabled={!sitesAvailable}>
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
                {sitesInScope.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
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
              <div className="form-error">Ask a client admin to assign a site before adding equipment.</div>
            ) : null}
            {formMessage ? <div className="form-error">{formMessage}</div> : null}
          </form>
        ) : null}

        {loading ? (
          <div className="table-state">Loading equipment...</div>
        ) : error ? (
          <div className="form-error">{error}</div>
        ) : equipment.length === 0 ? (
          <div className="empty-state">No equipment assigned yet.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Site</th>
                <th>Criticality</th>
                <th>Status</th>
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
                  <td>
                    <div className="table-actions">
                      <button className="ghost" type="button" onClick={() => startEdit(item)}>
                        Edit
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
