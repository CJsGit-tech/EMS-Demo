import { useContext, useEffect, useState } from "react";

import { v2gApi } from "./api/client.js";
import { LanguageSwitcher } from "./components/LanguageSwitcher.jsx";
import { AlarmPage } from "./features/alarms/AlarmPage.jsx";
import { DispatchPage } from "./features/dispatch/DispatchPage.jsx";
import { FleetPage } from "./features/fleet/FleetPage.jsx";
import { HistorianPage, historianIsStale } from "./features/historian/HistorianPage.jsx";
import { OperationsPage } from "./features/operations/OperationsPage.jsx";
import { I18nContext, I18nProvider, useI18n } from "./i18n/I18nProvider.jsx";
import "./styles.css";

const navigationGroups = [
  { labelKey: "nav.overview", icon: "⌂", items: [{ labelKey: "nav.siteDashboard", tab: "Operations" }] },
  { labelKey: "nav.monitoring", icon: "◉", items: [{ labelKey: "nav.evseFleet", tab: "Fleet" }, { labelKey: "nav.activeAlarms", tab: "Alarms" }] },
  { labelKey: "nav.operations", icon: "↯", items: [{ labelKey: "nav.dispatchSupervisor", tab: "Dispatch" }] },
  { labelKey: "nav.analytics", icon: "⌁", items: [{ labelKey: "nav.powerHistorian", tab: "Historian" }] },
  { labelKey: "nav.reports", icon: "▤", items: [{ labelKey: "nav.shiftReport", planned: true }, { labelKey: "nav.auditExport", planned: true }] },
];

function historianWindow(rangeHours) {
  const to = new Date();
  const from = new Date(to.valueOf() - rangeHours * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

export default function App() {
  const i18n = useContext(I18nContext);
  return i18n ? <AppShell /> : <I18nProvider><AppShell /></I18nProvider>;
}

function AppShell() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("Operations");
  const [rangeHours, setRangeHours] = useState(24);
  const [resource, setResource] = useState({ state: "loading", data: null, error: null });

  useEffect(() => {
    let active = true;
    const loaders = {
      Operations: async () => {
        const window = historianWindow(rangeHours);
        const [overview, fleet, alarms, recommendations, historian] = await Promise.all([
          v2gApi.getOverview(),
          v2gApi.getFleet(),
          v2gApi.getAlarms(),
          v2gApi.getRecommendations(),
          v2gApi.getHistorian(window),
        ]);
        return { overview, fleet, alarms, recommendations, historian };
      },
      Fleet: v2gApi.getFleet,
      Dispatch: v2gApi.getRecommendations,
      Alarms: v2gApi.getAlarms,
      Historian: () => v2gApi.getHistorian(historianWindow(rangeHours)),
    };
    setResource({ state: "loading", data: null, error: null });
    loaders[activeTab]().then((data) => {
      if (!active) return;
      const stale = (activeTab === "Operations" && (data.overview?.data_freshness?.quality === "stale" || historianIsStale(data.historian)))
        || (activeTab === "Historian" && historianIsStale(data));
      const isEmpty = (data.alarms && data.alarms.length === 0) || (data.recommendations && data.recommendations.length === 0) || (data.points && data.points.length === 0);
      setResource({ state: stale ? "stale" : isEmpty ? "empty" : "ready", data, error: null });
    }).catch((failure) => {
      if (active) setResource({ state: "error", data: null, error: failure.message });
    });
    return () => { active = false; };
  }, [activeTab, rangeHours]);

  const recordApproval = (commandId, reason) => v2gApi.approveCommand(commandId, { actor: "local-scada-operator", reason });
  const recordRejection = (commandId, reason) => v2gApi.rejectCommand(commandId, { actor: "local-scada-operator", reason });
  const updateDispatchCommand = (command) => {
    if (!command?.command_id || !command?.state) return;
    setResource((current) => {
      const recommendations = current.data?.recommendations;
      if (!Array.isArray(recommendations)) return current;
      return {
        ...current,
        data: {
          ...current.data,
          recommendations: recommendations.map((recommendation) => (
            recommendation.command_id === command.command_id
              ? { ...recommendation, state: command.state }
              : recommendation
          )),
        },
      };
    });
  };
  const { data, state, error } = resource;
  let page;
  if (activeTab === "Operations") page = <OperationsPage overview={data?.overview} fleet={data?.fleet} alarms={data?.alarms} recommendations={data?.recommendations} historian={data?.historian} state={state} error={error} />;
  if (activeTab === "Fleet") page = <FleetPage fleet={data} state={state} error={error} />;
  if (activeTab === "Dispatch") page = <DispatchPage recommendations={data?.recommendations} state={state} error={error} onApprove={recordApproval} onReject={recordRejection} onCommandResolved={updateDispatchCommand} />;
  if (activeTab === "Alarms") page = <AlarmPage alarms={data} state={state} error={error} />;
  if (activeTab === "Historian") page = <HistorianPage historian={data} state={state} error={error} rangeHours={rangeHours} onRangeChange={setRangeHours} />;

  return <main className="scada-shell" aria-label={t("app.label")}><aside className="scada-sidebar"><div className="scada-sidebar__brand"><span aria-hidden="true">◈</span><div><p>V2G SCADA</p><small>{t("brand.simulator")}</small></div></div><nav className="scada-nav" aria-label={t("navigation.label")}>{navigationGroups.map((group) => <section className="scada-nav-group" key={group.labelKey}><p className="scada-nav-group__label"><span aria-hidden="true">{group.icon}</span>{t(group.labelKey)}</p><div>{group.items.map((item) => item.planned ? <span className="scada-nav-item scada-nav-item--planned" key={item.labelKey}>{t(item.labelKey)}<small>{t("nav.planned")}</small></span> : <button className="scada-nav-item" type="button" key={item.tab} aria-current={activeTab === item.tab ? "page" : undefined} onClick={() => setActiveTab(item.tab)}>{t(item.labelKey)}</button>)}</div></section>)}</nav><p className="scada-sidebar__boundary">{t("boundary.simulatorOnly")}<br />{t("boundary.noExternalControl")}</p></aside><section className="scada-app"><header className="scada-app__header"><div><p className="scada-eyebrow">{t("header.eyebrow", { site: "demo-v2g-site" })}</p><h1>{t("header.siteOverview")}</h1></div><div><p className="scada-app__boundary">{t("header.liveSimulator")}</p><LanguageSwitcher /></div></header><div id={`panel-${activeTab.toLowerCase()}`} aria-live="polite">{page}</div></section></main>;
}
