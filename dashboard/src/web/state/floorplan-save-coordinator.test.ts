import { describe, expect, it } from "vitest";
import type { FloorplanStorageDocument } from "../../core/floorplan/floorplan-storage";
import type { WebDeviceConfig } from "../types";
import { saveStoredFloorplanWithConfig } from "./floorplan-save-coordinator";

function documentFixture(): FloorplanStorageDocument {
  return {
    version: 1,
    image: {
      path: "/floorplan.webp",
      mime: "image/webp",
      width: 200,
      height: 120
    },
    scale: {
      widthMm: 2000,
      heightMm: 1200,
      outerBoundsPx: [0, 0, 200, 120],
      mmPerPxX: 10,
      mmPerPxY: 10
    },
    radar: {
      originPx: [50, 100],
      rotationDeg: 0,
      scale: 1
    },
    rooms: [
      {
        id: "room_1",
        name: "Bedroom",
        kind: "room",
        pointsPx: [[0, 0], [100, 0], [100, 120], [0, 120]],
        widthMm: 1000,
        heightMm: 1200,
        manualSize: false
      }
    ],
    occlusion: {
      ignoredEdges: []
    },
    objects: []
  };
}

describe("floorplan save coordinator", () => {
  it("saves the document before updating and saving config", async () => {
    const calls: string[] = [];
    let config: WebDeviceConfig = {
      version: 1,
      zones: [],
      calibrationZones: [],
      floorplan: {
        enabled: true,
        hasImage: true
      }
    };

    await saveStoredFloorplanWithConfig({
      document: documentFixture(),
      saveDocument: async () => {
        calls.push("saveDocument");
      },
      updateDeviceConfig: (mutator) => {
        calls.push("updateDeviceConfig");
        config = mutator(config);
      },
      saveDeviceConfig: async () => {
        calls.push("saveDeviceConfig");
      }
    });

    expect(calls).toEqual(["saveDocument", "updateDeviceConfig", "saveDeviceConfig"]);
    expect(config.floorplan?.room).toMatchObject({
      id: "room_1",
      name: "Bedroom",
      source: "stored_room"
    });
  });

  it("does not touch config when document save fails", async () => {
    const calls: string[] = [];
    const config: WebDeviceConfig = {
      version: 1,
      zones: [],
      calibrationZones: []
    };

    await expect(
      saveStoredFloorplanWithConfig({
        document: documentFixture(),
        saveDocument: async () => {
          calls.push("saveDocument");
          throw new Error("document failed");
        },
        updateDeviceConfig: () => {
          calls.push("updateDeviceConfig");
        },
        saveDeviceConfig: async () => {
          calls.push("saveDeviceConfig");
        }
      })
    ).rejects.toThrow("document failed");

    expect(calls).toEqual(["saveDocument"]);
    expect(config.floorplan).toBeUndefined();
  });

  it("saves only config for config-scoped changes", async () => {
    const calls: string[] = [];
    let config: WebDeviceConfig = {
      version: 1,
      zones: [],
      calibrationZones: [],
      floorplan: {
        enabled: true,
        hasImage: true
      }
    };

    await saveStoredFloorplanWithConfig({
      document: documentFixture(),
      saveScopes: {
        config: true
      },
      saveDocument: async () => {
        calls.push("saveDocument");
      },
      updateDeviceConfig: (mutator) => {
        calls.push("updateDeviceConfig");
        config = mutator(config);
      },
      saveDeviceConfig: async () => {
        calls.push("saveDeviceConfig");
      }
    });

    expect(calls).toEqual(["saveDeviceConfig"]);
    expect(config.floorplan?.room).toBeUndefined();
  });

  it("saves only the floorplan document for document-scoped changes", async () => {
    const calls: string[] = [];

    await saveStoredFloorplanWithConfig({
      document: documentFixture(),
      saveScopes: {
        document: true
      },
      saveDocument: async () => {
        calls.push("saveDocument");
      },
      updateDeviceConfig: () => {
        calls.push("updateDeviceConfig");
      },
      saveDeviceConfig: async () => {
        calls.push("saveDeviceConfig");
      }
    });

    expect(calls).toEqual(["saveDocument"]);
  });

  it("updates room context and saves config when requested by the dirty scope", async () => {
    const calls: string[] = [];
    let config: WebDeviceConfig = {
      version: 1,
      zones: [],
      calibrationZones: [],
      floorplan: {
        enabled: true,
        hasImage: true
      }
    };

    await saveStoredFloorplanWithConfig({
      document: documentFixture(),
      saveScopes: {
        document: true,
        roomContext: true
      },
      saveDocument: async () => {
        calls.push("saveDocument");
      },
      updateDeviceConfig: (mutator) => {
        calls.push("updateDeviceConfig");
        config = mutator(config);
      },
      saveDeviceConfig: async () => {
        calls.push("saveDeviceConfig");
      }
    });

    expect(calls).toEqual(["saveDocument", "updateDeviceConfig", "saveDeviceConfig"]);
    expect(config.floorplan?.room?.id).toBe("room_1");
  });

  it("saves radar placement with a patch when only radar scope is dirty", async () => {
    const calls: string[] = [];

    await saveStoredFloorplanWithConfig({
      document: documentFixture(),
      saveScopes: {
        radar: true
      },
      saveDocument: async () => {
        calls.push("saveDocument");
      },
      saveRadar: async (radar) => {
        calls.push(`saveRadar:${radar.originPx.join(",")}`);
      },
      updateDeviceConfig: () => {
        calls.push("updateDeviceConfig");
      },
      saveDeviceConfig: async () => {
        calls.push("saveDeviceConfig");
      }
    });

    expect(calls).toEqual(["saveRadar:50,100"]);
  });

  it("saves room-name patches without uploading the full document", async () => {
    const calls: string[] = [];

    await saveStoredFloorplanWithConfig({
      document: documentFixture(),
      saveScopes: {
        roomName: true
      },
      roomNamePatches: {
        room_1: "Living"
      },
      saveDocument: async () => {
        calls.push("saveDocument");
      },
      saveRoomName: async (roomId, name) => {
        calls.push(`saveRoomName:${roomId}:${name}`);
      },
      updateDeviceConfig: () => {
        calls.push("updateDeviceConfig");
      },
      saveDeviceConfig: async () => {
        calls.push("saveDeviceConfig");
      }
    });

    expect(calls).toEqual(["saveRoomName:room_1:Living"]);
  });

  it("falls back to full document upload when a requested patch callback is missing", async () => {
    const calls: string[] = [];

    await saveStoredFloorplanWithConfig({
      document: documentFixture(),
      saveScopes: {
        radar: true
      },
      saveDocument: async () => {
        calls.push("saveDocument");
      },
      updateDeviceConfig: () => {
        calls.push("updateDeviceConfig");
      },
      saveDeviceConfig: async () => {
        calls.push("saveDeviceConfig");
      }
    });

    expect(calls).toEqual(["saveDocument"]);
  });

  it("saves furniture objects with a patch when only object scope is dirty", async () => {
    const calls: string[] = [];
    const document = {
      ...documentFixture(),
      objects: [{
        id: "object_1",
        asset: "desk",
        xPx: 10,
        yPx: 20,
        widthPx: 30,
        heightPx: 40,
        rotationDeg: 0
      }]
    };

    await saveStoredFloorplanWithConfig({
      document,
      saveScopes: {
        objects: true
      },
      saveDocument: async () => {
        calls.push("saveDocument");
      },
      saveObjects: async (objects) => {
        calls.push(`saveObjects:${objects.length}`);
      },
      updateDeviceConfig: () => {
        calls.push("updateDeviceConfig");
      },
      saveDeviceConfig: async () => {
        calls.push("saveDeviceConfig");
      }
    });

    expect(calls).toEqual(["saveObjects:1"]);
  });
});
