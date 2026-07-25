import { PageState, SimulatorNote, Trend } from "../../components/PageState.jsx";
import { useI18n } from "../../i18n/I18nProvider.jsx";

function Items({ values = [] }) { return values.length ? <ul className="scada-analytics-list">{values.map(([label, count]) => <li key={label}>{label} · {count}</li>)}</ul> : <p>—</p>; }

export function EventAnalysisPage({ data, state = "loading", error }) {
  const { t } = useI18n();
  const events = data?.events;
  if (!data || ["loading", "error", "empty"].includes(state)) return <PageState state={state} error={error} />;
  return <section className="scada-page" aria-labelledby="event-analysis-title"><header className="scada-page__header"><h2 id="event-analysis-title">{t("page.eventAnalysis")}</h2><SimulatorNote calculation /></header><section className="scada-workspace-grid"><article className="scada-panel"><h3>{t("analytics.severityDistribution")}</h3><Items values={events?.by_severity} /></article><article className="scada-panel"><h3>{t("analytics.sourceDistribution")}</h3><Items values={events?.by_source} /></article><article className="scada-panel"><h3>{t("analytics.recurringCodes")}</h3><Items values={events?.recurring_codes} /></article><article className="scada-panel"><h3>{t("analytics.averageDuration")}</h3><p className="scada-workspace-value">{Number.isFinite(events?.average_duration_minutes) ? `${events.average_duration_minutes} ${t("unit.minutes")}` : "—"}</p></article></section><Trend title={t("analytics.eventTrend")} points={events?.trend ?? []} /></section>;
}
