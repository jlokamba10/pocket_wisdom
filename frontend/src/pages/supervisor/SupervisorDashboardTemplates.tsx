import { FormEvent, useEffect, useMemo, useState } from "react";
import ConfirmDialog from "../../components/ConfirmDialog";
import DashboardEmbed from "../../components/DashboardEmbed";
import Pagination from "../../components/Pagination";
import TableToolbar from "../../components/TableToolbar";
import { apiRequest } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import { buildQuery } from "../../lib/query";
import { useAuth } from "../../state/auth";

type DashboardTemplate = {
  id: number;
  name: string;
  code: string;
  description: string | null;
  grafana_uid: string | null;
  equipment_type: string | null;
};

type Equipment = {
  id: number;
  name: string;
  equipment_type: string;
  site_id?: number | null;
  status?: string;
  site?: { id: number; name: string } | null;
};

type User = { id: number; full_name: string } | null;

type Assignment = {
  id: number;
  tenant_id: number;
  created_at: string;
  template: DashboardTemplate;
  equipment: Equipment | null;
  supervisor: User;
  created_by: User;
};

type PaginatedAssignments = {
  items: Assignment[];
  total: number;
  limit: number;
  offset: number;
};

type PaginatedTemplates = {
  items: DashboardTemplate[];
};

type PaginatedEquipment = { items: Equipment[] };

const DEFAULT_LIMIT = 10;

