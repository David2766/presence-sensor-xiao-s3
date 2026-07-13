import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadBlob } from "./download";

describe("downloadBlob", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("downloads a blob through a temporary object URL", () => {
    const click = vi.fn();
    const remove = vi.fn();
    const link = {
      href: "",
      download: "",
      click,
      remove
    };
    const append = vi.fn();
    const createObjectURL = vi.fn(() => "blob:download");
    const revokeObjectURL = vi.fn();

    vi.stubGlobal("document", {
      createElement: vi.fn(() => link),
      body: {
        append,
        appendChild: append
      }
    });
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL
    });

    const blob = new Blob(["hello"], { type: "text/plain" });
    const filename = downloadBlob(blob, "hello.txt");

    expect(filename).toBe("hello.txt");
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(link.href).toBe("blob:download");
    expect(link.download).toBe("hello.txt");
    expect(append).toHaveBeenCalledWith(link);
    expect(click).toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:download");
  });
});
