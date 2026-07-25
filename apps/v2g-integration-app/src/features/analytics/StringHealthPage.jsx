import { PageState, SimulatorNote } from "../../components/PageState.jsx";
import { useI18n } from "../../i18n/I18nProvider.jsx";

const OUTLIER_THRESHOLD = 8;
function display(value, suffix = "") { return Number.isFinite(value) ? `${value}${suffix}` : "—"; }
function finitePower(value) { return Number.isFinite(value) ? value : null; }

export function StringHealthPage({ data, state = "loading", error }) {
  const { t } = useI18n();
  const strings = data?.strings ?? [];
  const powerValues = strings.map((string) => finitePower(string.dc_power_kw)).filter((value) => value !== null);
  const averagePower = powerValues.length ? powerValues.reduce((total, value) => total + value, 0) / powerValues.length : null;
  if (!data || ["loading", "error", "empty"].includes(state)) return <PageState state={state} error={error} />;
  return <section className="scada-page" aria-labelledby="string-health-title"><header className="scada-page__header"><div><h2 id="string-health-title">{t("page.stringHealth")}</h2><p className="scada-data-note">{t("analytics.outlierThreshold")}</p></div><SimulatorNote calculation /></header><ul className="scada-string-grid" aria-label={t("page.stringHealth")}>{strings.map((string) => {
    const power = finitePower(string.dc_power_kw);
    const variance = power === null ? null : Number.isFinite(string.health_variance_percent) ? string.health_variance_percent : Number.isFinite(averagePower) && averagePower > 0 ? ((power - averagePower) / averagePower) * 100 : null;
    const outlier = Number.isFinite(variance) && Math.abs(variance) > OUTLIER_THRESHOLD;
    return <li key={`${string.inverter_id}-${string.string_id}`}><article className="scada-string-card"><h3>{string.inverter_id} · {string.string_id}</h3><dl><div><dt>kW</dt><dd>{display(string.dc_power_kw, " kW")}</dd></div><div><dt>{t("analytics.current")}</dt><dd>{display(string.current_a, " A")}</dd></div><div><dt>{t("analytics.voltage")}</dt><dd>{display(string.voltage_v, " V")}</dd></div><div><dt>{t("analytics.healthVariance")}</dt><dd>{display(variance, "%")}</dd></div></dl><strong className={outlier ? "scada-outlier" : "scada-ok-count"}>{t(outlier ? "analytics.highVariance" : "analytics.normalVariance")}</strong></article></li>;
  })}</ul></section>;
}
