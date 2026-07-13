import { describe, expect, it } from "vitest";
import type { FloorplanStorageDocument } from "../../core/floorplan/floorplan-storage";
import {
  deleteFloorplanStorage,
  FloorplanStorageRequestError,
  loadFloorplanStorageDocument,
  loadFloorplanStorageStatus,
  saveFloorplanObjectsPatch,
  saveFloorplanOcclusionPatch,
  saveFloorplanRadarPatch,
  saveFloorplanRoomNamePatch,
  saveFloorplanStorageDocument
} from "./floorplan-storage-client";

function apiErrorResponse(
  status: number,
  legacyError: string,
  code: string,
  detail: Record<string, unknown> = {},
  statusText = "Error"
): Response {
  return new Response(JSON.stringify({
    ok: false,
    error: legacyError,
    errorInfo: {
      code,
      severity: "error",
      detail
    }
  }), {
    status,
    statusText,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function okResponse(): Response {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function minimalDocument(): FloorplanStorageDocument {
  return {
    version: 1,
    image: {
      path: "/floorplan.webp",
      mime: "image/webp",
      width: 100,
      height: 80
    },
    scale: {
      widthMm: 3000,
      heightMm: 2400,
      outerBoundsPx: [0, 0, 100, 80],
      mmPerPxX: 30,
      mmPerPxY: 30
    },
    radar: {
      originPx: [50, 70],
      rotationDeg: 0,
      scale: 1
    },
    rooms: [],
    occlusion: {
      ignoredEdges: []
    }
  };
}

describe("floorplan storage client errors", () => {
  it("wraps contract-shaped API errors without losing the code", async () => {
    const fetcher: typeof fetch = async () => apiErrorResponse(500, "legacy upload failure", "upload_storage_failed", {
      target: "image",
      where: "commit"
    }, "Internal Server Error");

    await expect(loadFloorplanStorageStatus({ fetcher })).rejects.toMatchObject({
      name: "FloorplanStorageRequestError",
      status: 500,
      errorCode: "upload_storage_failed",
      legacyError: "legacy upload failure"
    } satisfies Partial<FloorplanStorageRequestError>);
  });

  it("preserves not-found details when loading a saved floorplan document fails", async () => {
    const fetcher: typeof fetch = async () => apiErrorResponse(404, "config_not_found", "config_not_found", {
      target: "config"
    }, "Not Found");

    await expect(loadFloorplanStorageDocument({ fetcher })).rejects.toMatchObject({
      status: 404,
      errorCode: "config_not_found",
      legacyError: "config_not_found",
      errorInfo: {
        code: "config_not_found",
        detail: {
          target: "config"
        }
      }
    } satisfies Partial<FloorplanStorageRequestError>);
  });

  it("preserves invalid request details when deleting without a valid confirmation fails", async () => {
    const fetcher: typeof fetch = async () => apiErrorResponse(400, "missing_confirm", "invalid_request", {
      field: "confirm",
      target: "floorplan_delete"
    }, "Bad Request");

    await expect(deleteFloorplanStorage({ fetcher })).rejects.toMatchObject({
      status: 400,
      errorCode: "invalid_request",
      legacyError: "missing_confirm",
      errorInfo: {
        code: "invalid_request",
        detail: {
          field: "confirm",
          target: "floorplan_delete"
        }
      }
    } satisfies Partial<FloorplanStorageRequestError>);
  });

  it("stops floorplan upload when the upload start request fails", async () => {
    const calls: string[] = [];
    const fetcher: typeof fetch = async (input) => {
      const url = String(input);
      calls.push(url);
      return apiErrorResponse(400, "invalid_target", "invalid_request", {
        field: "target",
        target: "floorplan_upload"
      }, "Bad Request");
    };

    await expect(saveFloorplanStorageDocument(minimalDocument(), { fetcher })).rejects.toMatchObject({
      status: 400,
      errorCode: "invalid_request",
      legacyError: "invalid_target"
    } satisfies Partial<FloorplanStorageRequestError>);
    expect(calls).toEqual(["/api/floorplan/upload/start"]);
  });

  it("stops floorplan upload when a chunk write fails", async () => {
    const calls: string[] = [];
    const fetcher: typeof fetch = async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/chunk")) {
        return apiErrorResponse(500, "chunk write failed", "upload_storage_failed", {
          target: "config",
          where: "chunk"
        }, "Internal Server Error");
      }
      return okResponse();
    };

    await expect(saveFloorplanStorageDocument(minimalDocument(), { fetcher })).rejects.toMatchObject({
      status: 500,
      errorCode: "upload_storage_failed",
      legacyError: "chunk write failed",
      errorInfo: {
        code: "upload_storage_failed",
        detail: {
          target: "config",
          where: "chunk"
        }
      }
    } satisfies Partial<FloorplanStorageRequestError>);

    expect(calls).toContain("/api/floorplan/upload/start");
    expect(calls).toContain("/api/floorplan/upload/chunk");
    expect(calls).not.toContain("/api/floorplan/upload/commit");
  });

  it("preserves commit failure details after all chunks were accepted", async () => {
    const calls: string[] = [];
    const fetcher: typeof fetch = async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/commit")) {
        return apiErrorResponse(409, "upload_incomplete", "upload_incomplete", {
          target: "config",
          expected: 512,
          written: 384
        }, "Conflict");
      }
      return okResponse();
    };

    await expect(saveFloorplanStorageDocument(minimalDocument(), { fetcher })).rejects.toMatchObject({
      status: 409,
      errorCode: "upload_incomplete",
      legacyError: "upload_incomplete",
      errorInfo: {
        code: "upload_incomplete",
        detail: {
          target: "config",
          expected: 512,
          written: 384
        }
      }
    } satisfies Partial<FloorplanStorageRequestError>);

    expect(calls).toContain("/api/floorplan/upload/start");
    expect(calls).toContain("/api/floorplan/upload/chunk");
    expect(calls).toContain("/api/floorplan/upload/commit");
  });

  it("wraps plain text upload failures as request errors", async () => {
    const fetcher: typeof fetch = async () => new Response("device is busy", {
      status: 503,
      statusText: "Service Unavailable",
      headers: {
        "Content-Type": "text/plain"
      }
    });

    await expect(saveFloorplanStorageDocument(minimalDocument(), { fetcher })).rejects.toMatchObject({
      status: 503,
      statusText: "Service Unavailable",
      errorCode: undefined,
      legacyError: "device is busy"
    } satisfies Partial<FloorplanStorageRequestError>);
  });

  it("wraps malformed JSON upload failures without throwing a parser error", async () => {
    const fetcher: typeof fetch = async () => new Response("{not json", {
      status: 500,
      statusText: "Internal Server Error",
      headers: {
        "Content-Type": "application/json"
      }
    });

    await expect(saveFloorplanStorageDocument(minimalDocument(), { fetcher })).rejects.toMatchObject({
      status: 500,
      statusText: "Internal Server Error",
      errorCode: undefined,
      legacyError: "{not json"
    } satisfies Partial<FloorplanStorageRequestError>);
  });

  it("posts radar patches without using chunk upload endpoints", async () => {
    const calls: Array<{ url: string; body: string }> = [];
    const fetcher: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), body: String(init?.body ?? "") });
      return okResponse();
    };

    await saveFloorplanRadarPatch({ originPx: [10, 20], rotationDeg: 33.4, scale: 1 }, { fetcher });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/api/floorplan/radar");
    expect(calls[0].body).toContain("data=");
  });

  it("posts room-name patches with only the changed room metadata", async () => {
    const calls: Array<{ url: string; body: string }> = [];
    const fetcher: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), body: String(init?.body ?? "") });
      return okResponse();
    };

    await saveFloorplanRoomNamePatch("room_1", "Living", { fetcher });

    expect(calls).toEqual([{
      url: "/api/floorplan/room-name",
      body: "id=room_1&name=Living"
    }]);
  });

  it("posts occlusion patches without uploading the full floorplan document", async () => {
    const calls: Array<{ url: string; body: string }> = [];
    const fetcher: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), body: String(init?.body ?? "") });
      return okResponse();
    };

    await saveFloorplanOcclusionPatch({ ignoredEdges: ["wall:0,0-10,0"] }, { fetcher });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/api/floorplan/occlusion");
    expect(calls[0].body).toContain("ignoredEdges");
  });

  it("posts furniture object patches without uploading the full floorplan document", async () => {
    const calls: Array<{ url: string; body: string }> = [];
    const fetcher: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), body: String(init?.body ?? "") });
      return okResponse();
    };

    await saveFloorplanObjectsPatch([{
      id: "object_1",
      asset: "desk",
      roomId: "room_1",
      xPx: 10,
      yPx: 20,
      widthPx: 30,
      heightPx: 40,
      rotationDeg: 0
    }], { fetcher });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/api/floorplan/objects");
    expect(calls[0].body).toContain("object_1");
  });
});
