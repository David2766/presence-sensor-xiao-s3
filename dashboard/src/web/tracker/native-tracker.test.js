import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const testScript = fileURLToPath(new URL("../../../../tools/presence-replay/native/test.py", import.meta.url));

describe("native PresenceTracker", () => {
  it("passes C++ room-exit lifecycle tests", () => {
    const result = spawnSync("python", [testScript], {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 120_000
    });

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("tracker_tests: ok");
  }, 120_000);
});
