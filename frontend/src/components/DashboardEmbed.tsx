import { ReactNode } from "react";
import { buildGrafanaEmbedUrl, getGrafanaBaseUrl } from "../lib/grafana";

type DashboardEmbedProps = {
  uid?: string | null;
  title?: string;
  description?: ReactNode;
  variables?: Record<string, string | number | null | undefined>;
};

export default function DashboardEmbed({ uid, title, description, variables }: DashboardEmbedProps) {
  const grafanaBase = getGrafanaBaseUrl();
  const url = uid ? buildGrafanaEmbedUrl(uid, variables) : null;

  if (!grafanaBase) {
    return (
      <div className="dashboard-embed-empty">
        <h3>Grafana URL not configured</h3>
        <p className="muted">Set VITE_GRAFANA_URL to enable embedded dashboards.</p>
      </div>
    );
  }

  if (!uid) {
    return (
      <div className="dashboard-embed-empty">
        <h3>Dashboard not linked</h3>
        <p className="muted">This template is missing a Grafana UID.</p>
      </div>
    );
  }

  return (
    <div className="dashboard-embed">
      <div className="dashboard-embed-header">
        <div>
          <h3>{title ?? "Grafana Dashboard"}</h3>
          {description ? <div className="muted">{description}</div> : null}
        </div>
        <a className="ghost" href={`${grafanaBase}/d/${uid}`} target="_blank" rel="noreferrer">
          Open in Grafana
        </a>
      </div>
      <div className="dashboard-frame">
        <iframe
          title={title ?? "Grafana Dashboard"}
          src={url ?? undefined}
          loading="lazy"
          allow="fullscreen"
          allowFullScreen
        />
      </div>
    </div>
  );
}
