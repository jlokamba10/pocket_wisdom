const grafanaUrl = import.meta.env.VITE_GRAFANA_URL || "http://localhost:3000";

export default function App() {
  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="badge">PocketWisdom</p>
          <h1>Industrial insight, real-time confidence.</h1>
          <p className="subtitle">
            Multi-tenant condition monitoring for industrial assets with live
            telemetry, rollups, alerts, and data lake lineage.
          </p>
          <div className="hero-actions">
            <button className="primary">Onboard Client</button>
            <button className="secondary">Configure Alerts</button>
          </div>
        </div>
        <div className="hero-panel">
          <div className="panel-header">Live Fleet Snapshot</div>
          <div className="panel-grid">
            <div>
              <span className="metric-label">Active Clients</span>
              <span className="metric">42</span>
            </div>
            <div>
              <span className="metric-label">Sensors Online</span>
              <span className="metric">18,392</span>
            </div>
            <div>
              <span className="metric-label">Alerts (24h)</span>
              <span className="metric">128</span>
            </div>
            <div>
              <span className="metric-label">Data Lake</span>
              <span className="metric">14.6 TB</span>
            </div>
          </div>
        </div>
      </header>

      <section className="section">
        <h2>Operate with clarity</h2>
        <div className="cards">
          <article>
            <h3>Client Onboarding</h3>
            <p>
              Create tenants, register machines, and assign MQTT credentials.
              Everything is isolated by tenant and tracked end-to-end.
            </p>
            <button>Open Onboarding</button>
          </article>
          <article>
            <h3>Alert Studio</h3>
            <p>
              Build threshold or time-window rules per tenant. Alerts can route
              to webhooks or email for faster response.
            </p>
            <button>Open Alerts</button>
          </article>
          <article>
            <h3>Analytics Rollups</h3>
            <p>
              Validate rollups across 1m, 5m, 1h, and 1d intervals with
              per-sensor aggregates and lineage metadata.
            </p>
            <button>Review Rollups</button>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="dashboard">
          <div>
            <h2>Grafana Operations</h2>
            <p>
              Embedded dashboards provide fleet-wide health, alerts, and
              time-series exploration across tenants.
            </p>
          </div>
          <iframe
            title="Grafana"
            src={grafanaUrl}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </div>
      </section>
    </div>
  );
}
