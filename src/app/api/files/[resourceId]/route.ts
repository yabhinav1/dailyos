import { Readable } from "node:stream";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { downloadFileFromMongo } from "@/lib/mongo-storage";
import { getErrorMessage } from "@/lib/utils";

// GridFS/the mongodb driver needs Node APIs (TCP sockets, node:stream) that
// aren't available on the Edge runtime, so this route must run on Node.
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ resourceId: string }> }
) {
  const { resourceId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
  if (!resource || resource.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }
  if (resource.type !== "FILE" || resource.mongoIndex == null || !resource.fileId) {
    return new Response("This resource isn't a stored file.", { status: 400 });
  }

  try {
    const { stream, filename, contentType, length } = await downloadFileFromMongo(
      resource.mongoIndex,
      resource.fileId
    );

    const webStream = Readable.toWeb(stream as Readable) as ReadableStream<Uint8Array>;

    return new Response(webStream, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
        ...(length ? { "Content-Length": String(length) } : {}),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err: unknown) {
    return new Response(getErrorMessage(err, "Failed to load file."), { status: 500 });
  }
}
