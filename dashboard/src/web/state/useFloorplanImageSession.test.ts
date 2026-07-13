import { afterEach, describe, expect, it, vi } from "vitest";
import { createFloorplanImageSession } from "./useFloorplanImageSession.svelte";

const text = {
  unsupportedImageType: "unsupported",
  imageTooLarge: "too large",
  imageTooSmall: "too small",
  webpTooLarge: "webp too large",
  canvasUnavailable: "canvas failed",
  webpFailed: "webp failed",
  canUseEsp32Candidate: "ready",
  selectImageStatus: "select image"
};

function installCanvasMocks({ width = 1000, height = 600, outputSize = 1024 } = {}) {
  const close = vi.fn();
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width, height, close })));
  vi.stubGlobal("document", {
    createElement: vi.fn((tagName: string) => {
    if (tagName !== "canvas") return {} as HTMLElement;
    return {
      width: 0,
      height: 0,
      getContext: () => ({
        fillStyle: "",
        fillRect: vi.fn(),
        drawImage: vi.fn()
      }),
      toBlob: (callback: (blob: Blob | null) => void) => {
        callback(new Blob([new Uint8Array(outputSize)], { type: "image/webp" }));
      }
    } as unknown as HTMLCanvasElement;
    })
  });
  return { close };
}

function fileFixture(type = "image/png", name = "floorplan.png", content = "image") {
  return Object.assign(new Blob([content], { type }), { name });
}

function eventFixture(file: Blob & { name: string }) {
  return {
    currentTarget: {
      files: [file],
      value: "selected"
    }
  } as unknown as Event;
}

describe("floorplan image session", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("prepares a valid image and owns the generated object URL", async () => {
    installCanvasMocks();
    const createObjectURL = vi.fn(() => "blob:floorplan");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const loaded = vi.fn();
    const session = createFloorplanImageSession({
      getText: () => text,
      formatError: (error) => error instanceof Error ? error.message : String(error),
      onLoaded: loaded
    });

    await session.handleFileChange(eventFixture(fileFixture()));

    expect(session.imageUrl).toBe("blob:floorplan");
    expect(session.imageName).toBe("floorplan.png");
    expect(session.imageBlob?.type).toBe("image/webp");
    expect(session.originalImageBlob?.type).toBe("image/png");
    expect(session.debugInfo?.width).toBe(1000);
    expect(session.debugInfo?.height).toBe(600);
    expect(session.statusTone).toBe("ok");
    expect(session.statusText).toBe("ready");
    expect(loaded).toHaveBeenCalledOnce();

    session.clear();

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:floorplan");
    expect(session.imageUrl).toBe("");
    expect(session.statusText).toBe("select image");
  });

  it("reports validation errors without trying to decode unsupported files", async () => {
    const createImageBitmap = vi.fn();
    vi.stubGlobal("createImageBitmap", createImageBitmap);
    const session = createFloorplanImageSession({
      getText: () => text,
      formatError: (error) => error instanceof Error ? error.message : String(error)
    });

    await session.handleFileChange(eventFixture(fileFixture("text/plain", "notes.txt")));

    expect(createImageBitmap).not.toHaveBeenCalled();
    expect(session.statusTone).toBe("error");
    expect(session.statusText).toBe("unsupported");
    expect(session.debugInfo).toBeNull();
  });
});
