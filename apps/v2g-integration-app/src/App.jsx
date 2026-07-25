import { useContext, useEffect, useState } from "react";

import { v2gApi } from "./api/client.js";
import { LanguageSwitcher } from "./components/LanguageSwitcher.jsx";
import { diagnosticsIsStale } from "./components/PageState.jsx";
import { ScadaSidebar } from "./components/ScadaSidebar.jsx";
import { DispatchPage } from "./features/dispatch/DispatchPage.jsx";
import { HistorianPage, historianIsStale } from "./features/historian/HistorianPage.jsx";
import { EventManagementPage } from "./features/monitoring/EventManagementPage.jsx";
import { InverterMonitoringPage } from "./features/monitoring/InverterMonitoringPage.jsx";
import { LiveMonitoringPage } from "./features/monitoring/LiveMonitoringPage.jsx";
import { OperationsPage } from "./features/operations/OperationsPage.jsx";
import { OperationsLogPage } from "./features/operations/OperationsLogPage.jsx";
import { WorkOrdersPage } from "./features/operations/WorkOrdersPage.jsx";
import { SiteEfficiencyPage } from "./features/analytics/SiteEfficiencyPage.jsx";
import { InverterEfficiencyPage } from "./features/analytics/InverterEfficiencyPage.jsx";
import { StringHealthPage } from "./features/analytics/StringHealthPage.jsx";
import { EventAnalysisPage } from "./features/analytics/EventAnalysisPage.jsx";
import { DiagnosticsPage } from "./features/overview/DiagnosticsPage.jsx";
import { FleetOverviewPage } from "./features/overview/FleetOverviewPage.jsx";
import { SiteOverviewPage } from "./features/overview/SiteOverviewPage.jsx";
import { I18nContext, I18nProvider, useI18n } from "./i18n/I18nProvider.jsx";
import "./styles.css";

