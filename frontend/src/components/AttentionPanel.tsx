import { Link } from "react-router-dom";

type AttentionTone = "danger" | "warning" | "info" | "neutral";

type AttentionItem = {
  label: string;
  value: string | number;
  hint?: string;
  to?: string;
  tone?: AttentionTone;
};

type AttentionPanelProps = {
  title: string;
  subtitle?: string;
  items: AttentionItem[];
};

export default function AttentionPanel({ title, subtitle, items }: AttentionPanelProps) {
  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p className="muted">{subtitle}</p> : null}
        </div>
      </div>
      <div className="attention-list">
        {items.map((item) => {
          const row = (
            <>
              <div className="attention-copy">
                <span className="attention-label">{item.label}</span>
                {item.hint ? <span className="attention-hint">{item.hint}</span> : null}
              </div>
              <div className={`attention-value ${item.tone ?? "neutral"}`}>{item.value}</div>
            </>
          );

          if (item.to) {
            return (
              <Link key={`${item.label}-${item.value}`} to={item.to} className="attention-row attention-link">
                {row}
              </Link>
            );
          }
          return (
            <div key={`${item.label}-${item.value}`} className="attention-row">
              {row}
            </div>
          );
        })}
      </div>
    </div>
  );
}
