import { FormEvent, useEffect, useState } from "react";
import ConfirmDialog from "../../components/ConfirmDialog";
import Pagination from "../../components/Pagination";
import StatusBadge from "../../components/StatusBadge";
import TableToolbar from "../../components/TableToolbar";
import { apiRequest } from "../../lib/api";
import { buildQuery } from "../../lib/query";
import { useAuth } from "../../state/auth";

type DashboardTemplate = {
  id: number;
  name: string;
  code: string;
  description: string | null;
  grafana_uid: string | null;
  equipment_type: string | null;
  is_active: boolean;
};

type PaginatedTemplates = {
  items: DashboardTemplate[];
  total: number;
  limit: number;
  offset: number;
};

const DEFAULT_LIMIT = 10;

export default function SystemTemplates() {
  const { token } = useAuth();
  const [templates, setTemplates] = useState<DashboardTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DashboardTemplate | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [grafanaUid, setGrafanaUid] = useState("");
  const [equipmentType, setEquipmentType] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    template: DashboardTemplate;
    action: "activate" | "inactivate";
  } | null>(null);

  const loadTemplates = async (nextOffset = offset) => {
    if (!token) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = buildQuery({
        q: query,
        equipment_type: equipmentFilter || undefined,
        active: statusFilter ? statusFilter === "ACTIVE" : undefined,
        limit: DEFAULT_LIMIT,
        offset: nextOffset,
      });
      const data = await apiRequest<PaginatedTemplates>(`/dashboard-templates${params}`, { method: "GET" }, token);
      setTemplates(data.items);
      setTotal(data.total);
      setOffset(data.offset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load templates.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates(0);
  }, [token, query, equipmentFilter, statusFilter]);

  const resetForm = () => {
    setEditing(null);
    setName("");
    setCode("");
    setDescription("");
    setGrafanaUid("");
    setEquipmentType("");
    setIsActive(true);
    setFormMessage(null);
  };

  const startEdit = (template: DashboardTemplate) => {
    setEditing(template);
    setName(template.name);
    setCode(template.code);
    setDescription(template.description ?? "");
    setGrafanaUid(template.grafana_uid ?? "");
    setEquipmentType(template.equipment_type ?? "");
    setIsActive(template.is_active);
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
      code,
      description: description || null,
      grafana_uid: grafanaUid || null,
      equipment_type: equipmentType || null,
      is_active: isActive,
    };
    try {
      if (editing) {
        await apiRequest(`/dashboard-templates/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) }, token);
        setFormMessage("Template updated.");
      } else {
        await apiRequest(`/dashboard-templates`, { method: "POST", body: JSON.stringify(payload) }, token);
        setFormMessage("Template created.");
      }
      setShowForm(false);
      resetForm();
      await loadTemplates(0);
    } catch (err) {
      setFormMessage(err instanceof Error ? err.message : "Save failed.");
    }
  };

  const requestToggle = (template: DashboardTemplate) => {
    const action = template.is_active ? "inactivate" : "activate";
    setConfirmAction({ template, action });
  };

  const confirmToggle = async () => {
    if (!token || !confirmAction) {
      return;
    }
    await apiRequest(`/dashboard-templates/${confirmAction.template.id}/${confirmAction.action}`, { method: "POST" }, token);
    setConfirmAction(null);
    await loadTemplates(offset);
  };

  return (
    <section className="page">
      <div className="page-header">
        <h2>Dashboard Templates</h2>
        <p>Curate reusable dashboards by equipment type.</p>
      </div>

      <div className="panel">
        <TableToolbar>
          <input
            type="search"
            placeholder="Search templates"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <input
            type="text"
            placeholder="Equipment type"
            value={equipmentFilter}
            onChange={(event) => setEquipmentFilter(event.target.value.toUpperCase())}
          />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All status</option>
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
            {showForm ? "Close" : "New Template"}
          </button>
        </TableToolbar>

        {showForm ? (
          <form className="form-grid" onSubmit={onSubmit}>
            <label>
              Template name
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label>
              Template code
              <input value={code} onChange={(event) => setCode(event.target.value)} required />
            </label>
            <label>
              Grafana UID
              <input value={grafanaUid} onChange={(event) => setGrafanaUid(event.target.value)} />
            </label>
            <label>
              Equipment type
              <input value={equipmentType} onChange={(event) => setEquipmentType(event.target.value)} />
            </label>
            <label className="full">
              Description
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
            </label>
            <label>
              Active
              <select value={isActive ? "yes" : "no"} onChange={(event) => setIsActive(event.target.value === "yes")}>
                <option value="yes">Active</option>
                <option value="no">Inactive</option>
              </select>
            </label>
            <div className="form-actions">
              <button className="primary" type="submit">
                {editing ? "Save Template" : "Create Template"}
              </button>
            </div>
            {formMessage ? <div className="form-error">{formMessage}</div> : null}
          </form>
        ) : null}

        {loading ? (
          <div className="table-state">Loading templates...</div>
        ) : error ? (
          <div className="form-error">{error}</div>
        ) : templates.length === 0 ? (
          <div className="empty-state">No templates configured yet.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Equipment Type</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id}>
                  <td>{template.name}</td>
                  <td>{template.code}</td>
                  <td>{template.equipment_type ?? "All"}</td>
                  <td>
                    <StatusBadge status={template.is_active ? "ACTIVE" : "INACTIVE"} />
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="ghost" type="button" onClick={() => startEdit(template)}>
                        Edit
                      </button>
                      <button className="ghost" type="button" onClick={() => requestToggle(template)}>
                        {template.is_active ? "Inactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <Pagination total={total} limit={DEFAULT_LIMIT} offset={offset} onPageChange={loadTemplates} />
      </div>

      <ConfirmDialog
        open={!!confirmAction}
        title={
          confirmAction
            ? `${confirmAction.action === "activate" ? "Activate" : "Inactivate"} ${confirmAction.template.name}?`
            : "Confirm change"
        }
        description="This will update availability for all tenants."
        confirmLabel={confirmAction?.action === "activate" ? "Activate Template" : "Inactivate Template"}
        tone={confirmAction?.action === "inactivate" ? "danger" : "default"}
        onConfirm={confirmToggle}
        onClose={() => setConfirmAction(null)}
      />
    </section>
  );
}
