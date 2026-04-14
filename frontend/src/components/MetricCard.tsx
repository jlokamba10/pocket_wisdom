import { ReactNode } from "react";

type MetricCardProps = {
  title: string;
  value: ReactNode;
  helper?: string;
};

export default function MetricCard({ title, value, helper }: MetricCardProps) {
  return (
    <div className="card metric-card">
      <div className="metric-title">{title}</div>
      <div className="metric-value">{value}</div>
      {helper ? <div className="metric-helper">{helper}</div> : null}
    </div>
  );
}
