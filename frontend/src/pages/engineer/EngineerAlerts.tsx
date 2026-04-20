import { FormEvent, useEffect, useMemo, useState } from "react";
import Pagination from "../../components/Pagination";
import StatusBadge from "../../components/StatusBadge";
import { apiRequest } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import { buildQuery } from "../../lib/query";
import { useAuth } from "../../state/auth";

type Equipment = { id: number; name: string; status?: string };
type Sensor = { id: number; name: string; equipment_id: number; status?: string };
type User = { id: number; full_name: string };

type AlertEvent = {
  id: number;
  severity: string;
  status: string;
  triggered_at: string;
  cleared_at: string | null;
  clear_comment?: string | null;
  equipment?: Equipment | null;
  sensor?: Sensor | null;
  cleared_by?: User | null;
};

type AlertRule = {
  id: number;
  equipment_id: number;
  sensor_id: number | null;
  severity: string;
  metric_name: string;
  operator: string;
  threshold_value: number;
  time_window_minutes: number | null;
  status: string;
  webhook_url?: string | null;
  email?: string | null;
};

type PaginatedAlerts = {
  items: AlertEvent[];
  total: number;
  limit: number;
  offset: number;
};

type PaginatedRules = {
  items: AlertRule[];
  total: number;
  limit: number;
  offset: number;
};

type PaginatedEquipment = { items: Equipment[] };
type PaginatedSensors = { items: Sensor[] };

const DEFAULT_LIMIT = 12;
const RULE_LIMIT = 8;

