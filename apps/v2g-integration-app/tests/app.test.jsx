import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import App from "../src/App.jsx";

test("renders the V2G SCADA shell", () => {
  render(<App />);

  expect(screen.getByRole("main", { name: "V2G SCADA" })).toBeInTheDocument();
});
