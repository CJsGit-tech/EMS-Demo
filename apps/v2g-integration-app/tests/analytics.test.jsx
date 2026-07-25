import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { EventAnalysisPage } from "../src/features/analytics/EventAnalysisPage.jsx";
import { InverterEfficiencyPage } from "../src/features/analytics/InverterEfficiencyPage.jsx";
import { SiteEfficiencyPage } from "../src/features/analytics/SiteEfficiencyPage.jsx";
import { StringHealthPage } from "../src/features/analytics/StringHealthPage.jsx";
import { I18nProvider } from "../src/i18n/I18nProvider.jsx";

const fixture = {
  simulated: true,
  from: "2030-01-15T00:00:00.000Z",
  to: "2030-01-16T00:00:00.000Z",
  site_efficiency: 94.2,
  expected_efficiency: null,
  availability_percent: 98.6,
  inverters: [
    { asset_id: "inv-02", ac_power_kw: 18, dc_power_kw: 20, efficiency_percent: 90, efficiency_deviation_percent: -2, observed_at: "2030-01-15T10:00:00.000Z" },
    { asset_id: "inv-01", ac_power_kw: 19, dc_power_kw: 20, efficiency_percent: 95, efficiency_deviation_percent: 3, observed_at: "2030-01-15T11:00:00.000Z" },
  ],
  strings: [
    { inverter_id: "inv-01", string_id: "string-01", dc_power_kw: 2.1, current_a: 5.2, voltage_v: 401, health_variance_percent: 12 },
    { inverter_id: "inv-01", string_id: "string-02", dc_power_kw: 2.2, current_a: 5.1, voltage_v: 402, health_variance_percent: 2 },
  ],
  events: { total: 3, by_severity: [["critical", 1], ["warning", 2]], by_source: [["inverter", 2]], recurring_codes: [["dc_imbalance", 2]], average_duration_minutes: null, trend: [] },
};

function renderPage(Page) {
  return render(<I18nProvider><Page data={fixture} state="ready" /></I18nProvider>);
}

test("marks calculated efficiency as simulated and displays string outliers", () => {
  renderPage(StringHealthPage);

  expect(screen.getByText("模擬計算")).toBeVisible();
  expect(screen.getByText("偏差過高")).toBeVisible();
  expect(screen.getByRole("list", { name: "組串健康度" })).toBeVisible();
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
});

test("renders efficiency KPIs, sorts inverters, and uses a dash for null calculations", () => {
  const { unmount } = renderPage(SiteEfficiencyPage);
  expect(screen.getByText("94.2%")).toBeVisible();
  expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  unmount();

  renderPage(InverterEfficiencyPage);
  fireEvent.click(screen.getByRole("button", { name: "效率" }));
  expect(screen.getAllByRole("row")[1]).toHaveTextContent("inv-01");
});

test("renders event severity distributions and unavailable aggregate calculations", () => {
  renderPage(EventAnalysisPage);

  expect(screen.getByText("critical · 1")).toBeVisible();
  expect(screen.getByText("dc_imbalance · 2")).toBeVisible();
  expect(screen.getByText("—")).toBeVisible();
});

test("renders unavailable event aggregate collections as dashes when the API explicitly returns null", () => {
  render(<I18nProvider><EventAnalysisPage data={{ ...fixture, events: { by_severity: null, by_source: null, recurring_codes: null, average_duration_minutes: null, trend: null } }} state="ready" /></I18nProvider>);

  expect(screen.getAllByText("—")).toHaveLength(4);
});
