import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Pagination from "../../components/Pagination";
import StatusBadge from "../../components/StatusBadge";
import { apiRequest } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import { buildQuery } from "../../lib/query";
import { useAuth } from "../../state/auth";

type Tenant = {
  id: number;
  name: string;
  code: string;
  status: string;
  created_at: string;
};

type PaginatedTenants = {
  items: Tenant[];
  total: number;
  limit: number;
  offset: number;
};

const DEFAULT_LIMIT = 10;

export default function SystemClients() {
  const { token } = useAuth();
  const [clients, setClients] = useState<Tenant[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Tenant | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const loadClients = async (nextOffset = offset) => {
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
      const data = await apiRequest<PaginatedTenants>(`/clients${params}`, { method: "GET" }, token);
      setClients(data.items);
      setTotal(data.total);
      setOffset(data.offset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load clients.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients(0);
  }, [token, query, statusFilter]);

  const resetForm = () => {
    setName("");
    setCode("");
    setEditingClient(null);
    setFormMessage(null);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) {
      return;
    }
    try {
      if (editingClient) {
        await apiRequest(`/clients/${editingClient.id}`, {
          method: "PUT",
          body: JSON.stringify({ name, code }),
        }, token);
        setFormMessage("Client updated.");
      } else {
        await apiRequest(`/clients`, {
          method: "POST",
          body: JSON.stringify({ name, code }),
        }, token);
        setFormMessage("Client created.");
      }
      resetForm();
      setShowForm(false);
      await loadClients(0);
    } catch (err) {
      setFormMessage(err instanceof Error ? err.message : "Save failed.");
    }
  };

  const toggleStatus = async (client: Tenant) => {
    if (!token) {
      return;
    }
    const action = client.status === "ACTIVE" ? "inactivate" : "activate";
    if (!window.confirm(`Are you sure you want to ${action} ${client.name}?`)) {
      return;
    }
    await apiRequest(`/clients/${client.id}/${action}`, { method: "POST" }, token);
    await loadClients(offset);
  };

  const startEdit = (client: Tenant) => {
    setEditingClient(client);
    setName(client.name);
    setCode(client.code);
    setShowForm(true);
  };

  return (
    <section className="page">
      <div className="page-header">
        <h2>Clients</h2>
        <p>Provision and manage tenant accounts.</p>
      </div>

      <div className="panel">
        <div className="table-toolbar">
          <input
            type="search"
            placeholder="Search clients"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <button
            className="primary"
            type="button"
            onClick={() => {
              resetForm();
              setShowForm((prev) => !prev);
            }}
          >
            {showForm ? "Close" : "New Client"}
          </button>
        </div>

        {showForm ? (
          <form className="form-grid" onSubmit={onSubmit}>
            <label>
              Client name
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label>
              Client code
              <input value={code} onChange={(event) => setCode(event.target.value)} required />
            </label>
            <div className="form-actions">
              <button className="primary" type="submit">
                {editingClient ? "Save Changes" : "Create Client"}
              </button>
            </div>
            {formMessage ? <div className="form-error">{formMessage}</div> : null}
          </form>
        ) : null}

        {loading ? (
          <div className="table-state">Loading clients...</div>
        ) : error ? (
          <div className="form-error">{error}</div>
        ) : clients.length === 0 ? (
          <div className="empty-state">No clients yet. Add your first tenant.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Code</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id}>
                  <td>{client.name}</td>
                  <td>{client.code}</td>
                  <td>
                    <StatusBadge status={client.status} />
                  </td>
                  <td>{formatDateTime(client.created_at)}</td>
                  <td>
                    <div className="table-actions">
                      <Link className="link" to={`/app/system/clients/${client.id}`}>
                        View
                      </Link>
                      <button className="ghost" type="button" onClick={() => startEdit(client)}>
                        Edit
                      </button>
                      <button className="ghost" type="button" onClick={() => toggleStatus(client)}>
                        {client.status === "ACTIVE" ? "Inactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <Pagination total={total} limit={DEFAULT_LIMIT} offset={offset} onPageChange={loadClients} />
      </div>
    </section>
  );
}
