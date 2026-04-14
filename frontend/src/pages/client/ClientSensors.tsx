import { FormEvent, useEffect, useState } from "react";
import Pagination from "../../components/Pagination";
import StatusBadge from "../../components/StatusBadge";
import { apiRequest } from "../../lib/api";
import { buildQuery } from "../../lib/query";
import { useAuth } from "../../state/auth";

type Equipment = {
  id: number;
  name: string;
  status?: string;
};

type Sensor = {
  id: number;
  name: string;
  sensor_type: string;
  unit: string;
  status: string;
  equipment_id: number;
  external_sensor_id: string | null;
  equipment?: Equipment | null;
};

type PaginatedSensors = {
  items: Sensor[];
  total: number;
  limit: number;
  offset: number;
};

type PaginatedEquipment = {
  items: Equipment[];
};

const DEFAULT_LIMIT = 10;

export default function ClientSensors() {
  const { token } = useAuth();
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Sensor | null>(null);
  const [name, setName] = useState("");
  const [sensorType, setSensorType] = useState("");
  const [unit, setUnit] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [externalId, setExternalId] = useState("");
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const loadSensors = async (nextOffset = offset) => {
    if (!token) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = buildQuery({
        q: query,
        equipment_id: equipmentFilter || undefined,
        status: statusFilter || undefined,
        limit: DEFAULT_LIMIT,
        offset: nextOffset,
      });
      const data = await apiRequest<PaginatedSensors>(`/client/sensors${params}`, { method: "GET" }, token);
      setSensors(data.items);
      setTotal(data.total);
      setOffset(data.offset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load sensors.");
    } finally {
      setLoading(false);
    }
  };

  const loadEquipment = async () => {
    if (!token) {
      return;
    }
    try {
      const data = await apiRequest<PaginatedEquipment>("/client/equipment?limit=100&offset=0&status=ACTIVE", { method: "GET" }, token);
      setEquipment(data.items.filter((item) => item.status === "ACTIVE" || !item.status));
    } catch {
      setEquipment([]);
    }
  };

  useEffect(() => {
    loadSensors(0);
  }, [token, query, equipmentFilter, statusFilter]);

  useEffect(() => {
    loadEquipment();
  }, [token]);

  const resetForm = () => {
    setEditing(null);
    setName("");
    setSensorType("");
    setUnit("");
    setEquipmentId("");
    setExternalId("");
    setFormMessage(null);
  };

  const startEdit = (sensor: Sensor) => {
    setEditing(sensor);
    setName(sensor.name);
    setSensorType(sensor.sensor_type);
    setUnit(sensor.unit);
    setEquipmentId(String(sensor.equipment_id));
    setExternalId(sensor.external_sensor_id ?? "");
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
      sensor_type: sensorType,
      unit,
      equipment_id: Number(equipmentId),
      external_sensor_id: externalId || null,
    };
    try {
      if (editing) {
        await apiRequest(`/client/sensors/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) }, token);
        setFormMessage("Sensor updated.");
      } else {
        await apiRequest(`/client/sensors`, { method: "POST", body: JSON.stringify(payload) }, token);
        setFormMessage("Sensor created.");
      }
      setShowForm(false);
      resetForm();
      await loadSensors(0);
    } catch (err) {
      setFormMessage(err instanceof Error ? err.message : "Save failed.");
    }
  };

  const toggleStatus = async (sensor: Sensor) => {
    if (!token) {
      return;
    }
    const action = sensor.status === "ACTIVE" ? "inactivate" : "activate";
    if (!window.confirm(`Are you sure you want to ${action} ${sensor.name}?`)) {
      return;
    }
    await apiRequest(`/client/sensors/${sensor.id}/${action}`, { method: "POST" }, token);
    await loadSensors(offset);
  };

  return (
    <section className="page">
      <div className="page-header">
        <h2>Sensors</h2>
        <p>Manage sensor inventory and equipment mapping.</p>
      </div>

      <div className="panel">
        <div className="table-toolbar">
          <input
            type="search"
            placeholder="Search sensors"
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
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <button className="primary" type="button" onClick={() => { resetForm(); setShowForm(true); }}>
            New Sensor
          </button>
        </div>

        {showForm ? (
          <form className="form-grid" onSubmit={onSubmit}>
            <label>
              Sensor name
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label>
              Sensor type
              <input value={sensorType} onChange={(event) => setSensorType(event.target.value)} required />
            </label>
            <label>
              Unit
              <input value={unit} onChange={(event) => setUnit(event.target.value)} required />
            </label>
            <label>
              Equipment
              <select value={equipmentId} onChange={(event) => setEquipmentId(event.target.value)} required>
                <option value="">Select equipment</option>
                {equipment.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              External sensor ID
              <input value={externalId} onChange={(event) => setExternalId(event.target.value)} />
            </label>
            <div className="form-actions">
              <button className="primary" type="submit">
                {editing ? "Save changes" : "Create sensor"}
              </button>
              <button className="ghost" type="button" onClick={() => setShowForm(false)}>
                Close
              </button>
            </div>
            {formMessage ? <div className="form-error">{formMessage}</div> : null}
          </form>
        ) : null}

        {loading ? (
          <div className="table-state">Loading sensors...</div>
        ) : error ? (
          <div className="form-error">{error}</div>
        ) : sensors.length === 0 ? (
          <div className="empty-state">No sensors added yet.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Equipment</th>
                <th>External ID</th>
                <th>Status</th>
                <th>Unit</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sensors.map((sensor) => (
                <tr key={sensor.id}>
                  <td>{sensor.name}</td>
                  <td>{sensor.sensor_type}</td>
                  <td>{sensor.equipment?.name ?? "-"}</td>
                  <td>{sensor.external_sensor_id ?? "-"}</td>
                  <td>
                    <StatusBadge status={sensor.status} />
                  </td>
                  <td>{sensor.unit}</td>
                  <td>
                    <div className="table-actions">
                      <button className="ghost" type="button" onClick={() => startEdit(sensor)}>
                        Edit
                      </button>
                      <button className="ghost" type="button" onClick={() => toggleStatus(sensor)}>
                        {sensor.status === "ACTIVE" ? "Inactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <Pagination total={total} limit={DEFAULT_LIMIT} offset={offset} onPageChange={loadSensors} />
      </div>
    </section>
  );
}
