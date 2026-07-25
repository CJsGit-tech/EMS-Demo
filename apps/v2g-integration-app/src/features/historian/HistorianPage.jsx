import { TimeSeriesChart } from "../../components/TimeSeriesChart.jsx";
import { useI18n } from "../../i18n/I18nProvider.jsx";

function State({ state, error, t }) {
  if (state === "loading") return <p className="scada-state" role="status">{t("historian.loading")}</p>;
  if (state === "error") return <p className="scada-state scada-state--error" role="alert">{error ?? t("historian.error")}</p>;
  if (state === "empty") return <p className="scada-state" role="status">{t("historian.empty")}</p>;
  return null;
}

export function historianIsStale(historian) {
  const resourceQuality = historian?.data_freshness?.quality ?? historian?.quality;
  const points = Array.isArray(historian?.points) ? historian.points : [];
  return resourceQuality === "stale" || points.some((point) => point?.quality === "stale");
}

function localizedMetric(t, metric) {
  const key = `historian.metric.${metric}`;
  const translated = t(key);
  return translated === key ? metric : translated;
}

export function HistorianPage({ historian, state = "loading", error, rangeHours, onRangeChange }) {
  const { t } = useI18n();
  const controls = <label className="scada-select">{t("historian.range")} <select value={rangeHours} onChange={(event) => onRangeChange(Number(event.target.value))}><option value={6}>{t("historian.lastHours", { hours: 6 })}</option><option value={24}>{t("historian.lastHours", { hours: 24 })}</option><option value={72}>{t("historian.lastHours", { hours: 72 })}</option></select></label>;
  if (!historian || ["loading", "error", "empty"].includes(state)) return <section className="scada-page" aria-labelledby="historian-title"><header className="scada-page__header"><div><p className="scada-eyebrow">{t("historian.eyebrow")}</p><h2 id="historian-title">{t("page.historian")}</h2></div>{controls}</header><State state={state} error={error} t={t} /></section>;

  const points = Array.isArray(historian.points) ? historian.points : [];
  if (!points.length) return <section className="scada-page" aria-labelledby="historian-title"><header className="scada-page__header"><div><p className="scada-eyebrow">{t("historian.eyebrow")}</p><h2 id="historian-title">{t("page.historian")}</h2></div>{controls}</header><State state="empty" t={t} /></section>;
  const isStale = historianIsStale(historian);
  const quality = isStale ? "stale" : "good";
  return <section className="scada-page" aria-labelledby="historian-title"><header className="scada-page__header"><div><p className="scada-eyebrow">{t("historian.eyebrow")} · {localizedMetric(t, historian.metric)}</p><h2 id="historian-title">{t("page.historian")}</h2></div>{controls}</header>{isStale ? <p className="scada-state scada-state--warning" role="status">{t("historian.stale")}</p> : null}<TimeSeriesChart title={localizedMetric(t, historian.metric)} unit="kW" quality={quality} points={points.map((point) => ({ at: point.occurred_at, value: point.value }))} />{historian.truncated ? <p className="scada-data-note">{t("historian.truncated")}</p> : null}</section>;
}
