export const supportedLanguages = ["en", "zh-TW"];
export const defaultLanguage = "en";
export const languageStorageKey = "ems-language";

export function getStoredLanguage(storage = typeof window !== "undefined" ? window.localStorage : null) {
  try {
    const stored = storage?.getItem(languageStorageKey);
    return supportedLanguages.includes(stored) ? stored : defaultLanguage;
  } catch {
    return defaultLanguage;
  }
}

export function getDocumentLanguage(language) {
  return language === "zh-TW" ? "zh-Hant-TW" : "en";
}
