import { PageState, SimulatorNote } from "../../components/PageState.jsx";
import { useI18n } from "../../i18n/I18nProvider.jsx";

function percent(value) { return Number.isFinite(value) ? `${value.toFixed(1)}%` : "—"; }

export function SiteEfficiencyPage({ data, state = "loading", error }) {
  const { t } = useI18n();
  if (!data || ["loading", "error", "empty"].includes(state)) return <PageState state={state} error={error} />;
  const actual = data.site_efficiency;
  const expected = data.expected_efficiency;
  const availability = data.availability_percent;
  return <section className="scada-page" aria-labelledby="site-efficiency-title"><header className="scada-page__header"><h2 id="site-efficiency-title">{t("page.siteEfficiency")}</h2><SimulatorNote calculation /></header><section className="scada-workspace-grid scada-workspace-grid--metrics">{[["analytics.actualEfficiency", actual], ["analytics.expectedEfficiency", expected], ["analytics.availability", availability]].map(([label, value]) => <article className="scada-panel" key={label}><p className="scada-eyebrow">{t(label)}</p><strong className="scada-workspace-value">{percent(value)}</strong><SimulatorNote calculation /></article>)}</section><section className="scada-panel"><h3>{t("analytics.periodComparison")}</h3><dl className="scada-key-values"><div><dt>{t("analytics.selectedPeriod")}</dt><dd>{data.from ?? "—"} → {data.to ?? "—"}</dd></div><div><dt>{t("analytics.deviation")}</dt><dd>{Number.isFinite(actual) && Number.isFinite(expected) ? percent(actual - expected) : "—"}</dd></div></dl></section></section>;
}
