import "../styles.css";

const statusLabels = {
  normal: "normal",
  warning: "warning",
  critical: "critical",
};

export function MetricStrip({ metrics = [] }) {
  return (
    <section className="scada-metric-strip" aria-label="Simulated SCADA metrics">
      {metrics.map(({ label, value, detail, quality, status = "normal" }) => (
        <article className="scada-metric" key={label} data-status={status}>
          <p className="scada-eyebrow">{label}</p>
          <p className="scada-metric__value">{value}</p>
          {detail ? <p className="scada-metric__detail">{detail}</p> : null}
          {quality ? <p className="scada-quality">Data freshness: {quality}</p> : null}
          <p className="scada-status" data-status={status}>
            Status: {statusLabels[status] ?? "normal"}
          </p>
        </article>
      ))}
    </section>
  );
}
