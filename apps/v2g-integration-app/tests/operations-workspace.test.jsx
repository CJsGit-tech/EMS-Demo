import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { WorkOrdersPage } from "../src/features/operations/WorkOrdersPage.jsx";
import { I18nProvider } from "../src/i18n/I18nProvider.jsx";

const fixture = {
  simulated: true,
  work_orders: [{
    work_order_id: "wo-001",
    asset_id: "inv-01",
    source_alarm_code: "dc_imbalance",
    state: "open",
    severity: "warning",
    assigned_team: "維運一組",
    summary: "確認直流側不平衡",
    created_at: "2030-01-15T10:00:00.000Z",
  }],
};

function renderPage(props = {}) {
  return render(<I18nProvider><WorkOrdersPage data={fixture} state="ready" {...props} /></I18nProvider>);
}

test("requires a reason before a simulated work order transition", async () => {
  const user = userEvent.setup();
  renderPage({ onTransition: vi.fn() });

  await user.click(screen.getByRole("button", { name: "開始處理" }));

  expect(screen.getByText("請填寫處理原因")).toBeVisible();
});

test("updates only the transitioned local work order with actor and reason", async () => {
  const user = userEvent.setup();
  const onTransition = vi.fn().mockResolvedValue({ ...fixture.work_orders[0], state: "in_progress" });
  renderPage({ onTransition });

  await user.type(screen.getByLabelText("處理人"), "operator-17");
  await user.type(screen.getByLabelText("處理原因"), "現場確認後開始檢修");
  await user.click(screen.getByRole("button", { name: "開始處理" }));

  expect(onTransition).toHaveBeenCalledWith("wo-001", {
    state: "in_progress",
    actor: "operator-17",
    reason: "現場確認後開始檢修",
  });
  expect(await screen.findByText("處理中")).toBeVisible();
  expect(screen.queryByRole("button", { name: /核准|遙控|控制/ })).not.toBeInTheDocument();
});
