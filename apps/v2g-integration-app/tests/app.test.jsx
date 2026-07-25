import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import App from "../src/App.jsx";

const responses = {
  overview: { simulated: true, site_id: "demo-v2g-site", site_power_kw: 18.4, available_flexible_kw: 25, data_freshness: { observed_at: "2030-01-15T10:30:00Z", quality: "good" } },
  fleet: { simulated: true, site_id: "demo-v2g-site", evses: [{ asset_id: "evse-01", display_name: "EVSE 01", state: "Charging" }], sessions: [{ session_id: "session-01", state: "charging", energy_imported_kwh: 8, energy_exported_kwh: 1 }] },
  historian: { simulated: true, points: [{ occurred_at: "2030-01-15T10:30:00Z", value: 18.4, quality: "good" }] },
  recommendations: { simulated: true, recommendations: [] },
  alarms: { simulated: true, alarms: [] },
  diagnostics: { simulated: true, observed_at: "2030-01-15T10:30:00Z", open_alarm_count: 0, assets: [{ asset_id: "evse-01", communication_state: "Charging", latest_telemetry_at: "2030-01-15T10:30:00Z", telemetry_gap_minutes: 0, open_alarm_count: 0 }] },
  events: { simulated: true, events: [{ event_id: 1, asset_id: "evse-03", code: "comms_loss", severity: "critical", state: "open", message: "通訊中斷", raised_at: "2030-01-15T10:30:00Z" }] },
  inverters: { simulated: true, inverters: [{ asset_id: "inverter-01", ac_power_kw: 18, dc_power_kw: 20, temperature_c: 42, efficiency_percent: 90, communication_state: "online", alarm_count: 0, observed_at: "2030-01-15T10:30:00Z" }] },
  trend: { simulated: true, points: [{ observed_at: "2030-01-15T10:30:00Z", value: 18 }] },
};

function stubApi(overrides = {}) {
  const fetchMock = vi.fn((url) => {
    const path = String(url);
    const response = path.includes("/commands/") ? { command_id: "cmd-014", state: path.includes("/approve") ? "approved" : "rejected" }
      : path.includes("/diagnostics") ? responses.diagnostics
      : path.includes("/inverters/") ? responses.trend
        : path.includes("/inverters") ? responses.inverters
          : path.includes("/events") ? responses.events
            : path.includes("/overview") ? responses.overview
              : path.includes("/fleet") ? responses.fleet
                : path.includes("/recommendations") ? responses.recommendations
                  : path.includes("/alarms") ? responses.alarms : responses.historian;
    return Promise.resolve({ ok: true, json: () => Promise.resolve(overrides[path.includes("/recommendations") ? "recommendations" : "command"] ?? response) });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

test("uses four Chinese navigation groups without reports and opens the event management workspace", async () => {
  stubApi();
  const user = userEvent.setup();
  render(<App />);

  expect((await screen.findAllByRole("heading", { name: "電站總覽" }))[0]).toBeVisible();
  expect(screen.getByRole("navigation", { name: "SCADA 區域" })).toBeVisible();
  for (const label of ["總覽", "監控", "維運", "分析"]) expect(screen.getByText(label)).toBeVisible();
  expect(screen.queryByText("報表")).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "事件管理" }));
  expect((await screen.findAllByRole("heading", { name: "事件管理" }))[0]).toBeVisible();
  expect(screen.getByText("嚴重度")).toBeVisible();
  expect(screen.getByRole("button", { name: "事件管理" })).toHaveAttribute("aria-current", "page");
});

test("keeps direct keyboard focus on each real selected navigation view", async () => {
  stubApi();
  const user = userEvent.setup();
  render(<App />);
  await screen.findAllByRole("heading", { name: "電站總覽" });

  const diagnostics = screen.getByRole("button", { name: "診斷" });
  diagnostics.focus();
  await user.keyboard("{Enter}");
  expect((await screen.findAllByRole("heading", { name: "診斷" }))[0]).toBeVisible();
  expect(diagnostics).toHaveFocus();
});

test("opens the existing Operations workspace from the localized operations navigation", async () => {
  stubApi();
  const user = userEvent.setup();
  render(<App />);
  await screen.findAllByRole("heading", { name: "電站總覽" });

  await user.click(screen.getByRole("button", { name: "營運儀表板" }));

  expect(await screen.findByRole("heading", { name: "營運" })).toBeVisible();
  expect(screen.getByText("站點功率軌跡")).toBeVisible();
  expect(screen.getByRole("button", { name: "營運儀表板" })).toHaveAttribute("aria-current", "page");
});

test.each([
  ["核准模擬指令", "已核准", "/commands/cmd-014/approve"],
  ["拒絕模擬指令", "已拒絕", "/commands/cmd-014/reject"],
])("keeps the dispatch command callback wired for %s actions", async (action, displayState, endpoint) => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    close: { configurable: true, value() { this.open = false; this.dispatchEvent(new Event("close")); } },
    showModal: { configurable: true, value() { this.open = true; } },
  });
  const fetchMock = stubApi({
    recommendations: {
      simulated: true,
      recommendations: [{ command_id: "cmd-014", state: "awaiting_approval", expires_at: "2030-01-15T10:30:00Z", projected_soc_percent: 74, power_kw: -32, constraints: ["Reserve SOC remains above 35%"], reason: "Bounded simulator recommendation" }],
    },
  });
  const user = userEvent.setup();
  render(<App />);
  await screen.findAllByRole("heading", { name: "電站總覽" });

  await user.click(screen.getByRole("button", { name: "調度監督" }));
  expect(await screen.findByRole("heading", { name: "調度" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "核准模擬指令" }));
  fireEvent.change(screen.getByLabelText("操作人原因"), { target: { value: "Record the simulator decision." } });
  fireEvent.click(within(screen.getByRole("dialog", { name: "核准模擬指令" })).getByRole("button", { name: action }));

  expect(await screen.findByText(displayState)).toBeVisible();
  expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual(expect.arrayContaining([expect.stringContaining(endpoint)]));
});
