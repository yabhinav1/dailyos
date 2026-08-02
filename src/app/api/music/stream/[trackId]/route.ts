import { Readable } from "node:stream";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getGridFSBucketForTrack } from "@/lib/mongo-storage";
import { ObjectId } from "mongodb";
import { getErrorMessage } from "@/lib/utils";

// GridFS needs Node APIs, not available on Edge.
export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ trackId: string }> }
) {
  const { trackId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const track = await prisma.track.findUnique({ where: { id: trackId } });
  if (!track || track.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }
  if (track.source !== "UPLOAD" || track.mongoIndex == null || !track.fileId) {
    return new Response("This track has no stored audio file.", { status: 400 });
  }

  try {
    const { bucket, fileDoc } = await getGridFSBucketForTrack(track.mongoIndex, track.fileId);
    const totalLength = fileDoc.length;
    const contentType = (fileDoc.contentType as string) || track.mimeType || "application/octet-stream";

    const range = req.headers.get("range");
    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      const start = match?.[1] ? parseInt(match[1], 10) : 0;
      const end = match?.[2] ? parseInt(match[2], 10) : totalLength - 1;

      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= totalLength) {
        return new Response("Requested range not satisfiable", {
          status: 416,
          headers: { "Content-Range": `bytes */${totalLength}` },
        });
      }

      const clampedEnd = Math.min(end, totalLength - 1);
      const stream = bucket.openDownloadStream(new ObjectId(track.fileId), {
        start,
        end: clampedEnd + 1, // GridFS end is exclusive
      });
      const webStream = Readable.toWeb(stream as Readable) as ReadableStream<Uint8Array>;

      return new Response(webStream, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Range": `bytes ${start}-${clampedEnd}/${totalLength}`,
          "Content-Length": String(clampedEnd - start + 1),
          "Accept-Ranges": "bytes",
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    const stream = bucket.openDownloadStream(new ObjectId(track.fileId));
    const webStream = Readable.toWeb(stream as Readable) as ReadableStream<Uint8Array>;

    return new Response(webStream, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(totalLength),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err: unknown) {
    return new Response(getErrorMessage(err, "Failed to stream track."), { status: 500 });
  }
}
