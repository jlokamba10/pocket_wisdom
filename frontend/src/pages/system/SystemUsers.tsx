import { FormEvent, useEffect, useState } from "react";
import Pagination from "../../components/Pagination";
import StatusBadge from "../../components/StatusBadge";
import { apiRequest } from "../../lib/api";
import { buildQuery } from "../../lib/query";
import { useAuth } from "../../state/auth";

type Tenant = {
  id: number;
  name: string;
  code: string;
  status: string;
};

type User = {
  id: number;
  email: string;
  full_name: string;
  role: string;
  status: string;
  tenant_id: number | null;
  supervisor_user_id: number | null;
  tenant?: Tenant | null;
};

type PaginatedUsers = {
  items: User[];
  total: number;
  limit: number;
  offset: number;
};

type PaginatedTenants = {
  items: Tenant[];
};

const DEFAULT_LIMIT = 12;

export default function SystemUsers() {
  const { token } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tenantFilter, setTenantFilter] = useState("");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState("SYSTEM_ADMIN");
  const [formTenantId, setFormTenantId] = useState("");
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
        tenant_id: tenantFilter || undefined,
        limit: DEFAULT_LIMIT,
        offset: nextOffset,
      });
      const data = await apiRequest<PaginatedUsers>(`/users${params}`, { method: "GET" }, token);
      setUsers(data.items);
      setTotal(data.total);
      setOffset(data.offset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load users.");
    } finally {
      setLoading(false);
    }
  };

  const loadTenants = async () => {
    if (!token) {
      return;
    }
    try {
      const data = await apiRequest<PaginatedTenants>("/clients?limit=100&offset=0&status=ACTIVE", { method: "GET" }, token);
      setTenants(data.items.filter((tenant) => tenant.status === "ACTIVE" || !tenant.status));
    } catch {
      setTenants([]);
    }
  };

  const loadSupervisors = async (tenantId: string) => {
    if (!token || !tenantId) {
      setSupervisors([]);
      return;
    }
    try {
      const params = buildQuery({ tenant_id: tenantId, limit: 100, offset: 0, status: "ACTIVE" });
      const data = await apiRequest<PaginatedUsers>(`/users${params}`, { method: "GET" }, token);
      setSupervisors(data.items.filter((user) => user.role === "SUPERVISOR"));
    } catch {
      setSupervisors([]);
    }
  };

  useEffect(() => {
    loadUsers(0);
  }, [token, query, roleFilter, statusFilter, tenantFilter]);

  useEffect(() => {
    loadTenants();
  }, [token]);

  useEffect(() => {
    const tenantId = formRole === "SYSTEM_ADMIN" ? "" : formTenantId;
    if (tenantId) {
      loadSupervisors(tenantId);
    } else {
      setSupervisors([]);
    }
  }, [formRole, formTenantId, token]);

  useEffect(() => {
    if (formRole !== "ENGINEER" && formRole !== "TECHNICIAN") {
      setFormSupervisorId("");
    }
  }, [formRole]);

  const resetForm = () => {
    setEditingUser(null);
    setFormName("");
    setFormEmail("");
    setFormRole("SYSTEM_ADMIN");
    setFormTenantId("");
    setFormSupervisorId("");
    setFormMessage(null);
    setTempPassword(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const startEdit = (user: User) => {
    setEditingUser(user);
    setFormName(user.full_name);
    setFormEmail(user.email);
    setFormRole(user.role);
    setFormTenantId(user.tenant_id ? String(user.tenant_id) : "");
    setFormSupervisorId(user.supervisor_user_id ? String(user.supervisor_user_id) : "");
    setShowForm(true);
  };

  const supervisorRequired = formRole === "ENGINEER" || formRole === "TECHNICIAN";
  const effectiveSupervisors =
    supervisors.length > 0
      ? supervisors
      : users.filter(
          (user) => user.role === "SUPERVISOR" && user.status === "ACTIVE" && String(user.tenant_id) === formTenantId
        );
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
    try {
      const supervisorValue =
        formRole === "ENGINEER" || formRole === "TECHNICIAN"
          ? formSupervisorId
            ? Number(formSupervisorId)
            : null
          : null;
      const payload = {
        full_name: formName,
        role: formRole,
        tenant_id: formRole === "SYSTEM_ADMIN" ? null : Number(formTenantId),
        supervisor_user_id: supervisorValue,
      };
      if (editingUser) {
        await apiRequest(`/users/${editingUser.id}`, { method: "PUT", body: JSON.stringify(payload) }, token);
        setFormMessage("User updated.");
      } else {
        const createPayload = { ...payload, email: formEmail };
        const response = await apiRequest<{ temporary_password: string }>(
          "/users",
          { method: "POST", body: JSON.stringify(createPayload) },
          token
        );
        setTempPassword(response.temporary_password);
        setFormMessage("User created.");
      }
      await loadUsers(0);
    } catch (err) {
      setFormMessage(err instanceof Error ? err.message : "Save failed.");
    }
  };

  const toggleStatus = async (user: User) => {
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

  const resetPassword = async (user: User) => {
    if (!token) {
      return;
    }
    if (!window.confirm(`Reset password for ${user.full_name}?`)) {
      return;
    }
    const response = await apiRequest<{ temporary_password: string }>(
      `/users/${user.id}/reset-password`,
      { method: "POST" },
      token
    );
    setTempPassword(response.temporary_password);
  };

  return (
    <section className="page">
      <div className="page-header">
        <h2>Global Users</h2>
        <p>Manage users, roles, and access across tenants.</p>
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
            <option value="SYSTEM_ADMIN">SYSTEM_ADMIN</option>
            <option value="CLIENT_ADMIN">CLIENT_ADMIN</option>
            <option value="SUPERVISOR">SUPERVISOR</option>
            <option value="ENGINEER">ENGINEER</option>
            <option value="TECHNICIAN">TECHNICIAN</option>
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <select value={tenantFilter} onChange={(event) => setTenantFilter(event.target.value)}>
            <option value="">All clients</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
          <button className="primary" type="button" onClick={openCreate}>
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
                disabled={Boolean(editingUser)}
              />
            </label>
            <label>
              Role
              <select value={formRole} onChange={(event) => setFormRole(event.target.value)}>
                <option value="SYSTEM_ADMIN">SYSTEM_ADMIN</option>
                <option value="CLIENT_ADMIN">CLIENT_ADMIN</option>
                <option value="SUPERVISOR">SUPERVISOR</option>
                <option value="ENGINEER">ENGINEER</option>
                <option value="TECHNICIAN">TECHNICIAN</option>
              </select>
            </label>
            <label>
              Tenant
              <select
                value={formTenantId}
                onChange={(event) => setFormTenantId(event.target.value)}
                disabled={formRole === "SYSTEM_ADMIN"}
                required={formRole !== "SYSTEM_ADMIN"}
              >
                <option value="">Select tenant</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Supervisor (optional)
              <select
                value={formSupervisorId}
                onChange={(event) => setFormSupervisorId(event.target.value)}
                disabled={!formTenantId || (formRole !== "ENGINEER" && formRole !== "TECHNICIAN")}
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
            {supervisorRequired && formTenantId && !supervisorsAvailable ? (
              <div className="form-error">Add a supervisor before creating this role.</div>
            ) : null}
            <div className="form-actions">
              <button
                className="primary"
                type="submit"
                disabled={supervisorRequired && formTenantId !== "" && !supervisorsAvailable}
              >
                {editingUser ? "Save changes" : "Create user"}
              </button>
              <button className="ghost" type="button" onClick={() => setShowForm(false)}>
                Close
              </button>
            </div>
            {formMessage ? <div className="form-error">{formMessage}</div> : null}
          </form>
        ) : null}

        {tempPassword ? (
          <div className="form-success">Temporary password: {tempPassword}</div>
        ) : null}

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
                <th>Tenant</th>
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
                  <td>{user.tenant?.name ?? "Platform"}</td>
                  <td>
                    <div className="table-actions">
                      <button className="ghost" type="button" onClick={() => startEdit(user)}>
                        Edit
                      </button>
                      <button className="ghost" type="button" onClick={() => toggleStatus(user)}>
                        {user.status === "ACTIVE" ? "Inactivate" : "Activate"}
                      </button>
                      <button className="ghost" type="button" onClick={() => resetPassword(user)}>
                        Reset Password
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
