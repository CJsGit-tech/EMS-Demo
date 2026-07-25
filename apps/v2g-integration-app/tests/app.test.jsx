import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App.jsx";

test("renders the V2G SCADA shell", () => {
  render(<App />);

  expect(screen.getByRole("main", { name: "V2G SCADA" })).toBeInTheDocument();
});

test("navigates the grouped SCADA sidebar from a keyboard-focused native button using allowlisted supervisor endpoints", async () => {
  const responses = {
    overview: { site_id: "demo-v2g-site", site_power_kw: 18.4, available_flexible_kw: 25, data_freshness: { observed_at: "2030-01-15T10:30:00Z", quality: "good" } },
    fleet: { site_id: "demo-v2g-site", evses: [{ asset_id: "evse-01", display_name: "Demo EVSE", state: "Charging" }], sessions: [] },
    recommendations: { site_id: "demo-v2g-site", recommendations: [{ status: "proposed", expires_at: "2030-01-15T10:30:00Z", expected_site_impact_kw: 12, constraints: [], assumptions: [], reason: "Simulator advisory" }] },
    alarms: { site_id: "demo-v2g-site", alarms: [{ asset_id: "evse-01", code: "test", severity: "warning", state: "open", message: "Simulator test alarm", raised_at: "2030-01-15T10:30:00Z" }] },
    historian: { site_id: "demo-v2g-site", metric: "power_kw", points: [{ occurred_at: "2030-01-15T10:30:00Z", value: 12, quality: "good" }], truncated: false },
  };
  const fetchMock = vi.fn((url) => {
    const path = String(url);
    const response = path.includes("/overview") ? responses.overview
      : path.includes("/fleet") ? responses.fleet
        : path.includes("/recommendations") ? responses.recommendations
          : path.includes("/alarms") ? responses.alarms : responses.historian;
    return Promise.resolve({ ok: true, json: () => Promise.resolve(response) });
  });
  vi.stubGlobal("fetch", fetchMock);

  render(<App />);

  expect(await screen.findByText("18.4 kW")).toBeVisible();
  expect(screen.getByRole("navigation", { name: "SCADA 區域" })).toBeVisible();
  const user = userEvent.setup();
  const fleetButton = screen.getByRole("button", { name: "EVSE 車隊" });
  fleetButton.focus();
  expect(fleetButton).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(await screen.findByRole("heading", { name: "Fleet" })).toBeVisible();
  expect(screen.getByRole("button", { name: "EVSE 車隊" })).toHaveAttribute("aria-current", "page");
  for (const item of [["調度監督", "Dispatch"], ["目前告警", "Alarms"], ["電力歷史資料", "Historian"]]) {
    fireEvent.click(screen.getByRole("button", { name: item[0] }));
    expect(await screen.findByRole("heading", { name: item[1] })).toBeVisible();
  }
  expect(fetchMock.mock.calls.map(([url]) => String(url)).join(" ")).toContain("/api/v1/sites/demo-v2g-site/historian");
  vi.unstubAllGlobals();
});

test("marks the active sidebar location and leaves planned reports non-actionable", async () => {
  const responses = {
    overview: { site_id: "demo-v2g-site", site_power_kw: 18.4, available_flexible_kw: 25, data_freshness: { observed_at: "2030-01-15T10:30:00Z", quality: "good" } },
    fleet: { site_id: "demo-v2g-site", evses: [{ asset_id: "evse-01", display_name: "Demo EVSE", state: "Charging" }], sessions: [] },
    recommendations: { site_id: "demo-v2g-site", recommendations: [] },
    alarms: { site_id: "demo-v2g-site", alarms: [] },
    historian: { site_id: "demo-v2g-site", metric: "power_kw", points: [{ occurred_at: "2030-01-15T10:30:00Z", value: 12, quality: "good" }], truncated: false },
  };
  vi.stubGlobal("fetch", vi.fn((url) => {
    const path = String(url);
    const response = path.includes("/overview") ? responses.overview
      : path.includes("/fleet") ? responses.fleet
        : path.includes("/recommendations") ? responses.recommendations
          : path.includes("/alarms") ? responses.alarms : responses.historian;
    return Promise.resolve({ ok: true, json: () => Promise.resolve(response) });
  }));

  render(<App />);
  await screen.findByText("18.4 kW");

  const dashboard = screen.getByRole("button", { name: "電站總覽" });
  expect(dashboard).toHaveAttribute("aria-current", "page");
  expect(screen.getByText("交班報表")).toBeVisible();
  expect(screen.getAllByText("規劃中")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "電力歷史資料" }));
  expect(await screen.findByRole("img", { name: "Site power chart" })).toBeVisible();
  vi.unstubAllGlobals();
});