export default function SupervisorDashboardTemplates() {
  const { token, user } = useAuth();
  const [templates, setTemplates] = useState<DashboardTemplate[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formTemplateId, setFormTemplateId] = useState("");
  const [formScope, setFormScope] = useState("FLEET");
  const [formEquipmentId, setFormEquipmentId] = useState("");
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [templateFilter, setTemplateFilter] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState("");
  const [scopeFilter, setScopeFilter] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Assignment | null>(null);

  const loadAssignments = async (nextOffset = offset) => {
    if (!token) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = buildQuery({
        q: query,
        equipment_type: equipmentFilter || undefined,
        scope: scopeFilter || undefined,
        limit: DEFAULT_LIMIT,
        offset: nextOffset,
      });
      const data = await apiRequest<PaginatedAssignments>(`/dashboard-assignments${params}`, { method: "GET" }, token);
      setAssignments(data.items);
      setTotal(data.total);
      setOffset(data.offset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load dashboard assignments.");
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    if (!token) {
      return;
    }
    try {
      const params = buildQuery({ active: true, limit: 100, offset: 0 });
      const data = await apiRequest<PaginatedTemplates>(`/dashboard-templates${params}`, { method: "GET" }, token);
      setTemplates(data.items);
    } catch {
      setTemplates([]);
    }
  };

  const loadEquipment = async () => {
    if (!token) {
      return;
    }
    try {
      const data = await apiRequest<PaginatedEquipment>("/equipment?limit=100&offset=0&status=ACTIVE", { method: "GET" }, token);
      setEquipment(data.items.filter((item) => item.status === "ACTIVE" || !item.status));
    } catch {
      setEquipment([]);
    }
  };

  useEffect(() => {
    loadAssignments(0);
  }, [token, query, equipmentFilter, scopeFilter]);

  useEffect(() => {
    loadTemplates();
  }, [token]);

  useEffect(() => {
    loadEquipment();
  }, [token]);

  useEffect(() => {
    if (assignments.length > 0 && !assignments.find((assignment) => assignment.id === selectedId)) {
      setSelectedId(assignments[0].id);
    }
    if (assignments.length === 0) {
      setSelectedId(null);
    }
  }, [assignments, selectedId]);

  const templateOptions = useMemo(() => {
    const types = templates.map((template) => template.equipment_type).filter((value): value is string => !!value);
    return Array.from(new Set(types)).sort();
  }, [templates]);

  const filteredTemplates = templateFilter
    ? templates.filter((template) => template.equipment_type === templateFilter)
    : templates;

  const selectedTemplate = templates.find((template) => template.id === Number(formTemplateId)) ?? null;
  const availableEquipment = selectedTemplate?.equipment_type
    ? equipment.filter((item) => item.equipment_type === selectedTemplate.equipment_type)
    : equipment;

  const selectedAssignment = assignments.find((assignment) => assignment.id === selectedId) ?? null;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) {
      return;
    }
    setFormMessage(null);
    if (!formTemplateId) {
      setFormMessage("Select a dashboard template.");
      return;
    }
    if (formScope === "EQUIPMENT" && !formEquipmentId) {
      setFormMessage("Select equipment for an equipment-scoped assignment.");
      return;
    }
    const payload = {
      dashboard_template_id: Number(formTemplateId),
      equipment_id: formScope === "EQUIPMENT" ? Number(formEquipmentId) : null,
    };
    try {
      await apiRequest(`/dashboard-assignments`, { method: "POST", body: JSON.stringify(payload) }, token);
      setFormMessage("Dashboard assignment created.");
      setFormTemplateId("");
      setFormScope("FLEET");
      setFormEquipmentId("");
      await loadAssignments(0);
    } catch (err) {
      setFormMessage(err instanceof Error ? err.message : "Assignment failed.");
    }
  };

  const removeAssignment = async () => {
    if (!token || !confirmDelete) {
      return;
    }
    try {
      await apiRequest(`/dashboard-assignments/${confirmDelete.id}`, { method: "DELETE" }, token);
      setConfirmDelete(null);
      await loadAssignments(0);
    } catch (err) {
      setConfirmDelete(null);
      setError(err instanceof Error ? err.message : "Unable to remove assignment.");
    }
  };

  return (
    <section className="page">
      <div className="page-header">
        <h2>Dashboard Templates</h2>
        <p>Assign dashboard templates to your fleet or specific equipment.</p>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>New Assignment</h3>
          <p className="muted">Choose a template and scope for your team.</p>
        </div>
        <form className="form-grid" onSubmit={onSubmit}>
          <label>
            Template
            <select value={formTemplateId} onChange={(event) => setFormTemplateId(event.target.value)} required>
              <option value="">Select template</option>
              {filteredTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Scope
            <select value={formScope} onChange={(event) => setFormScope(event.target.value)}>
              <option value="FLEET">Fleet</option>
              <option value="EQUIPMENT">Equipment</option>
            </select>
          </label>
          <label>
            Equipment
            <select
              value={formEquipmentId}
              onChange={(event) => setFormEquipmentId(event.target.value)}
              disabled={formScope !== "EQUIPMENT"}
            >
              <option value="">Select equipment</option>
              {availableEquipment.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Filter templates by type
            <select value={templateFilter} onChange={(event) => setTemplateFilter(event.target.value)}>
              <option value="">All equipment types</option>
              {templateOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <div className="form-actions">
            <button className="primary" type="submit" disabled={templates.length === 0}>
              Assign template
            </button>
          </div>
          {selectedTemplate ? (
            <div className="form-panel full">
              <div className="form-rows">
                <div className="form-row">
                  <div className="form-label">Template</div>
                  <div>{selectedTemplate.name}</div>
                </div>
                <div className="form-row">
                  <div className="form-label">Equipment type</div>
                  <div>{selectedTemplate.equipment_type ?? "All"}</div>
                </div>
                <div className="form-row">
                  <div className="form-label">Grafana UID</div>
                  <div>{selectedTemplate.grafana_uid ?? "Not linked"}</div>
                </div>
              </div>
            </div>
          ) : null}
          {formMessage ? <div className="form-error full">{formMessage}</div> : null}
        </form>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>Assignment Browser</h3>
          <p className="muted">Review and launch dashboards assigned to your scope.</p>
        </div>
        <TableToolbar>
          <input
            type="search"
            placeholder="Search assignments"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <input
            type="text"
            placeholder="Equipment type"
            value={equipmentFilter}
            onChange={(event) => setEquipmentFilter(event.target.value.toUpperCase())}
          />
          <select value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value)}>
            <option value="">All scopes</option>
            <option value="FLEET">Fleet</option>
            <option value="EQUIPMENT">Equipment</option>
          </select>
        </TableToolbar>

        {loading ? (
          <div className="table-state">Loading dashboard assignments...</div>
        ) : error ? (
          <div className="form-error">{error}</div>
        ) : assignments.length === 0 ? (
          <div className="empty-state">No dashboards assigned yet.</div>
        ) : (
          <div className="dashboard-layout">
            <div className="dashboard-list">
              {assignments.map((assignment) => {
                const canRemove = assignment.supervisor?.id === user?.id;
                return (
                  <div
                    key={assignment.id}
                    className={`dashboard-card${selectedId === assignment.id ? " active" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(assignment.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedId(assignment.id);
                      }
                    }}
                  >
                    <div className="dashboard-card-header">
                      <div className="dashboard-card-title">{assignment.template.name}</div>
                      {assignment.template.equipment_type ? <span className="chip">{assignment.template.equipment_type}</span> : null}
                    </div>
                    <div className="dashboard-card-meta">Scope: {assignment.equipment?.name ?? "Fleet"}</div>
                    <div className="dashboard-card-meta">Assigned {formatDateTime(assignment.created_at)}</div>
                    <div className="dashboard-card-meta">Assigned by {assignment.created_by?.full_name ?? "-"}</div>
                    <div className="table-actions">
                      {canRemove ? (
                        <button
                          className="ghost"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setConfirmDelete(assignment);
                          }}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            <div>
              {selectedAssignment ? (
                <DashboardEmbed
                  uid={selectedAssignment.template.grafana_uid}
                  title={selectedAssignment.template.name}
                  description={`Scope: ${selectedAssignment.equipment?.name ?? "Fleet"}`}
                  variables={{
                    tenant_id: selectedAssignment.tenant_id,
                    site_id: selectedAssignment.equipment?.site_id,
                    equipment_id: selectedAssignment.equipment?.id,
                  }}
                />
              ) : (
                <div className="empty-state">Select a dashboard to preview.</div>
              )}
            </div>
          </div>
        )}

        <Pagination total={total} limit={DEFAULT_LIMIT} offset={offset} onPageChange={loadAssignments} />
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        title={confirmDelete ? `Remove ${confirmDelete.template.name}?` : "Remove assignment"}
        description="This will unassign the dashboard from your scope."
        confirmLabel="Remove Assignment"
        tone="danger"
        onConfirm={removeAssignment}
        onClose={() => setConfirmDelete(null)}
      />
    </section>
  );
}
