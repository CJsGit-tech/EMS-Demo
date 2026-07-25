import { useI18n } from "../i18n/I18nProvider.jsx";

const groups = [
  { key: "overview", items: [{ view: "siteOverview", label: "nav.siteDashboard" }, { view: "fleetOverview", label: "nav.fleetOverview" }, { view: "diagnostics", label: "nav.diagnostics" }] },
  { key: "monitoring", items: [{ view: "events", label: "nav.events" }, { view: "liveMonitoring", label: "nav.liveMonitoring" }, { view: "inverters", label: "nav.inverters" }] },
  { key: "operations", items: [{ view: "operations", label: "nav.operationsDashboard" }, { view: "dispatch", label: "nav.dispatchSupervisor" }] },
  { key: "analytics", items: [{ view: "historian", label: "nav.powerHistorian" }] },
];

export function ScadaSidebar({ activeView, onSelect, alarmCount = 0 }) {
  const { t } = useI18n();
  return <aside className="scada-sidebar"><div className="scada-sidebar__brand"><span aria-hidden="true">◈</span><div><p>V2G SCADA</p><small>{t("brand.simulator")}</small></div></div><nav className="scada-nav" aria-label={t("navigation.label")}>{groups.map((group) => <section className="scada-nav-group" key={group.key}><p className="scada-nav-group__label">{t(`nav.${group.key}`)}</p><div>{group.items.map((item) => <button className="scada-nav-item" type="button" key={item.view} aria-current={activeView === item.view ? "page" : undefined} onClick={() => onSelect(item.view)}>{t(item.label)}{item.view === "events" && alarmCount ? <small>{alarmCount}</small> : null}</button>)}</div></section>)}</nav><p className="scada-sidebar__boundary">{t("boundary.simulatorOnly")}<br />{t("boundary.noExternalControl")}</p></aside>;
}
