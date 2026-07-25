import { useState } from "react";

import { PageState, SimulatorNote } from "../../components/PageState.jsx";
import { useI18n } from "../../i18n/I18nProvider.jsx";

export function FleetOverviewPage({ data, state = "loading", error }) {
  const { t } = useI18n();
  const evses = data?.evses ?? [];
  const sessions = data?.sessions ?? [];
  const [selectedId, setSelectedId] = useState(evses[0]?.asset_id);
  if (!data || ["loading", "error", "empty"].includes(state) || (!evses.length && !sessions.length)) return <PageState state={!evses.length && !sessions.length && state === "ready" ? "empty" : state} error={error} />;
  const selected = evses.find((evse) => evse.asset_id === selectedId) ?? evses[0];
  const imported = sessions.reduce((total, session) => total + Number(session.energy_imported_kwh ?? 0), 0);
  const exported = sessions.reduce((total, session) => total + Number(session.energy_exported_kwh ?? 0), 0);
  return <section className="scada-page" aria-labelledby="fleet-overview-title"><header className="scada-page__header"><h2 id="fleet-overview-title">{t("page.fleetOverview")}</h2><SimulatorNote /></header><PageState state={state} error={error} /><section className="scada-workspace-grid scada-workspace-grid--metrics"><article className="scada-panel"><p className="scada-eyebrow">{t("metric.activeSessions")}</p><strong className="scada-workspace-value">{sessions.length}</strong><SimulatorNote /></article><article className="scada-panel"><p className="scada-eyebrow">{t("metric.importedEnergy")}</p><strong className="scada-workspace-value">{imported} kWh</strong><SimulatorNote calculation /></article><article className="scada-panel"><p className="scada-eyebrow">{t("metric.exportedEnergy")}</p><strong className="scada-workspace-value">{exported} kWh</strong><SimulatorNote calculation /></article></section><section className="scada-workspace-grid"><article className="scada-panel"><p className="scada-eyebrow">{t("panel.evseTiles")}</p><div className="scada-workspace-tiles">{evses.map((evse) => <button className="scada-workspace-tile" type="button" aria-pressed={selected?.asset_id === evse.asset_id} key={evse.asset_id} onClick={() => setSelectedId(evse.asset_id)}>{evse.display_name ?? evse.asset_id}<small>{evse.state}</small></button>)}</div><SimulatorNote /></article><article className="scada-panel" aria-live="polite"><p className="scada-eyebrow">{t("panel.selectedDevice")}</p><h3>{selected?.display_name ?? selected?.asset_id}</h3><p className="scada-muted">{selected?.asset_id} · {selected?.state}</p><SimulatorNote /></article></section></section>;
}
