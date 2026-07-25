import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import App from "../src/App.jsx";

test("renders the V2G SCADA shell", () => {
  render(<App />);

  expect(screen.getByRole("main", { name: "V2G SCADA" })).toBeInTheDocument();
});

test("navigates the five operator tabs using allowlisted supervisor endpoints", async () => {
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
  expect(screen.getAllByRole("tab")).toHaveLength(5);
  for (const tab of ["Fleet", "Dispatch", "Alarms", "Historian"]) {
    fireEvent.click(screen.getByRole("tab", { name: tab }));
    expect(await screen.findByRole("heading", { name: tab })).toBeVisible();
  }
  expect(fetchMock.mock.calls.map(([url]) => String(url)).join(" ")).toContain("/api/v1/sites/demo-v2g-site/historian");
  vi.unstubAllGlobals();
});

test("supports automatic tab activation with roving keyboard focus", async () => {
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

  const operations = screen.getByRole("tab", { name: "Operations" });
  operations.focus();
  fireEvent.keyDown(operations, { key: "ArrowRight" });

  const fleet = screen.getByRole("tab", { name: "Fleet" });
  expect(fleet).toHaveFocus();
  expect(fleet).toHaveAttribute("aria-selected", "true");
  expect(fleet).toHaveAttribute("tabindex", "0");
  expect(operations).toHaveAttribute("tabindex", "-1");
  expect(await screen.findByRole("heading", { name: "Fleet" })).toBeVisible();

  fireEvent.keyDown(fleet, { key: "End" });
  const historian = screen.getByRole("tab", { name: "Historian" });
  expect(historian).toHaveFocus();
  expect(historian).toHaveAttribute("aria-selected", "true");

  fireEvent.keyDown(historian, { key: "Home" });
  expect(operations).toHaveFocus();
  expect(operations).toHaveAttribute("aria-selected", "true");

  fireEvent.keyDown(operations, { key: "ArrowLeft" });
  expect(historian).toHaveFocus();
  expect(historian).toHaveAttribute("aria-selected", "true");
  expect(await screen.findByRole("img", { name: "Site power chart" })).toBeVisible();
  vi.unstubAllGlobals();
});
