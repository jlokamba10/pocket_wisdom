import { FormEvent, useEffect, useState } from "react";
import Pagination from "../../components/Pagination";
import StatusBadge from "../../components/StatusBadge";
import { apiRequest } from "../../lib/api";
import { buildQuery } from "../../lib/query";
import { useAuth } from "../../state/auth";

type TeamMember = {
  id: number;
  email: string;
  full_name: string;
  role: string;
  status: string;
};

type PaginatedUsers = {
  items: TeamMember[];
  total: number;
  limit: number;
  offset: number;
};

const DEFAULT_LIMIT = 10;

export default function SupervisorTeam() {
  const { token } = useAuth();
  const [users, setUsers] = useState<TeamMember[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState("ENGINEER");
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
      const data = await apiRequest<PaginatedUsers>(`/users${params}`, { method: "GET" }, token);
      setUsers(data.items);
      setTotal(data.total);
      setOffset(data.offset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load team members.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers(0);
  }, [token, query, roleFilter, statusFilter]);

  const resetForm = () => {
    setEditing(null);
    setFormName("");
    setFormEmail("");
    setFormRole("ENGINEER");
    setFormMessage(null);
    setTempPassword(null);
  };

  const startEdit = (user: TeamMember) => {
    setEditing(user);
    setFormName(user.full_name);
    setFormEmail(user.email);
    setFormRole(user.role);
    setShowForm(true);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) {
      return;
    }
    setFormMessage(null);
    setTempPassword(null);
    const payload = {
      full_name: formName,
      role: formRole,
      supervisor_user_id: null,
    };
    try {
      if (editing) {
        await apiRequest(`/users/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) }, token);
        setFormMessage("Team member updated.");
      } else {
        const response = await apiRequest<{ temporary_password: string }>(
          "/users",
          { method: "POST", body: JSON.stringify({ ...payload, email: formEmail }) },
          token
        );
        setTempPassword(response.temporary_password);
        setFormMessage("Team member created.");
      }
      setShowForm(false);
      await loadUsers(0);
    } catch (err) {
      setFormMessage(err instanceof Error ? err.message : "Save failed.");
    }
  };

  const toggleStatus = async (user: TeamMember) => {
    if (!token) {
      return;
    }
    const action = user.status === "ACTIVE" ? "inactivate" : "activate";
    if (!window.confirm(`Are you sure you want to ${action} ${user.full_name}?`)) {
      return;
    }
    await apiRequest(`/users/${user.id}/${action}`, { method: "POST" }, token);
    await loadUsers(offset);
  };

  return (
    <section className="page">
      <div className="page-header">
        <h2>Team</h2>
        <p>Assign engineers and technicians to your operational scope.</p>
      </div>

      <div className="panel">
        <div className="table-toolbar">
          <input
            type="search"
            placeholder="Search team"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="">All roles</option>
            <option value="ENGINEER">ENGINEER</option>
            <option value="TECHNICIAN">TECHNICIAN</option>
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <button className="primary" type="button" onClick={() => { resetForm(); setShowForm(true); }}>
            Add Team Member
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
                <option value="ENGINEER">ENGINEER</option>
                <option value="TECHNICIAN">TECHNICIAN</option>
              </select>
            </label>
            <div className="form-actions">
              <button className="primary" type="submit">
                {editing ? "Save changes" : "Create team member"}
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
          <div className="table-state">Loading team members...</div>
        ) : error ? (
          <div className="form-error">{error}</div>
        ) : users.length === 0 ? (
          <div className="empty-state">No team members assigned yet.</div>
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
                    <div className="table-actions">
                      <button className="ghost" type="button" onClick={() => startEdit(user)}>
                        Edit
                      </button>
                      <button className="ghost" type="button" onClick={() => toggleStatus(user)}>
                        {user.status === "ACTIVE" ? "Inactivate" : "Activate"}
                      </button>
                    </div>
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
