import {
  LANGUAGE_STORAGE_KEY,
  messages,
  resolveInitialLanguage,
  type LanguageCode
} from "./index";

function storedLanguage(): string | null {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function browserLanguage(): string | null {
  return typeof navigator === "undefined" ? null : navigator.language;
}

function saveLanguage(language: LanguageCode): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Ignore storage failures; language selection still works for the current session.
  }
}

export function createI18n() {
  let language = $state<LanguageCode>(resolveInitialLanguage(storedLanguage(), browserLanguage()));
  const msg = $derived(messages[language]);

  function setLanguage(nextLanguage: LanguageCode): void {
    language = nextLanguage;
    saveLanguage(nextLanguage);
  }

  return {
    get language() {
      return language;
    },
    get msg() {
      return msg;
    },
    setLanguage
  };
}

