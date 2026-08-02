import { MongoClient, Db, GridFSBucket, ObjectId } from "mongodb";

/**
 * Multi-cluster file storage on top of MongoDB GridFS.
 *
 * Set as many MongoDB connection strings as you want in the environment:
 *   MONGODB_URI      (first / default cluster)
 *   MONGODB_URI_2
 *   MONGODB_URI_3
 *   ...
 *
 * On every upload we check each configured cluster's current storage usage
 * (via db.stats()) and pick whichever has the most room, falling over to
 * the next one if a cluster is full, over quota, or unreachable. This does
 * NOT make storage literally unlimited — each cluster still has its own
 * quota (e.g. 512MB on an Atlas M0 free tier) — but it means you can keep
 * adding MONGODB_URI_N entries over time to grow total capacity without
 * changing any code.
 *
 * Files are stored as GridFS documents, not inline in Postgres, so large
 * PDFs no longer bloat the primary database.
 */

const BUCKET_NAME = "dailyos_files";
// Headroom kept below whatever quota we assume, so we stop picking a
// cluster before it actually hits its hard limit mid-upload.
const SAFETY_MARGIN_BYTES = 30 * 1024 * 1024; // 30MB
// Default assumption for an unconfigured cluster's quota. Atlas free-tier
// (M0) clusters cap total storage at 512MB. Override per-cluster with
// MONGODB_QUOTA_BYTES_<n>, or globally with MONGODB_QUOTA_BYTES, if your
// clusters are a different size.
const DEFAULT_QUOTA_BYTES = 512 * 1024 * 1024;

interface MongoNode {
  index: number; // 0 = MONGODB_URI, 1 = MONGODB_URI_2, 2 = MONGODB_URI_3, ...
  envLabel: string;
  client: MongoClient;
  dbPromise: Promise<Db>;
}

function collectMongoUris(): { uri: string; envLabel: string }[] {
  const found: { uri: string; envLabel: string }[] = [];
  if (process.env.MONGODB_URI) {
    found.push({ uri: process.env.MONGODB_URI, envLabel: "MONGODB_URI" });
  }
  // Supports MONGODB_URI_2, MONGODB_URI_3, ... (numbering starts at 2 so it
  // reads naturally alongside the unsuffixed MONGODB_URI as "the first one").
  for (let i = 2; i <= 25; i++) {
    const key = `MONGODB_URI_${i}`;
    const val = process.env[key];
    if (val) found.push({ uri: val, envLabel: key });
  }
  return found;
}

declare global {
   
  var mongoPoolGlobal: MongoNode[] | undefined;
}

function getPool(): MongoNode[] {
  if (globalThis.mongoPoolGlobal) return globalThis.mongoPoolGlobal;

  const uris = collectMongoUris();
  if (uris.length === 0) {
    throw new Error(
      "No MongoDB storage configured. Set MONGODB_URI (and optionally MONGODB_URI_2, MONGODB_URI_3, ...) in your environment."
    );
  }

  const pool: MongoNode[] = uris.map(({ uri, envLabel }, index) => {
    const client = new MongoClient(uri);
    const dbPromise = client.connect().then((c) => c.db());
    return { index, envLabel, client, dbPromise };
  });

  globalThis.mongoPoolGlobal = pool;
  return pool;
}

function quotaForNode(node: MongoNode): number {
  const perNode = process.env[`MONGODB_QUOTA_BYTES_${node.index + 1}`];
  const global = process.env.MONGODB_QUOTA_BYTES;
  const raw = perNode || global;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_QUOTA_BYTES;
}

async function getAvailableBytes(node: MongoNode): Promise<number> {
  try {
    const db = await node.dbPromise;
    const stats = await db.stats();
    const sizes = stats as { storageSize?: number; dataSize?: number };
  const used = Number(sizes.storageSize ?? sizes.dataSize ?? 0);
    return quotaForNode(node) - used - SAFETY_MARGIN_BYTES;
  } catch {
    // Unreachable / errored cluster — treat as having no room so we skip it.
    return -1;
  }
}

