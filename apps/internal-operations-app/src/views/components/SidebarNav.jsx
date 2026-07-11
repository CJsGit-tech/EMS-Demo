import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { navigationGroups } from "../../models/documentModels";

export default function SidebarNav() {
  const { pathname } = useLocation();
  const { t } = useTranslation();

  return (
    <nav className="app-nav" aria-label={t("navigation.primary")}>
      {navigationGroups.map((group) => (
        <div className="nav-group" key={group.labelKey}>
          <p className="nav-group-label">{t(group.labelKey)}</p>
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              aria-current={item.to === "/documents/new" && pathname.startsWith("/documents/") && pathname !== "/documents" ? "page" : undefined}
              className={({ isActive }) => {
                const isGeneratorRoute = item.to === "/documents/new" && pathname.startsWith("/documents/") && pathname !== "/documents";
                return `nav-link ${isActive || isGeneratorRoute ? "is-active" : ""}`;
              }}
            >
              {t(item.labelKey)}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}
