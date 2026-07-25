import { useEffect, useState } from "react";

import { v2gApi } from "./api/client.js";
import { AlarmPage } from "./features/alarms/AlarmPage.jsx";
import { DispatchPage } from "./features/dispatch/DispatchPage.jsx";
import { FleetPage } from "./features/fleet/FleetPage.jsx";
import { HistorianPage } from "./features/historian/HistorianPage.jsx";
import { OperationsPage } from "./features/operations/OperationsPage.jsx";
import "./styles.css";

const tabs = ["Operations", "Fleet", "Dispatch", "Alarms", "Historian"];

function historianWindow(rangeHours) {
  const to = new Date();
  const from = new Date(to.valueOf() - rangeHours * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

export default function App() {
  const [activeTab, setActiveTab] = useState("Operations");
  const [rangeHours, setRangeHours] = useState(24);
  const [resource, setResource] = useState({ state: "loading", data: null, error: null });

  useEffect(() => {
    let active = true;
    const loaders = {
      Operations: v2gApi.getOverview,
      Fleet: v2gApi.getFleet,
      Dispatch: v2gApi.getRecommendations,
      Alarms: v2gApi.getAlarms,
      Historian: () => v2gApi.getHistorian(historianWindow(rangeHours)),
    };
    setResource({ state: "loading", data: null, error: null });
    loaders[activeTab]().then((data) => {
      if (!active) return;
      const stale = activeTab === "Operations" && data.data_freshness?.quality === "stale";
      const isEmpty = (data.alarms && data.alarms.length === 0) || (data.recommendations && data.recommendations.length === 0) || (data.points && data.points.length === 0);
      setResource({ state: stale ? "stale" : isEmpty ? "empty" : "ready", data, error: null });
    }).catch((failure) => {
      if (active) setResource({ state: "error", data: null, error: failure.message });
    });
    return () => { active = false; };
  }, [activeTab, rangeHours]);

  const recordApproval = (commandId, reason) => v2gApi.approveCommand(commandId, { actor: "local-scada-operator", reason });
  const recordRejection = (commandId, reason) => v2gApi.rejectCommand(commandId, { actor: "local-scada-operator", reason });
  const { data, state, error } = resource;
  let page;
  if (activeTab === "Operations") page = <OperationsPage overview={data} state={state} error={error} />;
  if (activeTab === "Fleet") page = <FleetPage fleet={data} state={state} error={error} />;
  if (activeTab === "Dispatch") page = <DispatchPage recommendations={data?.recommendations} state={state} error={error} onApprove={recordApproval} onReject={recordRejection} />;
  if (activeTab === "Alarms") page = <AlarmPage alarms={data} state={state} error={error} />;
  if (activeTab === "Historian") page = <HistorianPage historian={data} state={state} error={error} rangeHours={rangeHours} onRangeChange={setRangeHours} />;

  return <main className="scada-app" aria-label="V2G SCADA"><header className="scada-app__header"><div><p className="scada-eyebrow">V2G supervisor · local simulator</p><h1>SCADA operator console</h1></div><p className="scada-app__boundary">SIMULATOR · NO EXTERNAL CONTROL</p></header><nav className="scada-tabs" aria-label="SCADA sections" role="tablist">{tabs.map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} aria-controls={`panel-${tab.toLowerCase()}`} id={`tab-${tab.toLowerCase()}`} onClick={() => setActiveTab(tab)}>{tab}</button>)}</nav><div id={`panel-${activeTab.toLowerCase()}`} role="tabpanel" aria-labelledby={`tab-${activeTab.toLowerCase()}`} tabIndex="-1">{page}</div></main>;
}
