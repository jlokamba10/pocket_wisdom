import { FormEvent, useEffect, useState } from "react";
import Pagination from "../../components/Pagination";
import StatusBadge from "../../components/StatusBadge";
import { apiRequest } from "../../lib/api";
import { buildQuery } from "../../lib/query";
import { useAuth } from "../../state/auth";

type Site = {
  id: number;
  name: string;
  location: string | null;
  status: string;
};

type PaginatedSites = {
  items: Site[];
  total: number;
  limit: number;
  offset: number;
};

const DEFAULT_LIMIT = 10;

export default function ClientSites() {
  const { token } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Site | null>(null);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const loadSites = async (nextOffset = offset) => {
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
      const data = await apiRequest<PaginatedSites>(`/client/sites${params}`, { method: "GET" }, token);
      setSites(data.items);
      setTotal(data.total);
      setOffset(data.offset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load sites.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSites(0);
  }, [token, query, statusFilter]);

  const resetForm = () => {
    setEditing(null);
    setName("");
    setLocation("");
    setFormMessage(null);
  };

  const startEdit = (site: Site) => {
    setEditing(site);
    setName(site.name);
    setLocation(site.location ?? "");
    setShowForm(true);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) {
      return;
    }
    setFormMessage(null);
    const payload = { name, location: location || null };
    try {
      if (editing) {
        await apiRequest(`/client/sites/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) }, token);
        setFormMessage("Site updated.");
      } else {
        await apiRequest(`/client/sites`, { method: "POST", body: JSON.stringify(payload) }, token);
        setFormMessage("Site created.");
      }
      setShowForm(false);
      resetForm();
      await loadSites(0);
    } catch (err) {
      setFormMessage(err instanceof Error ? err.message : "Save failed.");
    }
  };

  const toggleStatus = async (site: Site) => {
    if (!token) {
      return;
    }
    const action = site.status === "ACTIVE" ? "inactivate" : "activate";
    if (!window.confirm(`Are you sure you want to ${action} ${site.name}?`)) {
      return;
    }
    await apiRequest(`/client/sites/${site.id}/${action}`, { method: "POST" }, token);
    await loadSites(offset);
  };

  return (
    <section className="page">
      <div className="page-header">
        <h2>Sites</h2>
        <p>Manage facility locations and operational hubs.</p>
      </div>

      <div className="panel">
        <div className="table-toolbar">
          <input
            type="search"
            placeholder="Search sites"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <button className="primary" type="button" onClick={() => { resetForm(); setShowForm(true); }}>
            New Site
          </button>
        </div>

        {showForm ? (
          <form className="form-grid" onSubmit={onSubmit}>
            <label>
              Site name
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label>
              Location
              <input value={location} onChange={(event) => setLocation(event.target.value)} />
            </label>
            <div className="form-actions">
              <button className="primary" type="submit">
                {editing ? "Save changes" : "Create site"}
              </button>
              <button className="ghost" type="button" onClick={() => setShowForm(false)}>
                Close
              </button>
            </div>
            {formMessage ? <div className="form-error">{formMessage}</div> : null}
          </form>
        ) : null}

        {loading ? (
          <div className="table-state">Loading sites...</div>
        ) : error ? (
          <div className="form-error">{error}</div>
        ) : sites.length === 0 ? (
          <div className="empty-state">No sites configured.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Site</th>
                <th>Location</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((site) => (
                <tr key={site.id}>
                  <td>{site.name}</td>
                  <td>{site.location ?? "-"}</td>
                  <td>
                    <StatusBadge status={site.status} />
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="ghost" type="button" onClick={() => startEdit(site)}>
                        Edit
                      </button>
                      <button className="ghost" type="button" onClick={() => toggleStatus(site)}>
                        {site.status === "ACTIVE" ? "Inactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <Pagination total={total} limit={DEFAULT_LIMIT} offset={offset} onPageChange={loadSites} />
      </div>
    </section>
  );
}
