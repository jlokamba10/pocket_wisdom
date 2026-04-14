const DEFAULT_GRAFANA_URL = "http://localhost:3000";

export function getGrafanaBaseUrl(): string | null {
  const value = import.meta.env.VITE_GRAFANA_URL || DEFAULT_GRAFANA_URL;
  if (!value) {
    return null;
  }
  return value.replace(/\/+$/, "");
}

export function buildGrafanaEmbedUrl(
  uid: string,
  variables?: Record<string, string | number | null | undefined>
): string {
  const base = getGrafanaBaseUrl();
  if (!base) {
    return "";
  }
  const params = new URLSearchParams({
    orgId: "1",
    theme: "light",
    from: "now-24h",
    to: "now",
    refresh: "30s",
    kiosk: "tv",
  });
  if (variables) {
    Object.entries(variables).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") {
        params.set(`var-${key}`, String(value));
      }
    });
  }
  return `${base}/d/${uid}?${params.toString()}`;
}
