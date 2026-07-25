import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EventManagementPage } from "../src/features/monitoring/EventManagementPage.jsx";
import { InverterMonitoringPage } from "../src/features/monitoring/InverterMonitoringPage.jsx";
import { LiveMonitoringPage } from "../src/features/monitoring/LiveMonitoringPage.jsx";
import { I18nProvider } from "../src/i18n/I18nProvider.jsx";

function renderPage(page) {
  return render(<I18nProvider>{page}</I18nProvider>);
}

test("filters events by severity and exposes the selected event detail", async () => {
  const user = userEvent.setup();
  renderPage(
    <EventManagementPage
      data={{
        simulated: true,
        events: [
          { event_id: 1, asset_id: "evse-03", code: "comms_loss", severity: "critical", state: "open", message: "通訊中斷", raised_at: "2030-01-15T10:30:00.000Z" },
          { event_id: 2, asset_id: "evse-01", code: "thermal_watch", severity: "warning", state: "cleared", message: "溫度注意", raised_at: "2030-01-15T10:15:00.000Z" },
        ],
      }}
      state="ready"
    />,
  );

  expect(screen.getByRole("heading", { name: "事件管理" })).toBeVisible();
  expect(screen.getByText("嚴重度")).toBeVisible();
  await user.selectOptions(screen.getByLabelText("嚴重度"), "critical");
  expect(screen.getAllByText("通訊中斷").length).toBeGreaterThan(0);
  expect(screen.queryByText("溫度注意")).not.toBeInTheDocument();
  expect(screen.getAllByText("模擬資料").length).toBeGreaterThan(0);
});

test("shows live monitoring trend, capacity, sessions, and freshness", () => {
  renderPage(
    <LiveMonitoringPage
      data={{
        overview: { simulated: true, site_power_kw: 18.4, available_flexible_kw: 25, data_freshness: { quality: "good" } },
        historian: { simulated: true, points: [{ occurred_at: "2030-01-15T10:30:00.000Z", value: 18.4, quality: "good" }] },
        fleet: { simulated: true, sessions: [{ session_id: "session-01", state: "charging" }, { session_id: "session-02", state: "charging" }] },
      }}
      state="ready"
    />,
  );

  expect(screen.getByRole("heading", { name: "即時監控" })).toBeVisible();
  expect(screen.getByRole("img", { name: "即時站點功率趨勢圖" })).toBeVisible();
  expect(screen.getByText("25 kW")).toBeVisible();
  expect(screen.getByText("2 筆進行中" )).toBeVisible();
});

test("shows selected inverter measurements and its trend", () => {
  renderPage(
    <InverterMonitoringPage
      data={{
        simulated: true,
        inverters: [{ asset_id: "inverter-01", ac_power_kw: 18, dc_power_kw: 20, temperature_c: 42, efficiency_percent: 90, communication_state: "online", alarm_count: 0, observed_at: "2030-01-15T10:30:00.000Z" }],
        trends: { "inverter-01": { simulated: true, points: [{ observed_at: "2030-01-15T10:30:00.000Z", value: 18 }] } },
      }}
      state="ready"
    />,
  );

  expect(screen.getByRole("heading", { name: "變流器監控" })).toBeVisible();
  expect(screen.getByText("18 kW")).toBeVisible();
  expect(screen.getByText("90%" )).toBeVisible();
  expect(screen.getByRole("img", { name: "inverter-01 功率趨勢圖" })).toBeVisible();
});

test.each([
  ["loading", "正在載入模擬資料…"],
  ["empty", "沒有可用的模擬資料。"],
  ["error", "無法載入模擬資料。"],
  ["stale", "資料可能已過期"],
])("localizes the %s live-monitoring state", (state, message) => {
  renderPage(<LiveMonitoringPage data={state === "stale" ? { overview: { simulated: true }, historian: { points: [] }, fleet: { sessions: [] } } : null} state={state} />);

  expect(screen.getByText(message)).toBeVisible();
});
