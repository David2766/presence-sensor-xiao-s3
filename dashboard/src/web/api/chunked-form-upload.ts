export const UPLOAD_CHUNK_BYTES = 192;

export interface ChunkedFormUploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export interface ChunkedFormUploadPaths {
  start: string;
  chunk: string;
  commit: string;
}

export interface ChunkedFormUploadOptions {
  paths: ChunkedFormUploadPaths;
  bytes: Uint8Array;
  postForm: (path: string, values: Record<string, string>) => Promise<void>;
  fields?: Record<string, string>;
  onProgress?: (progress: ChunkedFormUploadProgress) => void;
}

export async function uploadChunkedFormPayload({
  paths,
  bytes,
  postForm,
  fields = {},
  onProgress
}: ChunkedFormUploadOptions): Promise<void> {
  const session = createUploadSessionId();
  onProgress?.({ loaded: 0, total: bytes.byteLength, percent: 0 });

  await postForm(paths.start, {
    session,
    ...fields,
    size: String(bytes.byteLength)
  });

  for (let offset = 0; offset < bytes.byteLength; offset += UPLOAD_CHUNK_BYTES) {
    const chunk = bytes.subarray(offset, Math.min(offset + UPLOAD_CHUNK_BYTES, bytes.byteLength));
    await postForm(paths.chunk, {
      session,
      ...fields,
      offset: String(offset),
      data: bytesToHex(chunk)
    });
    const loaded = Math.min(bytes.byteLength, offset + chunk.byteLength);
    onProgress?.({
      loaded,
      total: bytes.byteLength,
      percent: Math.min(99, Math.max(0, Math.round((loaded / bytes.byteLength) * 100)))
    });
  }

  await postForm(paths.commit, {
    session,
    ...fields
  });
  onProgress?.({ loaded: bytes.byteLength, total: bytes.byteLength, percent: 100 });
}

export function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

function createUploadSessionId(): string {
  const values = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(values);
  }
  const fallback = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  return String(values[0] || fallback || 1);
}
