import { en } from "./en";
import { ko } from "./ko";
import type { LanguageCode, Messages } from "./types";

export type { LanguageCode, Messages };

export const DEFAULT_LANGUAGE: LanguageCode = "en";
export const LANGUAGE_STORAGE_KEY = "presence-sensor-language";

export const messages = {
  ko,
  en
} satisfies Record<LanguageCode, Messages>;

export const languageOptions = Object.values(messages).map((message) => message.language);

export function normalizeLanguageCode(value: string | null | undefined): LanguageCode | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized === "ko" || normalized.startsWith("ko-")) return "ko";
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  return null;
}

export function resolveInitialLanguage(
  storedLanguage: string | null | undefined,
  browserLanguage: string | null | undefined
): LanguageCode {
  return normalizeLanguageCode(storedLanguage) ?? normalizeLanguageCode(browserLanguage) ?? DEFAULT_LANGUAGE;
}

