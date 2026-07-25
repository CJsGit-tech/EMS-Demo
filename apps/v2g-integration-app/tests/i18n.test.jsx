import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import App from "../src/App.jsx";

beforeEach(() => {
  window.localStorage.clear();
});

test("starts in Traditional Chinese and persists an explicit English choice", async () => {
  render(<App />);

  expect(await screen.findByRole("heading", { name: "電站總覽" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "English" }));
  expect(screen.getByRole("heading", { name: "Site overview" })).toBeVisible();
  expect(window.localStorage.getItem("v2g-scada-locale")).toBe("en");
});
