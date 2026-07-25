import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import App from "../src/App.jsx";
import { I18nProvider, useI18n } from "../src/i18n/I18nProvider.jsx";

beforeEach(() => {
  window.localStorage.clear();
});

test("starts in Traditional Chinese and persists an explicit English choice", async () => {
  const user = userEvent.setup();
  render(<App />);

  expect(await screen.findByRole("heading", { name: "電站總覽" })).toBeVisible();
  expect(screen.getByRole("group", { name: "語言" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "English" }));
  expect(screen.getByRole("heading", { name: "Site overview" })).toBeVisible();
  expect(window.localStorage.getItem("v2g-scada-locale")).toBe("en");
});

test("uses a persisted English locale", async () => {
  window.localStorage.setItem("v2g-scada-locale", "en");

  render(<App />);

  expect(await screen.findByRole("heading", { name: "Site overview" })).toBeVisible();
});

test("falls back to Traditional Chinese for an invalid stored locale", async () => {
  window.localStorage.setItem("v2g-scada-locale", "fr-FR");

  render(<App />);

  expect(await screen.findByRole("heading", { name: "電站總覽" })).toBeVisible();
});

function TranslationProbe() {
  const { t } = useI18n();
  return <p>{`${t("header.eyebrow", { site: "site-01" })}|${t("missing.key")}`}</p>;
}

test("interpolates known tokens and returns missing keys", () => {
  render(<I18nProvider><TranslationProbe /></I18nProvider>);

  expect(screen.getByText("V2G 監督系統 · site-01|missing.key")).toBeVisible();
});
