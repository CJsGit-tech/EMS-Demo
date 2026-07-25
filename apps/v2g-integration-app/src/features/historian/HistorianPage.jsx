import { TimeSeriesChart } from "../../components/TimeSeriesChart.jsx";

function State({ state, error }) {
  if (state === "loading") return <p className="scada-state" role="status">Loading simulator historian…</p>;
  if (state === "error") return <p className="scada-state scada-state--error" role="alert">{error ?? "Historian data could not be loaded."}</p>;
  if (state === "empty") return <p className="scada-state" role="status">No simulated points match this time range.</p>;
  return null;
}

export function historianIsStale(historian) {
  const resourceQuality = historian?.data_freshness?.quality ?? historian?.quality;
  const points = Array.isArray(historian?.points) ? historian.points : [];
  return resourceQuality === "stale" || points.some((point) => point?.quality === "stale");
}

export function HistorianPage({ historian, state = "loading", error, rangeHours, onRangeChange }) {
  const controls = <label className="scada-select">Range <select value={rangeHours} onChange={(event) => onRangeChange(Number(event.target.value))}><option value={6}>Last 6 hours</option><option value={24}>Last 24 hours</option><option value={72}>Last 72 hours</option></select></label>;
  if (!historian || ["loading", "error", "empty"].includes(state)) return <section className="scada-page" aria-labelledby="historian-title"><header className="scada-page__header"><div><p className="scada-eyebrow">Simulator telemetry</p><h2 id="historian-title">Historian</h2></div>{controls}</header><State state={state} error={error} /></section>;

  const points = Array.isArray(historian.points) ? historian.points : [];
  if (!points.length) return <section className="scada-page" aria-labelledby="historian-title"><header className="scada-page__header"><div><p className="scada-eyebrow">Simulator telemetry</p><h2 id="historian-title">Historian</h2></div>{controls}</header><State state="empty" /></section>;
  const isStale = historianIsStale(historian);
  const quality = isStale ? "stale" : "good";
  return <section className="scada-page" aria-labelledby="historian-title"><header className="scada-page__header"><div><p className="scada-eyebrow">Simulator telemetry · {historian.metric}</p><h2 id="historian-title">Historian</h2></div>{controls}</header>{isStale ? <p className="scada-state scada-state--warning" role="status">Historian data may be stale. Review its own point quality before using this simulated trend.</p> : null}<TimeSeriesChart title="Site power" unit="kW" quality={quality} points={points.map((point) => ({ at: point.occurred_at, value: point.value }))} />{historian.truncated ? <p className="scada-data-note">Result limited to the simulator historian response window.</p> : null}</section>;
}
