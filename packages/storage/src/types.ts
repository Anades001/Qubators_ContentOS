export type StorageDriverName = "local" | "minio" | "r2";

export interface PresignedRequest {
  url: string;
  method: "PUT" | "GET";
  /** Headers the client must send with the request (e.g. Content-Type for PUT). */
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface StorageAdapter {
  readonly driver: StorageDriverName;
  readonly bucket: string;
  put(key: string, body: Uint8Array | string, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
  presignPut(key: string, contentType: string, expiresInSeconds?: number): Promise<PresignedRequest>;
  presignGet(key: string, expiresInSeconds?: number): Promise<PresignedRequest>;
}

export const DEFAULT_PRESIGN_SECONDS = 15 * 60;
