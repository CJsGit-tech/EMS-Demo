import { PageState, SimulatorNote, Trend } from "../../components/PageState.jsx";
import { useI18n } from "../../i18n/I18nProvider.jsx";

export function LiveMonitoringPage({ data, state = "loading", error }) {
  const { t } = useI18n();
  const overview = data?.overview;
  if (!data || !overview || ["loading", "error", "empty"].includes(state)) return <PageState state={state} error={error} />;
  const sessions = data.fleet?.sessions ?? [];
  const activeSessions = sessions.filter((session) => String(session.state).toLowerCase() !== "ended");
  const points = (data.historian?.points ?? []).map((point) => ({ value: point.value }));
  return <section className="scada-page" aria-labelledby="live-monitoring-title"><header className="scada-page__header"><h2 id="live-monitoring-title">{t("page.liveMonitoring")}</h2><SimulatorNote /></header><PageState state={state} error={error} /><section className="scada-workspace-grid"><Trend title={t("trend.liveSitePower")} points={points} /><article className="scada-panel"><p className="scada-eyebrow">{t("metric.flexibleCapacity")}</p><strong className="scada-workspace-value">{overview.available_flexible_kw} kW</strong><p className="scada-muted">{overview.data_freshness?.quality ?? "—"}</p><SimulatorNote calculation /></article></section><section className="scada-workspace-grid"><article className="scada-panel"><p className="scada-eyebrow">{t("panel.sessionDistribution")}</p><strong>{activeSessions.length} {t("session.active")}</strong><SimulatorNote calculation /></article><article className="scada-panel"><p className="scada-eyebrow">{t("panel.freshness")}</p><strong>{overview.data_freshness?.quality ?? "—"}</strong><SimulatorNote /></article></section></section>;
}
