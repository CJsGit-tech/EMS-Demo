import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const nextLabel = theme === "dark" ? t("theme.switchToLight") : t("theme.switchToDark");

  return (
    <button type="button" className="theme-toggle" aria-label={nextLabel} aria-pressed={theme === "dark"} title={nextLabel} onClick={toggleTheme}>
      {theme === "dark" ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
      <span>{theme === "dark" ? t("theme.dark") : t("theme.light")}</span>
    </button>
  );
}
