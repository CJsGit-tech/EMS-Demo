import { useMemo, useState } from "react";

import { PageState, SimulatorNote, Trend } from "../../components/PageState.jsx";
import { useI18n } from "../../i18n/I18nProvider.jsx";

function value(value, suffix = "") { return Number.isFinite(value) ? `${value}${suffix}` : "—"; }

export function InverterEfficiencyPage({ data, state = "loading", error }) {
  const { t } = useI18n();
  const [direction, setDirection] = useState("asc");
  const [selectedId, setSelectedId] = useState(null);
  const inverters = data?.inverters ?? [];
  const sorted = useMemo(() => [...inverters].sort((a, b) => direction === "desc" ? b.efficiency_percent - a.efficiency_percent : a.efficiency_percent - b.efficiency_percent), [direction, inverters]);
  const selected = inverters.find((item) => item.asset_id === selectedId) ?? sorted[0];
  if (!data || ["loading", "error", "empty"].includes(state)) return <PageState state={state} error={error} />;
  return <section className="scada-page" aria-labelledby="inverter-efficiency-title"><header className="scada-page__header"><h2 id="inverter-efficiency-title">{t("page.inverterEfficiency")}</h2><SimulatorNote calculation /></header><section className="scada-panel scada-table-wrap"><table><thead><tr><th>Inverter</th><th><button type="button" className="scada-sort-button" onClick={() => setDirection((value) => value === "desc" ? "asc" : "desc")}>{t("analytics.efficiency")}</button></th><th>{t("analytics.deviation")}</th></tr></thead><tbody>{sorted.map((inverter) => <tr key={inverter.asset_id}><td><button className="scada-link-button" type="button" onClick={() => setSelectedId(inverter.asset_id)}>{inverter.asset_id}</button></td><td>{value(inverter.efficiency_percent, "%")}</td><td>{value(inverter.efficiency_deviation_percent, "%")}</td></tr>)}</tbody></table></section>{selected ? <Trend title={t("trend.inverterPower", { asset: selected.asset_id })} points={(selected.trend ?? [{ value: selected.efficiency_percent }])} /> : null}</section>;
}
