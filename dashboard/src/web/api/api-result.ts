export type ApiSeverity = "info" | "warning" | "error" | string;

export interface ApiInfo {
  code: string;
  severity?: ApiSeverity;
  detail?: unknown;
}

export interface ParsedApiError {
  status: number;
  statusText: string;
  fallbackMessage: string;
  message: string;
  code?: string;
  errorInfo?: ApiInfo;
  legacyError?: string;
  legacyMessage?: string;
  rawText?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeApiInfo(value: unknown): ApiInfo | undefined {
  if (!isRecord(value) || typeof value.code !== "string" || !value.code) return undefined;
  return {
    code: value.code,
    severity: typeof value.severity === "string" ? value.severity : undefined,
    detail: value.detail
  };
}

function fallbackMessage(response: Response): string {
  return [String(response.status), response.statusText].filter(Boolean).join(" ");
}

export async function parseApiErrorResponse(response: Response): Promise<ParsedApiError> {
  const fallback = fallbackMessage(response);
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const body = await response.clone().json() as unknown;
      if (isRecord(body)) {
        const legacyError = typeof body.error === "string" ? body.error : undefined;
        const legacyMessage = typeof body.message === "string" ? body.message : undefined;
        const objectError = normalizeApiInfo(body.error);
        const errorInfo = normalizeApiInfo(body.errorInfo) ?? objectError;
        const code = errorInfo?.code ?? legacyError ?? legacyMessage;
        const display = legacyError ?? legacyMessage ?? errorInfo?.code;
        return {
          status: response.status,
          statusText: response.statusText,
          fallbackMessage: fallback,
          message: [fallback, display].filter(Boolean).join(" "),
          code,
          errorInfo,
          legacyError,
          legacyMessage
        };
      }
    } catch {
      // Fall through to the text fallback below.
    }
  }

  try {
    const rawText = await response.text();
    return {
      status: response.status,
      statusText: response.statusText,
      fallbackMessage: fallback,
      message: rawText ? `${fallback} ${rawText}` : fallback,
      rawText
    };
  } catch {
    return {
      status: response.status,
      statusText: response.statusText,
      fallbackMessage: fallback,
      message: fallback
    };
  }
}
