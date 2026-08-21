import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Serves an uploaded avatar.
 *
 * Uploaded avatars are stored as data URLs, which are far too large to travel
 * in the session cookie — putting one there splits the JWT across dozens of
 * cookie chunks and breaks the session. The token carries this URL instead and
 * the bytes are fetched here.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { image: true },
  });

  if (!user?.image?.startsWith("data:")) {
    return new Response("Not found", { status: 404 });
  }

  // data:<mime>;base64,<payload>
  const match = /^data:([^;,]+);base64,([\s\S]+)$/.exec(user.image);
  if (!match) {
    return new Response("Not found", { status: 404 });
  }

  const [, contentType, base64] = match;
  if (!contentType.startsWith("image/")) {
    return new Response("Not found", { status: 404 });
  }

  const bytes = Buffer.from(base64, "base64");

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(bytes.length),
      // Private: an avatar belongs to one account, and it changes when the
      // user rerolls or uploads, so this must not sit in a shared cache.
      "Cache-Control": "private, max-age=300",
    },
  });
}
