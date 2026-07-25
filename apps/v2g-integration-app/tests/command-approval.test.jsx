import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { DispatchPage } from "../src/features/dispatch/DispatchPage.jsx";
import { CommandApprovalDialog } from "../src/components/CommandApprovalDialog.jsx";
import { I18nProvider } from "../src/i18n/I18nProvider.jsx";

const pendingRecommendation = {
  command_id: "cmd-014",
  state: "awaiting_approval",
  expires_at: "2030-01-15T10:30:00.000Z",
  projected_soc_percent: 74,
  power_kw: -32,
  constraints: ["Reserve SOC remains above 35%", "Feeder headroom is available"],
  reason: "Simulator proposes a bounded discharge window.",
};

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value() {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value() {
      this.open = false;
      this.dispatchEvent(new Event("close"));
    },
  });
});

test("opens approval dialog only for a pending recommendation", () => {
  render(<DispatchPage recommendations={[pendingRecommendation]} state="ready" />);

  fireEvent.click(screen.getByRole("button", { name: "Approve simulated command" }));

  expect(screen.getByRole("dialog", { name: "Approve simulated command" })).toBeVisible();
});

test("keeps advisory recommendations non-actionable", () => {
  render(
    <DispatchPage
      recommendations={[{ ...pendingRecommendation, state: "proposed" }]}
      state="ready"
    />,
  );

  expect(screen.getByRole("button", { name: "Approve simulated command" })).toBeDisabled();
});

test("localizes the dispatch eyebrow and backend state labels in the default Chinese UI", () => {
  render(<I18nProvider><DispatchPage recommendations={[pendingRecommendation, { ...pendingRecommendation, command_id: "cmd-015", state: "proposed" }]} state="ready" /></I18nProvider>);

  expect(screen.getByText("人工在迴路 · 僅限模擬器")).toBeVisible();
  expect(screen.getByText("等待核准")).toBeVisible();
  expect(screen.getByText("建議中")).toBeVisible();
  expect(screen.queryByText("awaiting_approval")).not.toBeInTheDocument();
  expect(screen.queryByText("proposed")).not.toBeInTheDocument();
});

test("localizes unavailable expiry and simulator-only approval copy", () => {
  const invalidExpiry = { ...pendingRecommendation, expires_at: "not-a-date" };
  const { unmount } = render(<I18nProvider><DispatchPage recommendations={[invalidExpiry]} state="ready" /></I18nProvider>);

  expect(screen.getByText("無法取得")).toBeVisible();
  unmount();

  render(
    <I18nProvider>
      <CommandApprovalDialog
        recommendation={{
          commandId: "cmd-014",
          expiresAt: "not-a-date",
          projectedSoc: 74,
          impactKw: -32,
          constraints: ["Reserve SOC remains above 35%"],
        }}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    </I18nProvider>,
  );

  expect(screen.getByText("僅限模擬器建議")).toBeVisible();
  expect(screen.getByText("無法取得")).toBeVisible();
});

test.each([
  ["a recommendation without a backend command ID", { command_id: "" }],
  ["an expired command", { expires_at: "2000-01-01T00:00:00.000Z" }],
  ["a command without finite projected SOC", { projected_soc_percent: Number.NaN }],
  ["a command without rendered constraints", { constraints: ["", "   "] }],
])("fails closed for %s", (_, change) => {
  render(
    <DispatchPage
      recommendations={[{ ...pendingRecommendation, ...change }]}
      state="ready"
    />,
  );

  expect(screen.getByRole("button", { name: "Approve simulated command" })).toBeDisabled();
  expect(screen.queryByRole("dialog", { name: "Approve simulated command" })).not.toBeInTheDocument();
});

test("updates a decided command so it cannot remain actionable", async () => {
  render(
    <DispatchPage
      recommendations={[pendingRecommendation]}
      state="ready"
      onApprove={vi.fn().mockResolvedValue({ command_id: "cmd-014", state: "approved" })}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Approve simulated command" }));
  fireEvent.change(screen.getByLabelText("Operator reason"), {
    target: { value: "Record the simulator decision." },
  });
  fireEvent.click(within(screen.getByRole("dialog", { name: "Approve simulated command" })).getByRole("button", { name: "Approve simulated command" }));

  await waitFor(() => expect(screen.getByText("Approved")).toBeVisible());
  expect(screen.getByRole("button", { name: "Approve simulated command" })).toBeDisabled();
  expect(screen.queryByRole("dialog", { name: "Approve simulated command" })).not.toBeInTheDocument();
});

test("does not record a decision when the backend action is unavailable", async () => {
  render(<DispatchPage recommendations={[pendingRecommendation]} state="ready" />);

  fireEvent.click(screen.getByRole("button", { name: "Approve simulated command" }));
  fireEvent.change(screen.getByLabelText("Operator reason"), {
    target: { value: "Record the simulator decision." },
  });
  fireEvent.click(within(screen.getByRole("dialog", { name: "Approve simulated command" })).getByRole("button", { name: "Approve simulated command" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(/action is unavailable/i);
  expect(screen.getByText("Awaiting approval")).toBeVisible();
});
