import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getDocumentLanguage, languageStorageKey } from "../../i18nConfig";

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  useEffect(() => {
    document.documentElement.lang = getDocumentLanguage(i18n.resolvedLanguage || i18n.language);
  }, [i18n.language]);

  function handleChange(event) {
    const language = event.target.value;
    i18n.changeLanguage(language);
    try {
      window.localStorage.setItem(languageStorageKey, language);
    } catch {
      // The current language remains active for this session.
    }
  }

  return (
    <label className="language-switcher">
      <span className="sr-only">{t("language.label")}</span>
      <select value={i18n.language === "zh-TW" ? "zh-TW" : "en"} aria-label={t("language.label")} onChange={handleChange}>
        <option value="en">{t("language.english")}</option>
        <option value="zh-TW">{t("language.traditionalChinese")}</option>
      </select>
    </label>
  );
}
