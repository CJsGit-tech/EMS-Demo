import { useI18n } from "../i18n/I18nProvider.jsx";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return <div role="group" aria-label={t("language.label")} className="language-switcher">
    <button type="button" aria-pressed={locale === "zh-TW"} onClick={() => setLocale("zh-TW")}>{t("language.zhTw")}</button>
    <button type="button" aria-pressed={locale === "en"} onClick={() => setLocale("en")}>{t("language.en")}</button>
  </div>;
}
