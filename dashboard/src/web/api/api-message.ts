import type { Messages } from "../i18n/types";

interface ApiErrorLike {
  code?: unknown;
  errorCode?: unknown;
  errorInfo?: {
    code?: unknown;
  };
  legacyError?: unknown;
  legacyMessage?: unknown;
  message?: unknown;
}

function isRecord(value: unknown): value is ApiErrorLike {
  return typeof value === "object" && value !== null;
}

export function apiErrorCode(error: unknown): string {
  if (!isRecord(error)) return "";
  const candidates = [
    error.errorInfo?.code,
    error.code,
    error.errorCode,
    error.legacyError,
    error.legacyMessage
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate) return candidate;
  }
  return "";
}

export function fallbackErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error);
}

export function apiErrorMessage(messages: Messages, error: unknown, fallback = ""): string {
  const code = apiErrorCode(error);
  if (code) {
    const translated = messages.api.errors[code];
    if (translated) return translated;
  }
  const message = fallbackErrorMessage(error);
  return fallback ? [fallback, message].filter(Boolean).join(" ") : message;
}

export function apiStatusMessage(messages: Messages, code: string, fallback = ""): string {
  if (!code) return fallback;
  return messages.api.statuses[code] ?? fallback;
}
