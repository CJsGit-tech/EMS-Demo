import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";

import { DiagnosticsPage } from "../src/features/overview/DiagnosticsPage.jsx";
import { FleetOverviewPage } from "../src/features/overview/FleetOverviewPage.jsx";
import { SiteOverviewPage } from "../src/features/overview/SiteOverviewPage.jsx";
import { I18nProvider } from "../src/i18n/I18nProvider.jsx";

const overview = {
  simulated: true,
  site_id: "demo-v2g-site",
  site_power_kw: 18.4,
  available_flexible_kw: 25,
  data_freshness: { observed_at: "2030-01-15T10:30:00.000Z", quality: "good" },
};

function renderPage(page) {
  return render(<I18nProvider>{page}</I18nProvider>);
}

test("renders the localized site overview operational panels as simulator data", () => {
  renderPage(
    <SiteOverviewPage
      data={{
        overview,
        fleet: { simulated: true, evses: [{ asset_id: "evse-01", display_name: "EVSE 01", state: "Charging" }] },
        historian: { simulated: true, points: [{ occurred_at: "2030-01-15T10:20:00.000Z", value: 16, quality: "good" }] },
        recommendations: { simulated: true, recommendations: [{ expected_site_impact_kw: 12, state: "proposed" }] },
        alarms: { simulated: true, alarms: [{ code: "site_limit", state: "open", severity: "warning" }] },
      }}
      state="ready"
    />,
  );

  expect(screen.getByRole("heading", { name: "電站總覽" })).toBeVisible();
  expect(screen.getByText("18.4 kW")).toBeVisible();
  expect(screen.getByRole("img", { name: "站點功率趨勢圖" })).toBeVisible();
  expect(screen.getAllByText("模擬資料").length).toBeGreaterThan(0);
  expect(screen.getAllByText("模擬計算").length).toBeGreaterThan(0);
});

test("shows fleet energy and a selected EVSE detail", () => {
  renderPage(
    <FleetOverviewPage
      data={{
        simulated: true,
        evses: [{ asset_id: "evse-01", display_name: "EVSE 01", state: "Charging" }],
        sessions: [{ session_id: "session-01", asset_id: "evse-01", state: "charging", energy_imported_kwh: 8.5, energy_exported_kwh: 1.2 }],
      }}
      state="ready"
    />,
  );

  expect(screen.getByRole("heading", { name: "車隊總覽" })).toBeVisible();
  expect(screen.getByText("8.5 kWh")).toBeVisible();
  expect(screen.getByText("1.2 kWh")).toBeVisible();
  expect(screen.getByRole("heading", { name: "EVSE 01" })).toBeVisible();
});

test("renders diagnostics freshness as an operational state", () => {
  renderPage(
    <DiagnosticsPage
      data={{
        simulated: true,
        observed_at: "2030-01-15T10:30:00.000Z",
        open_alarm_count: 1,
        assets: [{ asset_id: "evse-03", communication_state: "Unavailable", latest_telemetry_at: "2030-01-15T10:00:00.000Z", telemetry_gap_minutes: 30, open_alarm_count: 1, freshness: "stale" }],
      }}
      state="ready"
    />,
  );

  expect(screen.getByText("資料可能已過期")).toBeVisible();
  expect(screen.getByText("evse-03")).toBeVisible();
  expect(screen.getByText("30 分鐘")).toBeVisible();
});

test.each([
  ["loading", "正在載入模擬資料…"],
  ["empty", "沒有可用的模擬資料。"],
  ["error", "無法載入模擬資料。"],
  ["stale", "資料可能已過期"],
])("localizes the %s diagnostics state", (state, message) => {
  renderPage(<DiagnosticsPage data={state === "stale" ? { simulated: true, assets: [] } : null} state={state} />);

  expect(screen.getByText(message)).toBeVisible();
});
