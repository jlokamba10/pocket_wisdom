import { FormEvent, useEffect, useState } from "react";
import Pagination from "../../components/Pagination";
import StatusBadge from "../../components/StatusBadge";
import { apiRequest } from "../../lib/api";
import { buildQuery } from "../../lib/query";
import { useAuth } from "../../state/auth";

type User = {
  id: number;
  email: string;
  full_name: string;
  role: string;
  status: string;
  supervisor_user_id: number | null;
};

type PaginatedUsers = {
  items: User[];
  total: number;
  limit: number;
  offset: number;
};

const DEFAULT_LIMIT = 10;
const MANAGED_ROLES = new Set(["SUPERVISOR", "ENGINEER", "TECHNICIAN"]);

export default function ClientUsers() {
  const { token } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState("SUPERVISOR");
  const [formSupervisorId, setFormSupervisorId] = useState("");
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const loadUsers = async (nextOffset = offset) => {
    if (!token) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = buildQuery({
        q: query,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        limit: DEFAULT_LIMIT,
        offset: nextOffset,
      });
      const data = await apiRequest<PaginatedUsers>(`/client/users${params}`, { method: "GET" }, token);
      setUsers(data.items);
      setTotal(data.total);
      setOffset(data.offset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load users.");
    } finally {
      setLoading(false);
    }
  };

  const loadSupervisors = async () => {
    if (!token) {
      return;
    }
    try {
      const params = buildQuery({ limit: 100, offset: 0, status: "ACTIVE" });
      const data = await apiRequest<PaginatedUsers>(`/client/users${params}`, { method: "GET" }, token);
      setSupervisors(data.items.filter((user) => user.role === "SUPERVISOR"));
    } catch {
      setSupervisors([]);
    }
  };

  useEffect(() => {
    loadUsers(0);
  }, [token, query, roleFilter, statusFilter]);

  useEffect(() => {
    loadSupervisors();
  }, [token]);

  useEffect(() => {
    if (formRole !== "ENGINEER" && formRole !== "TECHNICIAN") {
      setFormSupervisorId("");
    }
  }, [formRole]);

  const resetForm = () => {
    setEditing(null);
    setFormName("");
    setFormEmail("");
    setFormRole("SUPERVISOR");
    setFormSupervisorId("");
    setFormMessage(null);
    setTempPassword(null);
  };

  const startEdit = (user: User) => {
    if (!MANAGED_ROLES.has(user.role)) {
      return;
    }
    setEditing(user);
    setFormName(user.full_name);
    setFormEmail(user.email);
    setFormRole(user.role);
    setFormSupervisorId(user.supervisor_user_id ? String(user.supervisor_user_id) : "");
    setShowForm(true);
  };

  const supervisorRequired = formRole === "ENGINEER" || formRole === "TECHNICIAN";
  const effectiveSupervisors =
    supervisors.length > 0
      ? supervisors
      : users.filter((user) => user.role === "SUPERVISOR" && user.status === "ACTIVE");
  const supervisorsAvailable = effectiveSupervisors.length > 0;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) {
      return;
    }
    setFormMessage(null);
    setTempPassword(null);
    if (supervisorRequired && !formSupervisorId) {
      setFormMessage("Supervisor is required for engineers and technicians.");
      return;
    }
    const supervisorValue =
      formRole === "ENGINEER" || formRole === "TECHNICIAN"
        ? formSupervisorId
          ? Number(formSupervisorId)
          : null
        : null;
    const payload = {
      full_name: formName,
      role: formRole,
      supervisor_user_id: supervisorValue,
    };
    try {
      if (editing) {
        await apiRequest(`/client/users/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) }, token);
        setFormMessage("User updated.");
      } else {
        const response = await apiRequest<{ temporary_password: string }>(
          "/client/users",
          { method: "POST", body: JSON.stringify({ ...payload, email: formEmail }) },
          token
        );
        setTempPassword(response.temporary_password);
        setFormMessage("User created.");
      }
      setShowForm(false);
      await loadUsers(0);
      await loadSupervisors();
    } catch (err) {
      setFormMessage(err instanceof Error ? err.message : "Save failed.");
    }
  };

  const toggleStatus = async (user: User) => {
    if (!token) {
      return;
    }
    if (!MANAGED_ROLES.has(user.role)) {
      return;
    }
    const action = user.status === "ACTIVE" ? "inactivate" : "activate";
    if (!window.confirm(`Are you sure you want to ${action} ${user.full_name}?`)) {
      return;
    }
    await apiRequest(`/client/users/${user.id}/${action}`, { method: "POST" }, token);
    await loadUsers(offset);
  };

  return (
    <section className="page">
      <div className="page-header">
        <h2>Tenant Users</h2>
        <p>Manage supervisors, engineers, and technicians in your tenant.</p>
      </div>

      <div className="panel">
        <div className="table-toolbar">
          <input
            type="search"
            placeholder="Search users"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="">All roles</option>
            <option value="SUPERVISOR">SUPERVISOR</option>
            <option value="ENGINEER">ENGINEER</option>
            <option value="TECHNICIAN">TECHNICIAN</option>
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <button className="primary" type="button" onClick={() => { resetForm(); setShowForm(true); }}>
            New User
          </button>
        </div>

        {showForm ? (
          <form className="form-grid" onSubmit={onSubmit}>
            <label>
              Full name
              <input value={formName} onChange={(event) => setFormName(event.target.value)} required />
            </label>
            <label>
              Email
              <input
                type="email"
                value={formEmail}
                onChange={(event) => setFormEmail(event.target.value)}
                required
                disabled={Boolean(editing)}
              />
            </label>
            <label>
              Role
              <select value={formRole} onChange={(event) => setFormRole(event.target.value)}>
                <option value="SUPERVISOR">SUPERVISOR</option>
                <option value="ENGINEER">ENGINEER</option>
                <option value="TECHNICIAN">TECHNICIAN</option>
              </select>
            </label>
            <label>
              Supervisor
              <select
                value={formSupervisorId}
                onChange={(event) => setFormSupervisorId(event.target.value)}
                disabled={formRole !== "ENGINEER" && formRole !== "TECHNICIAN"}
                required={supervisorRequired}
              >
                <option value="">{supervisorRequired ? "Select supervisor" : "No supervisor"}</option>
                {effectiveSupervisors.map((supervisor) => (
                  <option key={supervisor.id} value={supervisor.id}>
                    {supervisor.full_name}
                  </option>
                ))}
              </select>
            </label>
            {supervisorRequired && !supervisorsAvailable ? (
              <div className="form-error">Add a supervisor before creating this role.</div>
            ) : null}
            <div className="form-actions">
              <button className="primary" type="submit" disabled={supervisorRequired && !supervisorsAvailable}>
                {editing ? "Save changes" : "Create user"}
              </button>
              <button className="ghost" type="button" onClick={() => setShowForm(false)}>
                Close
              </button>
            </div>
            {formMessage ? <div className="form-error">{formMessage}</div> : null}
          </form>
        ) : null}

        {tempPassword ? <div className="form-success">Temporary password: {tempPassword}</div> : null}

        {loading ? (
          <div className="table-state">Loading users...</div>
        ) : error ? (
          <div className="form-error">{error}</div>
        ) : users.length === 0 ? (
          <div className="empty-state">No users yet.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
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
                  <td>
                    {MANAGED_ROLES.has(user.role) ? (
                      <div className="table-actions">
                        <button className="ghost" type="button" onClick={() => startEdit(user)}>
                          Edit
                        </button>
                        <button className="ghost" type="button" onClick={() => toggleStatus(user)}>
                          {user.status === "ACTIVE" ? "Inactivate" : "Activate"}
                        </button>
                      </div>
                    ) : (
                      <span className="muted">Restricted</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <Pagination total={total} limit={DEFAULT_LIMIT} offset={offset} onPageChange={loadUsers} />
      </div>
    </section>
  );
}
