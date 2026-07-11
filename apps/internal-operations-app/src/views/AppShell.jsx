import { Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./components/LanguageSwitcher";
import SidebarNav from "./components/SidebarNav";
import ThemeToggle from "./components/ThemeToggle";

const pageNames = {
  "/overview": "navigation.items.overview",
  "/documents/new": "navigation.items.newDocument",
  "/documents": "navigation.items.library",
  "/runs": "navigation.items.runs",
  "/context": "navigation.items.context",
};

function getPageName(pathname, t) {
  if (pathname.startsWith("/documents/") && pathname !== "/documents/new") return t("common.newDocument");
  return t(pageNames[pathname] || "app.name");
}

export default function AppShell() {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const pageName = getPageName(pathname, t);

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark" aria-hidden="true">EMS</span>
          <div>
            <strong>{t("app.name")}</strong>
            <span>{t("app.subtitle")}</span>
          </div>
        </div>
        <SidebarNav />
        <div className="sidebar-footer">
          <span className="status-rule" aria-hidden="true" />
          <span>{t("app.browserOnly")}</span>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <span className="topbar-context">{t("app.operations")} / {pageName}</span>
          <div className="topbar-actions">
            <LanguageSwitcher />
            <ThemeToggle />
            <span className="topbar-state">{t("app.localPrototype")}</span>
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  );
}
