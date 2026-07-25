import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CommandApprovalDialog } from "../src/components/CommandApprovalDialog.jsx";
import { MetricStrip } from "../src/components/MetricStrip.jsx";
import { TimeSeriesChart } from "../src/components/TimeSeriesChart.jsx";

const dialogMethodDescriptors = {
  close: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close"),
  showModal: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal"),
};

const recommendation = {
  id: "rec-014",
  expiresAt: "2030-01-15T10:30:00.000Z",
  projectedSoc: 74,
  impactKw: -32,
  constraints: ["Reserve SOC remains above 35%", "Feeder headroom is available"],
};

beforeEach(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    close: {
      configurable: true,
      value: vi.fn(function close() {
        this.open = false;
        this.dispatchEvent(new Event("close"));
      }),
      writable: true,
    },
    showModal: {
      configurable: true,
      value: vi.fn(function showModal() {
        this.open = true;
      }),
      writable: true,
    },
  });
});

afterEach(() => {
  cleanup();

  for (const [method, descriptor] of Object.entries(dialogMethodDescriptors)) {
    if (descriptor) {
      Object.defineProperty(HTMLDialogElement.prototype, method, descriptor);
    } else {
      delete HTMLDialogElement.prototype[method];
    }
  }
});

test("renders simulator metrics with their supplied status", () => {
  render(
    <MetricStrip
      metrics={[
        {
          label: "Fleet availability",
          value: "18 / 24",
          detail: "Six simulated chargers unavailable",
          status: "warning",
        },
      ]}
    />,
  );

  expect(screen.getByText("Fleet availability")).toBeVisible();
  expect(screen.getByText("18 / 24")).toBeVisible();
  expect(screen.getByText("Status: warning")).toBeVisible();
});

test("renders a text alternative and supplied stale data quality for a chart", () => {
  render(
    <TimeSeriesChart
      title="Simulated fleet power"
      unit="kW"
      quality="stale"
      points={[
        { at: "10:00", value: -24 },
        { at: "10:05", value: -12 },
        { at: "10:10", value: 8 },
      ]}
    />,
  );

  expect(screen.getByText("Data quality: stale")).toBeVisible();
  expect(screen.getByRole("img", { name: /simulated fleet power/i })).toBeVisible();
  expect(screen.getByText(/three samples/i)).toBeVisible();
});

test("keeps simulated command actions disabled until an operator reason is supplied", () => {
  render(
    <CommandApprovalDialog
      recommendation={recommendation}
      onApprove={vi.fn()}
      onReject={vi.fn()}
    />,
  );

  expect(screen.getByRole("button", { name: "Approve simulated command" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Reject simulated command" })).toBeDisabled();
});

test("opens the native dialog modally and restores focus after cancellation", () => {
  const launcher = document.createElement("button");
  launcher.textContent = "Review command";
  document.body.append(launcher);
  launcher.focus();

  const { unmount } = render(
    <CommandApprovalDialog
      recommendation={recommendation}
      onApprove={vi.fn()}
      onReject={vi.fn()}
    />,
  );

  const dialog = screen.getByRole("dialog");
  expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce();

  fireEvent(dialog, new Event("cancel", { cancelable: true }));

  expect(HTMLDialogElement.prototype.close).toHaveBeenCalledOnce();
  expect(launcher).toHaveFocus();

  unmount();
  launcher.remove();
});

test.each([
  ["missing", undefined],
  ["invalid", "not-a-date"],
  ["expired", "2000-01-01T00:00:00.000Z"],
])("keeps actions disabled for a %s recommendation expiry", (_, expiresAt) => {
  render(
    <CommandApprovalDialog
      recommendation={{ ...recommendation, expiresAt }}
      onApprove={vi.fn()}
      onReject={vi.fn()}
    />,
  );

  fireEvent.change(screen.getByLabelText("Operator reason"), {
    target: { value: "Record the simulated dispatch decision." },
  });

  expect(screen.getByRole("button", { name: "Approve simulated command" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Reject simulated command" })).toBeDisabled();
});

test("approves a non-expired simulated command with its operator reason", () => {
  const onApprove = vi.fn();

  render(
    <CommandApprovalDialog
      recommendation={recommendation}
      onApprove={onApprove}
      onReject={vi.fn()}
    />,
  );

  fireEvent.change(screen.getByLabelText("Operator reason"), {
    target: { value: "Hold feeder draw below the simulated limit." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Approve simulated command" }));

  expect(onApprove).toHaveBeenCalledWith(
    recommendation.id,
    "Hold feeder draw below the simulated limit.",
  );
});

test("rejects a non-expired simulated command with its operator reason", () => {
  const onReject = vi.fn();

  render(
    <CommandApprovalDialog
      recommendation={recommendation}
      onApprove={vi.fn()}
      onReject={onReject}
    />,
  );

  fireEvent.change(screen.getByLabelText("Operator reason"), {
    target: { value: "Keep the simulator in its current charging window." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Reject simulated command" }));

  expect(onReject).toHaveBeenCalledWith(
    recommendation.id,
    "Keep the simulator in its current charging window.",
  );
});