export default function EngineerAlerts() {
  const { token } = useAuth();
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [alertTotal, setAlertTotal] = useState(0);
  const [alertOffset, setAlertOffset] = useState(0);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [ruleTotal, setRuleTotal] = useState(0);
  const [ruleOffset, setRuleOffset] = useState(0);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [sensors, setSensors] = useState<Sensor[]>([]);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState("");
  const [sensorFilter, setSensorFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [alertLoading, setAlertLoading] = useState(true);
  const [alertError, setAlertError] = useState<string | null>(null);

  const [ruleQuery, setRuleQuery] = useState("");
  const [ruleStatus, setRuleStatus] = useState("");
  const [ruleSeverity, setRuleSeverity] = useState("");
  const [ruleEquipmentFilter, setRuleEquipmentFilter] = useState("");
  const [ruleEquipmentId, setRuleEquipmentId] = useState("");
  const [ruleSensorId, setRuleSensorId] = useState("");
  const [ruleLoading, setRuleLoading] = useState(true);
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [ruleEditing, setRuleEditing] = useState<AlertRule | null>(null);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleMetric, setRuleMetric] = useState("");
  const [ruleOperator, setRuleOperator] = useState(">");
  const [ruleThreshold, setRuleThreshold] = useState("");
  const [ruleWindow, setRuleWindow] = useState("");
  const [ruleSeverityValue, setRuleSeverityValue] = useState("HIGH");
  const [ruleStatusValue, setRuleStatusValue] = useState("ACTIVE");
  const [ruleWebhook, setRuleWebhook] = useState("");
  const [ruleEmail, setRuleEmail] = useState("");
  const [ruleMessage, setRuleMessage] = useState<string | null>(null);

  const [clearTarget, setClearTarget] = useState<AlertEvent | null>(null);
  const [clearComment, setClearComment] = useState("");
  const [clearMessage, setClearMessage] = useState<string | null>(null);
  const [selectedAlertIds, setSelectedAlertIds] = useState<number[]>([]);
  const [bulkClearComment, setBulkClearComment] = useState("");
  const [alertActionMessage, setAlertActionMessage] = useState<string | null>(null);

  const loadEquipment = async () => {
    if (!token) {
      return;
    }
    try {
      const data = await apiRequest<PaginatedEquipment>("/equipment?limit=100&offset=0", { method: "GET" }, token);
      setEquipment(data.items);
    } catch {
      setEquipment([]);
    }
  };

  const loadSensors = async () => {
    if (!token) {
      return;
    }
    try {
      const data = await apiRequest<PaginatedSensors>("/sensors?limit=100&offset=0", { method: "GET" }, token);
      setSensors(data.items);
    } catch {
      setSensors([]);
    }
  };

  const loadAlerts = async (nextOffset = alertOffset) => {
    if (!token) {
      return;
    }
    setAlertLoading(true);
    setAlertError(null);
    try {
      const params = buildQuery({
        q: query,
        status: statusFilter || undefined,
        severity: severityFilter || undefined,
        equipment_id: equipmentFilter || undefined,
        sensor_id: sensorFilter || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        limit: DEFAULT_LIMIT,
        offset: nextOffset,
      });
      const data = await apiRequest<PaginatedAlerts>(`/alerts${params}`, { method: "GET" }, token);
      setAlerts(data.items);
      setAlertTotal(data.total);
      setAlertOffset(data.offset);
    } catch (err) {
      setAlertError(err instanceof Error ? err.message : "Unable to load alerts.");
    } finally {
      setAlertLoading(false);
    }
  };

  const loadRules = async (nextOffset = ruleOffset) => {
    if (!token) {
      return;
    }
    setRuleLoading(true);
    setRuleError(null);
    try {
      const params = buildQuery({
        q: ruleQuery,
        status: ruleStatus || undefined,
        severity: ruleSeverity || undefined,
        equipment_id: ruleEquipmentFilter || undefined,
        limit: RULE_LIMIT,
        offset: nextOffset,
      });
      const data = await apiRequest<PaginatedRules>(`/alert-rules${params}`, { method: "GET" }, token);
      setRules(data.items);
      setRuleTotal(data.total);
      setRuleOffset(data.offset);
    } catch (err) {
      setRuleError(err instanceof Error ? err.message : "Unable to load alert rules.");
    } finally {
      setRuleLoading(false);
    }
  };

  useEffect(() => {
    loadEquipment();
    loadSensors();
  }, [token]);

  useEffect(() => {
    loadAlerts(0);
  }, [token, query, statusFilter, severityFilter, equipmentFilter, sensorFilter, startDate, endDate]);

  useEffect(() => {
    loadRules(0);
  }, [token, ruleQuery, ruleStatus, ruleSeverity, ruleEquipmentFilter]);

  const resetRuleForm = () => {
    setRuleEditing(null);
    setRuleEquipmentId("");
    setRuleSensorId("");
    setRuleMetric("");
    setRuleOperator(">");
    setRuleThreshold("");
    setRuleWindow("");
    setRuleSeverityValue("HIGH");
    setRuleStatusValue("ACTIVE");
    setRuleWebhook("");
    setRuleEmail("");
    setRuleMessage(null);
  };

  const startRuleEdit = (rule: AlertRule) => {
    setShowRuleForm(true);
    setRuleEditing(rule);
    setRuleEquipmentId(String(rule.equipment_id));
    setRuleSensorId(rule.sensor_id ? String(rule.sensor_id) : "");
    setRuleMetric(rule.metric_name);
    setRuleOperator(rule.operator);
    setRuleThreshold(String(rule.threshold_value));
    setRuleWindow(rule.time_window_minutes ? String(rule.time_window_minutes) : "");
    setRuleSeverityValue(rule.severity);
    setRuleStatusValue(rule.status);
    setRuleWebhook(rule.webhook_url ?? "");
    setRuleEmail(rule.email ?? "");
    setRuleMessage(null);
  };

  const activeEquipment = useMemo(
    () => equipment.filter((item) => item.status === "ACTIVE" || !item.status),
    [equipment]
  );

  const activeSensors = useMemo(
    () => sensors.filter((sensor) => sensor.status === "ACTIVE" || !sensor.status),
    [sensors]
  );

  const availableSensors = useMemo(() => {
    if (!ruleEquipmentId) {
      return activeSensors;
    }
    const eqId = Number(ruleEquipmentId);
    return activeSensors.filter((sensor) => sensor.equipment_id === eqId);
  }, [ruleEquipmentId, activeSensors]);

  const alertSensors = useMemo(() => {
    if (!equipmentFilter) {
      return sensors;
    }
    const eqId = Number(equipmentFilter);
    return sensors.filter((sensor) => sensor.equipment_id === eqId);
  }, [equipmentFilter, sensors]);

  useEffect(() => {
    if (!ruleSensorId) {
      return;
    }
    if (!availableSensors.some((sensor) => String(sensor.id) === ruleSensorId)) {
      setRuleSensorId("");
    }
  }, [availableSensors, ruleSensorId]);

  useEffect(() => {
    if (!sensorFilter) {
      return;
    }
    if (!alertSensors.some((sensor) => String(sensor.id) === sensorFilter)) {
      setSensorFilter("");
    }
  }, [alertSensors, sensorFilter]);

  useEffect(() => {
    setSelectedAlertIds((previous) =>
      previous.filter((id) => alerts.some((alert) => alert.id === id && alert.status !== "CLEARED"))
    );
  }, [alerts]);

  const onRuleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) {
      return;
    }
    setRuleMessage(null);
    const payload = {
      equipment_id: Number(ruleEquipmentId),
      sensor_id: ruleSensorId ? Number(ruleSensorId) : null,
      severity: ruleSeverityValue,
      metric_name: ruleMetric,
      operator: ruleOperator,
      threshold_value: Number(ruleThreshold),
      time_window_minutes: ruleWindow ? Number(ruleWindow) : null,
      status: ruleStatusValue,
      webhook_url: ruleWebhook || null,
      email: ruleEmail || null,
    };
    try {
      if (ruleEditing) {
        await apiRequest(`/alert-rules/${ruleEditing.id}`, { method: "PUT", body: JSON.stringify(payload) }, token);
        setRuleMessage("Alert rule updated.");
      } else {
        await apiRequest(`/alert-rules`, { method: "POST", body: JSON.stringify(payload) }, token);
        setRuleMessage("Alert rule created.");
      }
      resetRuleForm();
      setShowRuleForm(false);
      await loadRules(0);
    } catch (err) {
      setRuleMessage(err instanceof Error ? err.message : "Rule save failed.");
    }
  };

  const startClear = (alert: AlertEvent) => {
    setClearTarget(alert);
    setClearComment("");
    setClearMessage(null);
  };

  const submitClear = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !clearTarget) {
      return;
    }
    if (!window.confirm(`Clear alert ${clearTarget.id}?`)) {
      return;
    }
    try {
      await apiRequest(`/alerts/${clearTarget.id}/clear`, { method: "POST", body: JSON.stringify({ clear_comment: clearComment || null }) }, token);
      setClearMessage("Alert cleared.");
      setClearTarget(null);
      await loadAlerts(alertOffset);
    } catch (err) {
      setClearMessage(err instanceof Error ? err.message : "Failed to clear alert.");
    }
  };

  const selectableAlertIds = alerts.filter((alert) => alert.status !== "CLEARED").map((alert) => alert.id);
  const allSelectableChecked =
    selectableAlertIds.length > 0 && selectableAlertIds.every((id) => selectedAlertIds.includes(id));

  const toggleAlertSelection = (alertId: number) => {
    setSelectedAlertIds((current) =>
      current.includes(alertId) ? current.filter((id) => id !== alertId) : [...current, alertId]
    );
  };

  const toggleSelectAllAlerts = () => {
    setSelectedAlertIds(allSelectableChecked ? [] : selectableAlertIds);
  };

  const acknowledgeAlert = async (alert: AlertEvent) => {
    if (!token) {
      return;
    }
    try {
      await apiRequest(`/alerts/${alert.id}/acknowledge`, { method: "POST" }, token);
      setAlertActionMessage(`Alert #${alert.id} acknowledged.`);
      await loadAlerts(alertOffset);
    } catch (err) {
      setAlertActionMessage(err instanceof Error ? err.message : "Failed to acknowledge alert.");
    }
  };

  const clearSelectedAlerts = async () => {
    if (!token || selectedAlertIds.length === 0) {
      return;
    }
    if (!window.confirm(`Clear ${selectedAlertIds.length} selected alerts?`)) {
      return;
    }
    try {
      const response = await apiRequest<{ message: string }>(
        "/alerts/actions/clear-bulk",
        {
          method: "POST",
          body: JSON.stringify({
            alert_ids: selectedAlertIds,
            clear_comment: bulkClearComment || null,
          }),
        },
        token
      );
      setAlertActionMessage(response.message);
      setSelectedAlertIds([]);
      setBulkClearComment("");
      await loadAlerts(alertOffset);
    } catch (err) {
      setAlertActionMessage(err instanceof Error ? err.message : "Failed to clear selected alerts.");
    }
  };

  return (
    <section className="page">
      <div className="page-header">
        <h2>Alerts & Rules</h2>
        <p>Tune alert thresholds and clear alert events in your scope.</p>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>Alert Rules</h3>
            <p className="muted">Adjust thresholds based on operational insight.</p>
          </div>
          {!showRuleForm ? (
            <button
              className="primary"
              type="button"
              onClick={() => {
                resetRuleForm();
                setShowRuleForm(true);
              }}
              disabled={activeEquipment.length === 0}
            >
              Create Rule
            </button>
          ) : null}
        </div>

        <div className="table-toolbar">
          <input
            type="search"
            placeholder="Search rules"
            value={ruleQuery}
            onChange={(event) => setRuleQuery(event.target.value)}
          />
          <select value={ruleEquipmentFilter} onChange={(event) => setRuleEquipmentFilter(event.target.value)}>
            <option value="">All equipment</option>
            {equipment.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select value={ruleSeverity} onChange={(event) => setRuleSeverity(event.target.value)}>
            <option value="">All severity</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
          <select value={ruleStatus} onChange={(event) => setRuleStatus(event.target.value)}>
            <option value="">All status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        {showRuleForm ? (
          <div className="form-panel">
            <form className="form-rows" onSubmit={onRuleSubmit}>
              <div className="form-row">
                <span className="form-label">Equipment</span>
                <select value={ruleEquipmentId} onChange={(event) => setRuleEquipmentId(event.target.value)} required>
                  <option value="">Select equipment</option>
                  {activeEquipment.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <span className="form-label">Sensor (optional)</span>
                <select value={ruleSensorId} onChange={(event) => setRuleSensorId(event.target.value)}>
                  <option value="">All sensors</option>
                  {availableSensors.map((sensor) => (
                    <option key={sensor.id} value={sensor.id}>
                      {sensor.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <span className="form-label">Metric name</span>
                <input value={ruleMetric} onChange={(event) => setRuleMetric(event.target.value)} required />
              </div>
              <div className="form-row">
                <span className="form-label">Operator</span>
                <select value={ruleOperator} onChange={(event) => setRuleOperator(event.target.value)}>
                  <option value=">">&gt;</option>
                  <option value=">=">&gt;=</option>
                  <option value="<">&lt;</option>
                  <option value="<=">&lt;=</option>
                  <option value="=">=</option>
                </select>
              </div>
              <div className="form-row">
                <span className="form-label">Threshold value</span>
                <input
                  type="number"
                  step="0.01"
                  value={ruleThreshold}
                  onChange={(event) => setRuleThreshold(event.target.value)}
                  required
                />
              </div>
              <div className="form-row">
                <span className="form-label">Time window (minutes)</span>
                <input
                  type="number"
                  value={ruleWindow}
                  onChange={(event) => setRuleWindow(event.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="form-row">
                <span className="form-label">Severity</span>
                <select value={ruleSeverityValue} onChange={(event) => setRuleSeverityValue(event.target.value)}>
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>
              <div className="form-row">
                <span className="form-label">Status</span>
                <select value={ruleStatusValue} onChange={(event) => setRuleStatusValue(event.target.value)}>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
              <div className="form-row">
                <span className="form-label">Webhook URL</span>
                <input value={ruleWebhook} onChange={(event) => setRuleWebhook(event.target.value)} />
              </div>
              <div className="form-row">
                <span className="form-label">Email</span>
                <input value={ruleEmail} onChange={(event) => setRuleEmail(event.target.value)} />
              </div>
              <div className="form-actions">
                <button className="primary" type="submit" disabled={activeEquipment.length === 0}>
                  {ruleEditing ? "Save rule" : "Create rule"}
                </button>
                <button
                  className="ghost"
                  type="button"
                  onClick={() => {
                    resetRuleForm();
                    setShowRuleForm(false);
                  }}
                >
                  Cancel
                </button>
              </div>
              {ruleMessage ? <div className="form-error">{ruleMessage}</div> : null}
              {activeEquipment.length === 0 ? (
                <div className="form-error">Assign equipment before creating alert rules.</div>
              ) : null}
            </form>
          </div>
        ) : null}

        {ruleLoading ? (
          <div className="table-state">Loading alert rules...</div>
        ) : ruleError ? (
          <div className="form-error">{ruleError}</div>
        ) : rules.length === 0 ? (
          <div className="empty-state">No alert rules configured yet.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Equipment</th>
                <th>Metric</th>
                <th>Severity</th>
                <th>Threshold</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td>{equipment.find((item) => item.id === rule.equipment_id)?.name ?? rule.equipment_id}</td>
                  <td>{rule.metric_name}</td>
                  <td>{rule.severity}</td>
                  <td>
                    {rule.operator} {rule.threshold_value}
                  </td>
                  <td>
                    <StatusBadge status={rule.status} />
                  </td>
                  <td>
                    <button className="ghost" type="button" onClick={() => startRuleEdit(rule)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <Pagination total={ruleTotal} limit={RULE_LIMIT} offset={ruleOffset} onPageChange={loadRules} />
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>Alert Events</h3>
            <p className="muted">Review and clear alerts from your equipment.</p>
          </div>
        </div>

        <div className="table-toolbar">
          <input
            type="search"
            placeholder="Search alerts"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select value={equipmentFilter} onChange={(event) => setEquipmentFilter(event.target.value)}>
            <option value="">All equipment</option>
            {equipment.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select value={sensorFilter} onChange={(event) => setSensorFilter(event.target.value)}>
            <option value="">All sensors</option>
            {alertSensors.map((sensor) => (
              <option key={sensor.id} value={sensor.id}>
                {sensor.name}
              </option>
            ))}
          </select>
          <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}>
            <option value="">All severity</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All status</option>
            <option value="OPEN">OPEN</option>
            <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
            <option value="CLEARED">CLEARED</option>
          </select>
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </div>

        {selectedAlertIds.length > 0 ? (
          <div className="bulk-toolbar">
            <span className="bulk-count">{selectedAlertIds.length} selected</span>
            <input
              type="text"
              placeholder="Optional clear comment for selected"
              value={bulkClearComment}
              onChange={(event) => setBulkClearComment(event.target.value)}
            />
            <button className="primary" type="button" onClick={clearSelectedAlerts}>
              Clear Selected
            </button>
            <button className="ghost" type="button" onClick={() => setSelectedAlertIds([])}>
              Reset Selection
            </button>
          </div>
        ) : null}

        {alertActionMessage ? <div className="form-success">{alertActionMessage}</div> : null}

        {clearTarget ? (
          <form className="form-grid" onSubmit={submitClear}>
            <label className="full">
              Clear alert #{clearTarget.id} comment
              <textarea
                value={clearComment}
                onChange={(event) => setClearComment(event.target.value)}
                placeholder="Optional clear comment"
              />
            </label>
            <div className="form-actions">
              <button className="primary" type="submit">
                Confirm Clear
              </button>
              <button className="ghost" type="button" onClick={() => setClearTarget(null)}>
                Cancel
              </button>
            </div>
            {clearMessage ? <div className="form-success">{clearMessage}</div> : null}
          </form>
        ) : null}

        {alertLoading ? (
          <div className="table-state">Loading alerts...</div>
        ) : alertError ? (
          <div className="form-error">
            {alertError}
            <div className="table-actions">
              <button className="ghost" type="button" onClick={() => loadAlerts(alertOffset)}>
                Retry
              </button>
            </div>
          </div>
        ) : alerts.length === 0 ? (
          <div className="empty-state">No alerts found. Adjust filters or date range to broaden results.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    className="table-check"
                    checked={allSelectableChecked}
                    onChange={toggleSelectAllAlerts}
                    aria-label="Select all open alerts"
                  />
                </th>
                <th>Equipment</th>
                <th>Sensor</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Triggered</th>
                <th>Cleared By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr key={alert.id}>
                  <td>
                    {alert.status !== "CLEARED" ? (
                      <input
                        type="checkbox"
                        className="table-check"
                        checked={selectedAlertIds.includes(alert.id)}
                        onChange={() => toggleAlertSelection(alert.id)}
                        aria-label={`Select alert ${alert.id}`}
                      />
                    ) : null}
                  </td>
                  <td>{alert.equipment?.name ?? "-"}</td>
                  <td>{alert.sensor?.name ?? "-"}</td>
                  <td>{alert.severity}</td>
                  <td>
                    <StatusBadge status={alert.status} />
                  </td>
                  <td>{formatDateTime(alert.triggered_at)}</td>
                  <td>{alert.cleared_by?.full_name ?? "-"}</td>
                  <td>
                    <div className="table-actions">
                      {alert.status === "OPEN" ? (
                        <button className="ghost" type="button" onClick={() => acknowledgeAlert(alert)}>
                          Acknowledge
                        </button>
                      ) : null}
                      {alert.status !== "CLEARED" ? (
                        <button className="ghost" type="button" onClick={() => startClear(alert)}>
                          Clear
                        </button>
                      ) : (
                        <span className="muted">Cleared</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <Pagination total={alertTotal} limit={DEFAULT_LIMIT} offset={alertOffset} onPageChange={loadAlerts} />
      </div>
    </section>
  );
}
