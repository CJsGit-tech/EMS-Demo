import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";

import { OperationsPage } from "../src/features/operations/OperationsPage.jsx";

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
  expect(screen.getAllByText("Data freshness: good")).toHaveLength(2);
  expect(screen.getByText(/simulator connected/i)).toBeVisible();
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
  expect(screen.getAllByText("Data freshness: stale")).toHaveLength(2);
});
