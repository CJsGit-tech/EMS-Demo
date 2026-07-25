import { useI18n } from "../i18n/I18nProvider.jsx";

const DIAGNOSTICS_STALE_AFTER_MS = 5 * 60 * 1000;

export function diagnosticsIsStale(data, now = Date.now()) {
  const observedAt = Date.parse(data?.observed_at ?? "");
  return Number.isFinite(observedAt) && now - observedAt > DIAGNOSTICS_STALE_AFTER_MS;
}

export function PageState({ state, error }) {
  const { t } = useI18n();
  if (state === "loading") return <p className="scada-state" role="status">{t("state.loading")}</p>;
  if (state === "empty") return <p className="scada-state" role="status">{t("state.empty")}</p>;
  if (state === "error") return <p className="scada-state scada-state--error" role="alert"><strong>{t("state.error")}</strong>{error ? <span> {error}</span> : null}</p>;
  if (state === "stale") return <p className="scada-state scada-state--warning" role="status">{t("state.stale")}</p>;
  return null;
}

export function SimulatorNote({ calculation = false }) {
  const { t } = useI18n();
  return <span className="scada-data-note">{t(calculation ? "note.simulatedCalculation" : "note.simulatedData")}</span>;
}

export function Trend({ title, points = [] }) {
  const { t } = useI18n();
  const values = points.map((point) => Number(point.value)).filter(Number.isFinite);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const path = values.map((value, index) => {
    const x = 12 + (index / Math.max(values.length - 1, 1)) * 296;
    const y = 92 - ((value - min) / span) * 72;
    return `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  return <figure className="scada-chart"><figcaption className="scada-chart__header"><strong>{title}</strong><SimulatorNote calculation /></figcaption><svg aria-label={t("trend.chartLabel", { title })} className="scada-chart__plot" role="img" viewBox="0 0 320 112"><line className="scada-chart__baseline" x1="12" x2="308" y1="92" y2="92" />{path ? <path className="scada-chart__line" d={path} /> : null}</svg></figure>;
}
