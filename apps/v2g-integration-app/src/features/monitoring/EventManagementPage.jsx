import { useMemo, useState } from "react";

import { PageState, SimulatorNote } from "../../components/PageState.jsx";
import { useI18n } from "../../i18n/I18nProvider.jsx";

export function EventManagementPage({ data, state = "loading", error }) {
  const { t } = useI18n();
  const events = data?.events ?? [];
  const [severity, setSeverity] = useState("");
  const [eventState, setEventState] = useState("");
  const [assetId, setAssetId] = useState("");
  const [selectedId, setSelectedId] = useState(events[0]?.event_id);
  const filtered = useMemo(() => events.filter((event) => (!severity || event.severity === severity) && (!eventState || event.state === eventState) && (!assetId || event.asset_id === assetId)), [assetId, eventState, events, severity]);
  if (!data || ["loading", "error", "empty"].includes(state)) return <PageState state={state} error={error} />;
  const selected = filtered.find((event) => event.event_id === selectedId) ?? filtered[0];
  return <section className="scada-page" aria-labelledby="events-title"><header className="scada-page__header"><h2 id="events-title">{t("page.events")}</h2><SimulatorNote /></header><PageState state={state} error={error} /><form className="scada-filter-bar" onSubmit={(event) => event.preventDefault()}><label>{t("event.severity")}<select value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="">{t("filter.all")}</option><option value="critical">critical</option><option value="warning">warning</option></select></label><label>{t("event.state")}<select value={eventState} onChange={(event) => setEventState(event.target.value)}><option value="">{t("filter.all")}</option><option value="open">open</option><option value="cleared">cleared</option></select></label><label>{t("event.asset")}<select value={assetId} onChange={(event) => setAssetId(event.target.value)}><option value="">{t("filter.all")}</option>{[...new Set(events.map((event) => event.asset_id).filter(Boolean))].map((asset) => <option key={asset} value={asset}>{asset}</option>)}</select></label></form><section className="scada-workspace-grid"><article className="scada-panel"><div className="scada-workspace-list">{filtered.length ? filtered.map((event) => <button className="scada-workspace-row" key={event.event_id} type="button" aria-pressed={selected?.event_id === event.event_id} onClick={() => setSelectedId(event.event_id)}><span>{event.message}</span><small>{event.severity} · {event.state}</small></button>) : <p className="scada-empty">{t("state.empty")}</p>}</div><SimulatorNote /></article><article className="scada-panel" aria-live="polite"><p className="scada-eyebrow">{t("panel.eventDetail")}</p>{selected ? <><h3>{selected.code}</h3><p>{selected.message}</p><p className="scada-muted">{selected.asset_id ?? "site"} · {selected.raised_at}</p></> : <p className="scada-empty">{t("state.empty")}</p>}<SimulatorNote /></article></section></section>;
}
