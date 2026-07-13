import { describe, expect, it } from "vitest";
import { bytesToHex, uploadChunkedFormPayload, UPLOAD_CHUNK_BYTES } from "./chunked-form-upload";

describe("uploadChunkedFormPayload", () => {
  it("uploads bytes through start, chunk, and commit requests", async () => {
    const calls: Array<{ path: string; values: Record<string, string> }> = [];
    const bytes = new Uint8Array(UPLOAD_CHUNK_BYTES * 2 + 1);
    bytes.fill(0xab);

    await uploadChunkedFormPayload({
      paths: {
        start: "/start",
        chunk: "/chunk",
        commit: "/commit"
      },
      bytes,
      fields: { target: "config" },
      postForm: async (path, values) => {
        calls.push({ path, values });
      }
    });

    expect(calls.map((call) => call.path)).toEqual(["/start", "/chunk", "/chunk", "/chunk", "/commit"]);
    expect(calls[0].values).toMatchObject({
      target: "config",
      size: String(bytes.byteLength)
    });
    expect(calls[0].values.session).toBeTruthy();

    const session = calls[0].values.session;
    expect(calls[1].values).toMatchObject({
      session,
      target: "config",
      offset: "0",
      data: bytesToHex(bytes.subarray(0, UPLOAD_CHUNK_BYTES))
    });
    expect(calls[2].values).toMatchObject({
      session,
      target: "config",
      offset: String(UPLOAD_CHUNK_BYTES),
      data: bytesToHex(bytes.subarray(UPLOAD_CHUNK_BYTES, UPLOAD_CHUNK_BYTES * 2))
    });
    expect(calls[3].values).toMatchObject({
      session,
      target: "config",
      offset: String(UPLOAD_CHUNK_BYTES * 2),
      data: bytesToHex(bytes.subarray(UPLOAD_CHUNK_BYTES * 2))
    });
    expect(calls[4].values).toEqual({
      session,
      target: "config"
    });
  });

  it("reports upload progress from zero to complete", async () => {
    const progress: Array<{ loaded: number; total: number; percent: number }> = [];
    const bytes = new Uint8Array(UPLOAD_CHUNK_BYTES + 1);

    await uploadChunkedFormPayload({
      paths: {
        start: "/start",
        chunk: "/chunk",
        commit: "/commit"
      },
      bytes,
      postForm: async () => {},
      onProgress: (nextProgress) => progress.push(nextProgress)
    });

    expect(progress[0]).toEqual({ loaded: 0, total: bytes.byteLength, percent: 0 });
    expect(progress[progress.length - 1]).toEqual({ loaded: bytes.byteLength, total: bytes.byteLength, percent: 100 });
    expect(progress.some((entry) => entry.percent > 0 && entry.percent < 100)).toBe(true);
  });

  it("does not commit when a chunk request fails", async () => {
    const calls: string[] = [];
    const failure = new Error("chunk failed");

    await expect(uploadChunkedFormPayload({
      paths: {
        start: "/start",
        chunk: "/chunk",
        commit: "/commit"
      },
      bytes: new Uint8Array(UPLOAD_CHUNK_BYTES + 1),
      postForm: async (path) => {
        calls.push(path);
        if (path === "/chunk") throw failure;
      }
    })).rejects.toBe(failure);

    expect(calls).toEqual(["/start", "/chunk"]);
  });
});
