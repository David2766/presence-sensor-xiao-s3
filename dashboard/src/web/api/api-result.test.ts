import { describe, expect, it } from "vitest";
import { parseApiErrorResponse } from "./api-result";

function jsonResponse(body: unknown, status = 400, statusText = "Bad Request"): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

describe("parseApiErrorResponse", () => {
  it("keeps contract errorInfo as the primary error code", async () => {
    const parsed = await parseApiErrorResponse(jsonResponse({
      ok: false,
      error: "legacy upload error",
      errorInfo: {
        code: "upload_session_mismatch",
        severity: "error",
        detail: {
          expected: "abc",
          received: "def"
        }
      }
    }, 409, "Conflict"));

    expect(parsed.status).toBe(409);
    expect(parsed.code).toBe("upload_session_mismatch");
    expect(parsed.errorInfo?.code).toBe("upload_session_mismatch");
    expect(parsed.errorInfo?.severity).toBe("error");
    expect(parsed.legacyError).toBe("legacy upload error");
  });

  it("accepts the canonical contract error object shape", async () => {
    const parsed = await parseApiErrorResponse(jsonResponse({
      ok: false,
      error: {
        code: "invalid_request",
        severity: "error",
        detail: {
          field: "data",
          target: "image"
        }
      }
    }));

    expect(parsed.code).toBe("invalid_request");
    expect(parsed.errorInfo?.code).toBe("invalid_request");
    expect(parsed.errorInfo?.detail).toEqual({
      field: "data",
      target: "image"
    });
    expect(parsed.legacyError).toBeUndefined();
  });

  it("supports legacy string error responses", async () => {
    const parsed = await parseApiErrorResponse(jsonResponse({
      ok: false,
      error: "missing_data"
    }));

    expect(parsed.code).toBe("missing_data");
    expect(parsed.legacyError).toBe("missing_data");
    expect(parsed.message).toContain("missing_data");
  });

  it("supports legacy message-only responses", async () => {
    const parsed = await parseApiErrorResponse(jsonResponse({
      ok: false,
      message: "config not found"
    }, 404, "Not Found"));

    expect(parsed.code).toBe("config not found");
    expect(parsed.legacyMessage).toBe("config not found");
    expect(parsed.message).toContain("404");
  });

  it("falls back to text for non-json responses", async () => {
    const parsed = await parseApiErrorResponse(new Response("plain failure", {
      status: 500,
      statusText: "Internal Server Error",
      headers: {
        "Content-Type": "text/plain"
      }
    }));

    expect(parsed.code).toBeUndefined();
    expect(parsed.rawText).toBe("plain failure");
    expect(parsed.message).toContain("plain failure");
  });

  it("falls back safely when a json response body is malformed", async () => {
    const parsed = await parseApiErrorResponse(new Response("{not json", {
      status: 500,
      statusText: "Internal Server Error",
      headers: {
        "Content-Type": "application/json"
      }
    }));

    expect(parsed.rawText).toBe("{not json");
    expect(parsed.message).toContain("{not json");
  });
});
