import { diagnosticsIsStale, PageState, SimulatorNote } from "../../components/PageState.jsx";
import { useI18n } from "../../i18n/I18nProvider.jsx";

export function DiagnosticsPage({ data, state = "loading", error }) {
  const { t } = useI18n();
  const assets = data?.assets ?? [];
  if (!data || ["loading", "error", "empty"].includes(state)) return <PageState state={state} error={error} />;
  const stale = state === "stale" || diagnosticsIsStale(data);
  return <section className="scada-page" aria-labelledby="diagnostics-title"><header className="scada-page__header"><h2 id="diagnostics-title">{t("page.diagnostics")}</h2><SimulatorNote /></header>{stale ? <PageState state="stale" /> : null}<section className="scada-workspace-grid scada-workspace-grid--metrics"><article className="scada-panel"><p className="scada-eyebrow">{t("metric.openAlarms")}</p><strong className="scada-workspace-value">{data.open_alarm_count ?? 0}</strong><SimulatorNote /></article><article className="scada-panel"><p className="scada-eyebrow">{t("panel.freshness")}</p><strong>{data.observed_at ?? "—"}</strong><SimulatorNote /></article></section><article className="scada-panel"><p className="scada-eyebrow">{t("panel.communication")}</p><div className="scada-table-wrap"><table><thead><tr><th>{t("event.asset")}</th><th>{t("diagnostics.communication")}</th><th>{t("diagnostics.telemetryGap")}</th><th>{t("metric.openAlarms")}</th></tr></thead><tbody>{assets.map((asset) => <tr key={asset.asset_id}><td>{asset.asset_id}</td><td>{asset.communication_state}</td><td>{asset.telemetry_gap_minutes} {t("unit.minutes")}</td><td>{asset.open_alarm_count}</td></tr>)}</tbody></table></div><SimulatorNote /></article></section>;
}
