const statusClassMap: Record<string, string> = {
  active: "active",
  inactive: "inactive",
  open: "open",
  acknowledged: "acknowledged",
  cleared: "cleared",
};

export default function StatusBadge({ status }: { status?: string | null }) {
  const label = status ? status.replace(/_/g, " ") : "Unknown";
  const key = status ? status.toLowerCase() : "unknown";
  const tone = statusClassMap[key] ?? "neutral";
  return <span className={`badge ${tone}`}>{label}</span>;
}
