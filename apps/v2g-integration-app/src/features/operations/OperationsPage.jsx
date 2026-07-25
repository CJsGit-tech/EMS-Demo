import { MetricStrip } from "../../components/MetricStrip.jsx";

function formatObservedAt(observedAt) {
  if (!observedAt) return "timestamp unavailable";
  const value = new Date(observedAt);
  return Number.isNaN(value.valueOf()) ? "timestamp unavailable" : value.toLocaleString();
}

function PageState({ state, message }) {
  if (state === "loading") return <p className="scada-state" role="status">Loading simulated site telemetry…</p>;
  if (state === "error") return <p className="scada-state scada-state--error" role="alert">{message ?? "Simulator data could not be loaded."}</p>;
  if (state === "empty") return <p className="scada-state" role="status">No simulator telemetry is available for this site.</p>;
  return null;
}

export function OperationsPage({ overview, state = "loading", error }) {
  if (!overview || ["loading", "error", "empty"].includes(state)) {
    return <PageState state={state} message={error} />;
  }

  const freshness = overview.data_freshness ?? {};
  const isStale = state === "stale" || freshness.quality === "stale";

  return (
    <section className="scada-page" aria-labelledby="operations-title">
      <header className="scada-page__header">
        <div>
          <p className="scada-eyebrow">Site overview · {overview.site_id}</p>
          <h2 id="operations-title">Operations</h2>
        </div>
        <p className="scada-simulator-status"><span aria-hidden="true">●</span> Simulator connected · demo data only</p>
      </header>
      {isStale ? <p className="scada-state scada-state--warning" role="status">Data may be stale. Review its timestamp before making a simulator decision.</p> : null}
      <MetricStrip
        metrics={[
          {
            label: "Site power",
            value: `${overview.site_power_kw} kW`,
            detail: `Observed ${formatObservedAt(freshness.observed_at)}`,
            quality: freshness.quality,
            status: isStale ? "warning" : "normal",
          },
          {
            label: "Flexible capacity",
            value: `${overview.available_flexible_kw} kW`,
            detail: "Simulator dispatch headroom",
            quality: freshness.quality,
            status: isStale ? "warning" : "normal",
          },
        ]}
      />
    </section>
  );
}
