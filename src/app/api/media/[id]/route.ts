import { Readable } from "node:stream";
import { prisma } from "@/lib/prisma";
import { downloadFileFromMongo } from "@/lib/mongo-storage";

export const runtime = "nodejs";

/**
 * Serves a note's image or recording. The 128-bit random id is the key, like
 * an unlisted link: anyone who can open the note can load its media, and
 * nobody can list or guess other files. Media never changes once stored.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{22}$/.test(id)) return new Response("Not found", { status: 404 });

  const media = await prisma.noteMedia.findUnique({ where: { id } });
  if (!media) return new Response("Not found", { status: 404 });

  try {
    const { stream, length } = await downloadFileFromMongo(media.mongoIndex, media.fileId);
    return new Response(Readable.toWeb(stream as Readable) as ReadableStream<Uint8Array>, {
      headers: {
        "Content-Type": media.mimeType,
        ...(length ? { "Content-Length": String(length) } : {}),
        "Cache-Control": "private, max-age=31536000, immutable",
        // Belt and braces against anything that sneaks past the type check.
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
