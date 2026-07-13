import { describe, expect, it } from "vitest";
import { formatBytes, formatCompactBytes } from "./formatters";

describe("formatBytes", () => {
  it("formats compact ESP32 storage byte values", () => {
    expect(formatCompactBytes(undefined)).toBe("-");
    expect(formatCompactBytes(-100)).toBe("0B");
    expect(formatCompactBytes(512)).toBe("512B");
    expect(formatCompactBytes(1536)).toBe("2KB");
    expect(formatCompactBytes(1024 * 1024)).toBe("1.0MB");
  });

  it("formats spaced floorplan image sizes while preserving the old minimum KB display", () => {
    expect(formatBytes(Number.NaN, {
      unitSeparator: " ",
      minUnit: "KB",
      mbPrecision: 2
    })).toBe("-");
    expect(formatBytes(512, {
      unitSeparator: " ",
      minUnit: "KB",
      mbPrecision: 2
    })).toBe("1 KB");
    expect(formatBytes(1024 * 1024, {
      unitSeparator: " ",
      minUnit: "KB",
      mbPrecision: 2
    })).toBe("1.00 MB");
  });

  it("formats file-size style values with explicit zero text and decimal KB", () => {
    expect(formatBytes(undefined, {
      invalidText: "0 B",
      nonPositiveText: "0 B",
      unitSeparator: " ",
      kbPrecision: 1,
      mbPrecision: 1
    })).toBe("0 B");
    expect(formatBytes(0, {
      invalidText: "0 B",
      nonPositiveText: "0 B",
      unitSeparator: " ",
      kbPrecision: 1,
      mbPrecision: 1
    })).toBe("0 B");
    expect(formatBytes(512, {
      invalidText: "0 B",
      nonPositiveText: "0 B",
      unitSeparator: " ",
      kbPrecision: 1,
      mbPrecision: 1
    })).toBe("512 B");
    expect(formatBytes(1536, {
      invalidText: "0 B",
      nonPositiveText: "0 B",
      unitSeparator: " ",
      kbPrecision: 1,
      mbPrecision: 1
    })).toBe("1.5 KB");
  });
});
