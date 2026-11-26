import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { assertValidKey } from "./keys";
import { DEFAULT_PRESIGN_SECONDS, type PresignedRequest, type StorageAdapter } from "./types";

export interface S3StorageOptions {
  driver: "minio" | "r2";
  bucket: string;
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** Cloudflare R2 (prod) and MinIO (dev) are both S3-compatible; one adapter serves both. */
export class S3Storage implements StorageAdapter {
  readonly driver: "minio" | "r2";
  readonly bucket: string;
  private readonly client: S3Client;

  constructor(opts: S3StorageOptions) {
    this.driver = opts.driver;
    this.bucket = opts.bucket;
    this.client = new S3Client({
      endpoint: opts.endpoint,
      region: opts.region,
      forcePathStyle: opts.driver === "minio",
      credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey },
    });
  }

  async put(key: string, body: Uint8Array | string, contentType: string): Promise<void> {
    assertValidKey(key);
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async get(key: string): Promise<Uint8Array | null> {
    assertValidKey(key);
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      return res.Body ? await res.Body.transformToByteArray() : null;
    } catch (err) {
      if (err instanceof NoSuchKey) return null;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    assertValidKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async presignPut(
    key: string,
    contentType: string,
    seconds = DEFAULT_PRESIGN_SECONDS,
  ): Promise<PresignedRequest> {
    assertValidKey(key);
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn: seconds },
    );
    return {
      url,
      method: "PUT",
      headers: { "Content-Type": contentType },
      expiresAt: new Date(Date.now() + seconds * 1000),
    };
  }

  async presignGet(key: string, seconds = DEFAULT_PRESIGN_SECONDS): Promise<PresignedRequest> {
    assertValidKey(key);
    const url = await getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: seconds,
    });
    return { url, method: "GET", headers: {}, expiresAt: new Date(Date.now() + seconds * 1000) };
  }
}