export interface UploadedFileRef {
  mongoIndex: number;
  fileId: string;
}

/**
 * Uploads a file to whichever configured MongoDB cluster currently has the
 * most free space, retrying the next cluster if the chosen one turns out to
 * be full or fails mid-upload.
 */
export async function uploadFileToMongo(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  metadata: Record<string, unknown> = {}
): Promise<UploadedFileRef> {
  const pool = getPool();

  const ranked = await Promise.all(
    pool.map(async (node) => ({ node, available: await getAvailableBytes(node) }))
  );
  ranked.sort((a, b) => b.available - a.available);

  let lastError: unknown = null;
  for (const { node, available } of ranked) {
    if (available < buffer.length) {
      lastError = new Error(`${node.envLabel} doesn't have enough free space for this file.`);
      continue;
    }
    try {
      const db = await node.dbPromise;
      const bucket = new GridFSBucket(db, { bucketName: BUCKET_NAME });
      const fileId = new ObjectId();
      await new Promise<void>((resolve, reject) => {
        const uploadStream = bucket.openUploadStreamWithId(fileId, filename, {
          contentType: mimeType,
          metadata,
        });
        uploadStream.on("error", reject);
        uploadStream.on("finish", () => resolve());
        uploadStream.end(buffer);
      });
      return { mongoIndex: node.index, fileId: fileId.toHexString() };
    } catch (err) {
      lastError = err;
      continue; // this cluster failed (full, network error, etc.) — try the next
    }
  }

  throw new Error(
    lastError instanceof Error
      ? `All configured MongoDB storage is full or unreachable (${lastError.message}). Add another MONGODB_URI_N to grow capacity.`
      : "All configured MongoDB storage is full or unreachable."
  );
}

export interface DownloadedFile {
  stream: NodeJS.ReadableStream;
  filename: string;
  contentType: string;
  length: number;
}

export async function downloadFileFromMongo(mongoIndex: number, fileId: string): Promise<DownloadedFile> {
  const pool = getPool();
  const node = pool.find((n) => n.index === mongoIndex);
  if (!node) throw new Error("The storage cluster this file was saved to is no longer configured.");

  const db = await node.dbPromise;
  const bucket = new GridFSBucket(db, { bucketName: BUCKET_NAME });
  const _id = new ObjectId(fileId);

  const files = await bucket.find({ _id }).toArray();
  const fileDoc = files[0];
  if (!fileDoc) throw new Error("File not found.");

  return {
    stream: bucket.openDownloadStream(_id),
    filename: fileDoc.filename,
    contentType: (fileDoc.contentType as string) || "application/octet-stream",
    length: fileDoc.length,
  };
}

/**
 * Exposes the raw GridFSBucket plus file metadata for a stored file, so
 * callers that need HTTP Range support (e.g. audio/video seeking) can
 * call bucket.openDownloadStream(id, { start, end }) themselves —
 * downloadFileFromMongo() above always streams the whole file.
 */
export async function getGridFSBucketForTrack(mongoIndex: number, fileId: string) {
  const pool = getPool();
  const node = pool.find((n) => n.index === mongoIndex);
  if (!node) throw new Error("The storage cluster this file was saved to is no longer configured.");

  const db = await node.dbPromise;
  const bucket = new GridFSBucket(db, { bucketName: BUCKET_NAME });
  const _id = new ObjectId(fileId);

  const files = await bucket.find({ _id }).toArray();
  const fileDoc = files[0];
  if (!fileDoc) throw new Error("File not found.");

  return { bucket, fileDoc };
}

export async function deleteFileFromMongo(mongoIndex: number, fileId: string): Promise<void> {
  const pool = getPool();
  const node = pool.find((n) => n.index === mongoIndex);
  if (!node) return;
  const db = await node.dbPromise;
  const bucket = new GridFSBucket(db, { bucketName: BUCKET_NAME });
  await bucket.delete(new ObjectId(fileId)).catch(() => {
    // Already gone / never existed — fine to ignore on cleanup.
  });
}