function historianWindow(rangeHours) {
  const to = new Date();
  const from = new Date(to.valueOf() - rangeHours * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

function resourceState(view, data) {
  const points = data?.historian?.points ?? data?.points ?? [];
  const stale = data?.overview?.data_freshness?.quality === "stale" || data?.data_freshness?.quality === "stale" || historianIsStale(data?.historian ?? data) || (view === "diagnostics" && diagnosticsIsStale(data));
  if (stale) return "stale";
  const collection = view === "diagnostics" ? data?.assets : view === "events" ? data?.events : view === "inverters" ? data?.inverters : null;
  if (Array.isArray(collection) && collection.length === 0) return "empty";
  if (view === "historian" && points.length === 0) return "empty";
  return "ready";
}

export default function App() {
  const i18n = useContext(I18nContext);
  return i18n ? <AppShell /> : <I18nProvider><AppShell /></I18nProvider>;
}

function AppShell() {
  const { t } = useI18n();
  const [activeView, setActiveView] = useState("siteOverview");
  const [rangeHours, setRangeHours] = useState(24);
  const [resource, setResource] = useState({ state: "loading", data: null, error: null });

  useEffect(() => {
    let active = true;
    const load = async () => {
      const window = historianWindow(rangeHours);
      if (["siteOverview", "operations"].includes(activeView)) {
        const [overview, fleet, alarms, recommendations, historian] = await Promise.all([v2gApi.getOverview(), v2gApi.getFleet(), v2gApi.getAlarms(), v2gApi.getRecommendations(), v2gApi.getHistorian(window)]);
        return { overview, fleet, alarms, recommendations, historian };
      }
      if (activeView === "fleetOverview") return v2gApi.getFleet();
      if (activeView === "diagnostics") return v2gApi.getDiagnostics();
      if (activeView === "events") return v2gApi.getEvents();
      if (activeView === "liveMonitoring") {
        const [overview, fleet, historian] = await Promise.all([v2gApi.getOverview(), v2gApi.getFleet(), v2gApi.getHistorian(window)]);
        return { overview, fleet, historian };
      }
      if (activeView === "inverters") {
        const snapshot = await v2gApi.getInverters();
        const trends = Object.fromEntries(await Promise.all((snapshot.inverters ?? []).map(async (inverter) => [inverter.asset_id, await v2gApi.getInverterTrend(inverter.asset_id, window)])));
        return { ...snapshot, trends };
      }
      if (activeView === "dispatch") return v2gApi.getRecommendations();
      if (["operationsLog", "workOrders"].includes(activeView)) return v2gApi.getWorkOrders();
      if (["siteEfficiency", "inverterEfficiency", "stringHealth", "eventAnalysis"].includes(activeView)) return v2gApi.getAnalytics(window);
      return v2gApi.getHistorian(window);
    };
    setResource({ state: "loading", data: null, error: null });
    load().then((data) => {
      if (active) setResource({ state: resourceState(activeView, data), data, error: null });
    }).catch((failure) => {
      if (active) setResource({ state: "error", data: null, error: failure.message });
    });
    return () => { active = false; };
  }, [activeView, rangeHours]);

  const { data, state, error } = resource;
  const recordApproval = (commandId, reason) => v2gApi.approveCommand(commandId, { actor: "local-scada-operator", reason });
  const recordRejection = (commandId, reason) => v2gApi.rejectCommand(commandId, { actor: "local-scada-operator", reason });
  const transitionWorkOrder = (workOrderId, transition) => v2gApi.transitionWorkOrder(workOrderId, transition);
  const updateDispatchCommand = (command) => {
    if (!command?.command_id || !command?.state) return;
    setResource((current) => {
      const recommendations = current.data?.recommendations;
      if (!Array.isArray(recommendations)) return current;
      return { ...current, data: { ...current.data, recommendations: recommendations.map((recommendation) => recommendation.command_id === command.command_id ? { ...recommendation, state: command.state } : recommendation) } };
    });
  };
  const headings = { siteOverview: "page.siteOverview", fleetOverview: "page.fleetOverview", diagnostics: "page.diagnostics", events: "page.events", liveMonitoring: "page.liveMonitoring", inverters: "page.inverters", operations: "nav.operationsDashboard", operationsLog: "page.operationsLog", workOrders: "page.workOrders", dispatch: "nav.dispatchSupervisor", historian: "nav.powerHistorian", siteEfficiency: "page.siteEfficiency", inverterEfficiency: "page.inverterEfficiency", stringHealth: "page.stringHealth", eventAnalysis: "page.eventAnalysis" };
  const alarmCount = data?.alarms?.alarms?.filter((alarm) => alarm.state !== "cleared").length ?? 0;
  let page;
  if (activeView === "siteOverview") page = <SiteOverviewPage data={data} state={state} error={error} />;
  if (activeView === "fleetOverview") page = <FleetOverviewPage data={data} state={state} error={error} />;
  if (activeView === "diagnostics") page = <DiagnosticsPage data={data} state={state} error={error} />;
  if (activeView === "events") page = <EventManagementPage data={data} state={state} error={error} />;
  if (activeView === "liveMonitoring") page = <LiveMonitoringPage data={data} state={state} error={error} />;
  if (activeView === "inverters") page = <InverterMonitoringPage data={data} state={state} error={error} />;
  if (activeView === "operations") page = <OperationsPage overview={data?.overview} fleet={data?.fleet} alarms={data?.alarms} recommendations={data?.recommendations} historian={data?.historian} state={state} error={error} />;
  if (activeView === "operationsLog") page = <OperationsLogPage data={data} state={state} error={error} />;
  if (activeView === "workOrders") page = <WorkOrdersPage data={data} state={state} error={error} onTransition={transitionWorkOrder} />;
  if (activeView === "dispatch") page = <DispatchPage recommendations={Array.isArray(data?.recommendations) ? data.recommendations : []} state={state} error={error} onApprove={recordApproval} onReject={recordRejection} onCommandResolved={updateDispatchCommand} />;
  if (activeView === "historian") page = <HistorianPage historian={data} state={state} error={error} rangeHours={rangeHours} onRangeChange={setRangeHours} />;
  if (activeView === "siteEfficiency") page = <SiteEfficiencyPage data={data} state={state} error={error} />;
  if (activeView === "inverterEfficiency") page = <InverterEfficiencyPage data={data} state={state} error={error} />;
  if (activeView === "stringHealth") page = <StringHealthPage data={data} state={state} error={error} />;
  if (activeView === "eventAnalysis") page = <EventAnalysisPage data={data} state={state} error={error} />;

  return <main className="scada-shell" aria-label={t("app.label")}><ScadaSidebar activeView={activeView} onSelect={setActiveView} alarmCount={alarmCount} /><section className="scada-app"><header className="scada-app__header"><div><p className="scada-eyebrow">{t("header.eyebrow", { site: "demo-v2g-site" })}</p><h1>{t(headings[activeView])}</h1></div><div><p className="scada-app__boundary">{t("header.liveSimulator")}</p><LanguageSwitcher /></div></header><div id={`panel-${activeView}`} aria-live="polite">{page}</div></section></main>;
}
