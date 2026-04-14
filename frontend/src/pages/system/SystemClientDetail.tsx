import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import StatusBadge from "../../components/StatusBadge";
import { apiRequest } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import { useAuth } from "../../state/auth";

type UserSummary = {
  id: number;
  full_name: string;
  email: string;
  role: string;
  status: string;
};

type AuditEntry = {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  user?: UserSummary | null;
};

type TenantDetail = {
  tenant: {
    id: number;
    name: string;
    code: string;
    status: string;
    created_at: string;
  };
  active_users: number;
  inactive_users: number;
  equipment_count: number;
  sensor_count: number;
  open_alerts: number;
  client_admins: UserSummary[];
  recent_activity: AuditEntry[];
};

type PaginatedUsers = {
  items: UserSummary[];
  total: number;
};

export default function SystemClientDetail() {
  const { id } = useParams();
  const { token } = useAuth();
  const [detail, setDetail] = useState<TenantDetail | null>(null);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminPassword, setAdminPassword] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadDetail = async () => {
    if (!token || !id) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<TenantDetail>(`/clients/${id}`, { method: "GET" }, token);
      setDetail(data);
      setName(data.tenant.name);
      setCode(data.tenant.code);

      const usersResponse = await apiRequest<PaginatedUsers>(
        `/users?tenant_id=${id}&limit=8&offset=0`,
        { method: "GET" },
        token
      );
      setUsers(usersResponse.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load client.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [token, id]);

  const updateClient = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !id) {
      return;
    }
    setActionError(null);
    try {
      await apiRequest(`/clients/${id}`, { method: "PUT", body: JSON.stringify({ name, code }) }, token);
      setEditing(false);
      await loadDetail();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to update client.");
    }
  };

  const toggleStatus = async () => {
    if (!token || !detail) {
      return;
    }
    const action = detail.tenant.status === "ACTIVE" ? "inactivate" : "activate";
    if (!window.confirm(`Are you sure you want to ${action} ${detail.tenant.name}?`)) {
      return;
    }
    setActionError(null);
    try {
      await apiRequest(`/clients/${detail.tenant.id}/${action}`, { method: "POST" }, token);
      await loadDetail();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to update status.");
    }
  };

  const onboardAdmin = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !detail) {
      return;
    }
    setAdminError(null);
    setAdminPassword(null);
    try {
      const response = await apiRequest<{ temporary_password: string }>(
        "/users",
        {
          method: "POST",
          body: JSON.stringify({
            email: adminEmail,
            full_name: adminName,
            role: "CLIENT_ADMIN",
            tenant_id: detail.tenant.id,
          }),
        },
        token
      );
      setAdminPassword(response.temporary_password);
      setAdminEmail("");
      setAdminName("");
      await loadDetail();
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "Failed to onboard client admin.");
    }
  };

  if (loading) {
    return (
      <section className="page center">
        <div className="loader" />
        <p>Loading client profile...</p>
      </section>
    );
  }

  if (error || !detail) {
    return (
      <section className="page">
        <div className="form-error">{error ?? "Client not found."}</div>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-header">
        <h2>{detail.tenant.name}</h2>
        <p>Client overview and onboarding actions.</p>
      </div>
      {actionError ? <div className="form-error">{actionError}</div> : null}

      <div className="card-grid">
        <div className="card">
          <h3>Status</h3>
          <StatusBadge status={detail.tenant.status} />
        </div>
        <div className="card">
          <h3>Active Users</h3>
          <p className="metric">{detail.active_users}</p>
        </div>
        <div className="card">
          <h3>Inactive Users</h3>
          <p className="metric">{detail.inactive_users}</p>
        </div>
        <div className="card">
          <h3>Equipment</h3>
          <p className="metric">{detail.equipment_count}</p>
        </div>
        <div className="card">
          <h3>Sensors</h3>
          <p className="metric">{detail.sensor_count}</p>
        </div>
        <div className="card">
          <h3>Open Alerts</h3>
          <p className="metric">{detail.open_alerts}</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>Client Details</h3>
          <div className="table-actions">
            <button className="ghost" type="button" onClick={() => setEditing((prev) => !prev)}>
              {editing ? "Cancel" : "Edit"}
            </button>
            <button className="ghost" type="button" onClick={toggleStatus}>
              {detail.tenant.status === "ACTIVE" ? "Inactivate" : "Activate"}
            </button>
          </div>
        </div>
        {editing ? (
          <form className="form-grid" onSubmit={updateClient}>
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
                Save changes
              </button>
            </div>
          </form>
        ) : (
          <div className="details-grid">
            <div>
              <span className="muted">Client code</span>
              <strong>{detail.tenant.code}</strong>
            </div>
            <div>
              <span className="muted">Created</span>
              <strong>{formatDateTime(detail.tenant.created_at)}</strong>
            </div>
          </div>
        )}
      </div>

      <div className="panel">
        <h3>Onboard Client Admin</h3>
        <form className="form-grid" onSubmit={onboardAdmin}>
          <label>
            Admin name
            <input value={adminName} onChange={(event) => setAdminName(event.target.value)} required />
          </label>
          <label>
            Admin email
            <input type="email" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} required />
          </label>
          <div className="form-actions">
            <button className="primary" type="submit">
              Create Client Admin
            </button>
          </div>
          {adminError ? <div className="form-error">{adminError}</div> : null}
          {adminPassword ? (
            <div className="form-success">
              Temporary password: <strong>{adminPassword}</strong>
            </div>
          ) : null}
        </form>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>Tenant Users</h3>
          <Link className="link" to="/app/system/users">
            Manage all users
          </Link>
        </div>
        {users.length === 0 ? (
          <div className="empty-state">No users found.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.full_name}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>
                    <StatusBadge status={user.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <h3>Recent Activity</h3>
        {detail.recent_activity.length === 0 ? (
          <div className="empty-state">No activity logged yet.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Entity</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {detail.recent_activity.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.action}</td>
                  <td>
                    {entry.entity_type} {entry.entity_id ?? ""}
                  </td>
                  <td>{formatDateTime(entry.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
