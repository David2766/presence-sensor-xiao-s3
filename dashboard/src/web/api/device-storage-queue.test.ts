import { describe, expect, it } from "vitest";
import { DeviceStorageQueue } from "./device-storage-queue";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("DeviceStorageQueue", () => {
  it("runs storage writes one at a time", async () => {
    const queue = new DeviceStorageQueue();
    const first = deferred<void>();
    const events: string[] = [];

    const firstRun = queue.run("floorplan", async () => {
      events.push("floorplan:start");
      await first.promise;
      events.push("floorplan:end");
    });
    const secondRun = queue.run("config", async () => {
      events.push("config:start");
    });

    await Promise.resolve();
    expect(events).toEqual(["floorplan:start"]);

    first.resolve();
    await firstRun;
    await secondRun;

    expect(events).toEqual(["floorplan:start", "floorplan:end", "config:start"]);
  });

  it("continues with queued writes after a failed write", async () => {
    const queue = new DeviceStorageQueue();
    const events: string[] = [];

    const failedRun = queue.run("stats", async () => {
      events.push("stats:start");
      throw new Error("write failed");
    });
    const nextRun = queue.run("config", async () => {
      events.push("config:start");
      return "saved";
    });

    await expect(failedRun).rejects.toThrow("write failed");
    await expect(nextRun).resolves.toBe("saved");
    expect(events).toEqual(["stats:start", "config:start"]);
  });

  it("preserves request order across different storage kinds", async () => {
    const queue = new DeviceStorageQueue();
    const events: string[] = [];

    const runs = [
      queue.run("config", async () => events.push("config")),
      queue.run("floorplan", async () => events.push("floorplan")),
      queue.run("stats", async () => events.push("stats"))
    ];

    await Promise.all(runs);
    expect(events).toEqual(["config", "floorplan", "stats"]);
  });

  it("publishes active and queued storage state", async () => {
    const queue = new DeviceStorageQueue();
    const first = deferred<void>();
    const snapshots: Array<{ active: string | null; queued: number }> = [];

    queue.subscribe((snapshot) => {
      snapshots.push(snapshot);
    });

    const firstRun = queue.run("floorplan", async () => {
      await first.promise;
    });
    const secondRun = queue.run("config", async () => undefined);

    await Promise.resolve();
    expect(queue.snapshot()).toEqual({ active: "floorplan", queued: 1, isBusy: true });

    first.resolve();
    await firstRun;
    await secondRun;

    expect(queue.snapshot()).toEqual({ active: null, queued: 0, isBusy: false });
    expect(snapshots).toContainEqual({ active: null, queued: 0, isBusy: false });
    expect(snapshots).toContainEqual({ active: "floorplan", queued: 1, isBusy: true });
    expect(snapshots).toContainEqual({ active: "config", queued: 0, isBusy: true });
  });

  it("stops publishing to unsubscribed listeners", async () => {
    const queue = new DeviceStorageQueue();
    const snapshots: Array<{ active: string | null; queued: number; isBusy: boolean }> = [];
    const unsubscribe = queue.subscribe((snapshot) => snapshots.push(snapshot));

    unsubscribe();
    await queue.run("config", async () => undefined);

    expect(snapshots).toEqual([{ active: null, queued: 0, isBusy: false }]);
  });
});
