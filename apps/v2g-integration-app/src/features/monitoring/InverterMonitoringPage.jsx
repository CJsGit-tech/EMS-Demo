import { useState } from "react";

import { PageState, SimulatorNote, Trend } from "../../components/PageState.jsx";
import { useI18n } from "../../i18n/I18nProvider.jsx";

export function InverterMonitoringPage({ data, state = "loading", error }) {
  const { t } = useI18n();
  const inverters = data?.inverters ?? [];
  const [selectedId, setSelectedId] = useState(inverters[0]?.asset_id);
  if (!data || ["loading", "error", "empty"].includes(state) || !inverters.length) return <PageState state={!inverters.length && state === "ready" ? "empty" : state} error={error} />;
  const selected = inverters.find((inverter) => inverter.asset_id === selectedId) ?? inverters[0];
  const points = (data.trends?.[selected.asset_id]?.points ?? []).map((point) => ({ value: point.value }));
  return <section className="scada-page" aria-labelledby="inverters-title"><header className="scada-page__header"><h2 id="inverters-title">{t("page.inverters")}</h2><SimulatorNote /></header><PageState state={state} error={error} /><section className="scada-workspace-grid"><article className="scada-panel"><p className="scada-eyebrow">{t("panel.inverterSelection")}</p><div className="scada-workspace-tiles">{inverters.map((inverter) => <button className="scada-workspace-tile" type="button" aria-pressed={selected.asset_id === inverter.asset_id} key={inverter.asset_id} onClick={() => setSelectedId(inverter.asset_id)}>{inverter.asset_id}<small>{inverter.communication_state}</small></button>)}</div><SimulatorNote /></article><Trend title={t("trend.inverterPower", { asset: selected.asset_id })} points={points} /></section><section className="scada-workspace-grid scada-workspace-grid--metrics"><article className="scada-panel"><p className="scada-eyebrow">AC</p><strong className="scada-workspace-value">{selected.ac_power_kw} kW</strong><SimulatorNote /></article><article className="scada-panel"><p className="scada-eyebrow">DC</p><strong className="scada-workspace-value">{selected.dc_power_kw} kW</strong><SimulatorNote /></article><article className="scada-panel"><p className="scada-eyebrow">{t("metric.temperature")}</p><strong className="scada-workspace-value">{selected.temperature_c}°C</strong><SimulatorNote /></article><article className="scada-panel"><p className="scada-eyebrow">{t("metric.efficiency")}</p><strong className="scada-workspace-value">{selected.efficiency_percent}%</strong><SimulatorNote calculation /></article></section></section>;
}
