import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { DispatchPage } from "../src/features/dispatch/DispatchPage.jsx";

const pendingRecommendation = {
  id: "cmd-014",
  status: "awaiting_approval",
  expiresAt: "2030-01-15T10:30:00.000Z",
  projectedSoc: 74,
  impactKw: -32,
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
      recommendations={[{ ...pendingRecommendation, status: "proposed" }]}
      state="ready"
    />,
  );

  expect(screen.getByRole("button", { name: "Approve simulated command" })).toBeDisabled();
});
