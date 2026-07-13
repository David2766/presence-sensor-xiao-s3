export type DeviceStorageTaskKind = "config" | "floorplan" | "stats";

type DeviceStorageTask<T> = () => Promise<T>;

export interface DeviceStorageQueueSnapshot {
  active: DeviceStorageTaskKind | null;
  queued: number;
  isBusy: boolean;
}

type DeviceStorageQueueListener = (snapshot: DeviceStorageQueueSnapshot) => void;

export class DeviceStorageQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private active: DeviceStorageTaskKind | null = null;
  private queued = 0;
  private readonly listeners = new Set<DeviceStorageQueueListener>();

  run<T>(kind: DeviceStorageTaskKind, task: DeviceStorageTask<T>): Promise<T> {
    this.queued += 1;
    this.emit();
    const runTask = this.tail.then(
      () => this.runTask(kind, task),
      () => this.runTask(kind, task)
    );
    this.tail = runTask.catch(() => undefined);
    return runTask;
  }

  snapshot(): DeviceStorageQueueSnapshot {
    return {
      active: this.active,
      queued: this.queued,
      isBusy: this.active !== null || this.queued > 0
    };
  }

  subscribe(listener: DeviceStorageQueueListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async runTask<T>(kind: DeviceStorageTaskKind, task: DeviceStorageTask<T>): Promise<T> {
    this.queued = Math.max(0, this.queued - 1);
    this.active = kind;
    this.emit();
    try {
      return await task();
    } finally {
      this.active = null;
      this.emit();
    }
  }

  private emit(): void {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}

export const deviceStorageQueue = new DeviceStorageQueue();
