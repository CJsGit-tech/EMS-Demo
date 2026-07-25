import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";

import { OperationsPage } from "../src/features/operations/OperationsPage.jsx";
import { HistorianPage } from "../src/features/historian/HistorianPage.jsx";
import { I18nProvider } from "../src/i18n/I18nProvider.jsx";

function renderInTraditionalChinese(ui) {
  window.localStorage.removeItem("v2g-scada-locale");
  return render(<I18nProvider>{ui}</I18nProvider>);
}

test("localizes the operations dashboard in Traditional Chinese by default", () => {
  renderInTraditionalChinese(
    <OperationsPage
      overview={{
        site_id: "demo-v2g-site",
        site_power_kw: 18.4,
        available_flexible_kw: 25,
        data_freshness: { observed_at: "2030-01-15T10:30:00.000Z", quality: "good" },
      }}
      state="ready"
    />,
  );

  expect(screen.getByRole("heading", { name: "營運" })).toBeVisible();
  expect(screen.getByText("站點功率")).toBeVisible();
  expect(screen.getByText("模擬器已連線 · 僅供示範資料")).toBeVisible();
});

test("localizes the historian in Traditional Chinese by default", () => {
  renderInTraditionalChinese(
    <HistorianPage
      historian={{
        metric: "power_kw",
        points: [{ occurred_at: "2030-01-15T10:30:00.000Z", value: 18.4, quality: "good" }],
        truncated: true,
      }}
      state="ready"
      rangeHours={24}
      onRangeChange={vi.fn()}
    />,
  );

  expect(screen.getByRole("heading", { name: "歷史資料" })).toBeVisible();
  expect(screen.getByLabelText("範圍")).toBeVisible();
  expect(screen.getByText("結果僅顯示模擬器歷史資料回應視窗內的資料。")).toBeVisible();
});

test("shows simulator live metrics with adjacent freshness and quality", () => {
  render(
    <OperationsPage
      overview={{
        site_id: "demo-v2g-site",
        site_power_kw: 18.4,
        available_flexible_kw: 25,
        data_freshness: { observed_at: "2030-01-15T10:30:00.000Z", quality: "good" },
      }}
      state="ready"
    />,
  );

  expect(screen.getByRole("heading", { name: "Operations" })).toBeVisible();
  expect(screen.getByText("18.4 kW")).toBeVisible();
  expect(screen.getAllByText("Data freshness: good")).toHaveLength(4);
  expect(screen.getByText(/simulator connected/i)).toBeVisible();
});

test("turns existing fleet, historian, dispatch, and alarm data into an operations dashboard", () => {
  render(
    <OperationsPage
      overview={{ site_id: "demo-v2g-site", site_power_kw: 18.4, available_flexible_kw: 25, data_freshness: { observed_at: "2030-01-15T10:30:00.000Z", quality: "good" } }}
      fleet={{ evses: [{ asset_id: "evse-1", display_name: "EVSE 01", state: "Available" }, { asset_id: "evse-2", display_name: "EVSE 02", state: "Charging" }] }}
      historian={{ points: [{ occurred_at: "2030-01-15T10:00:00.000Z", value: 10, quality: "good" }, { occurred_at: "2030-01-15T10:30:00.000Z", value: 18.4, quality: "good" }] }}
      recommendations={{ recommendations: [{ status: "proposed", expected_site_impact_kw: 12, confidence: 0.86, expires_at: "2030-01-15T11:00:00.000Z" }] }}
      alarms={{ alarms: [{ asset_id: "evse-2", code: "thermal_watch", severity: "warning", state: "open", message: "Temperature elevated" }] }}
      state="ready"
    />,
  );

  expect(screen.getByRole("img", { name: "Site power trajectory chart" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "EVSE availability" })).toBeVisible();
  expect(screen.getByText("EVSE 01")).toBeVisible();
  expect(screen.getByRole("heading", { name: "Active alarms" })).toBeVisible();
  expect(screen.getByText("thermal_watch")).toBeVisible();
  expect(screen.getByText("Confidence")).toBeVisible();
});

test("treats stale operations data as a visible operational state", () => {
  render(
    <OperationsPage
      overview={{
        site_id: "demo-v2g-site",
        site_power_kw: 18.4,
        available_flexible_kw: 25,
        data_freshness: { observed_at: "2030-01-15T10:30:00.000Z", quality: "stale" },
      }}
      state="stale"
    />,
  );

  expect(screen.getByRole("status")).toHaveTextContent(/data may be stale/i);
  expect(screen.getAllByText("Data freshness: stale")).toHaveLength(4);
});

test("derives the historian warning from historian point quality", () => {
  render(
    <HistorianPage
      historian={{
        metric: "power_kw",
        points: [{ occurred_at: "2030-01-15T10:30:00.000Z", value: 18.4, quality: "stale" }],
        truncated: false,
      }}
      state="ready"
      rangeHours={24}
      onRangeChange={vi.fn()}
    />,
  );

  expect(screen.getByRole("status")).toHaveTextContent(/historian data may be stale/i);
  expect(screen.getByText("Data quality: stale")).toBeVisible();
});
