import { prisma } from "@/lib/prisma";
import { deleteFileFromMongo } from "@/lib/mongo-storage";
import { deleteNoteMedia } from "@/lib/note-media";

/**
 * Permanently removes an account and everything belonging to it.
 *
 * Order matters. File bytes live in MongoDB GridFS and are reachable only
 * through the `mongoIndex`/`fileId` columns on Resource and Track. Every app
 * relation cascades from the user row, so deleting that row first would take
 * the pointers with it and strand the bytes in GridFS with nothing left to say
 * who they belonged to. Blobs go first, the row second.
 */
export async function purgeAccount(userId: string): Promise<{ filesDeleted: number }> {
  const [resources, tracks] = await Promise.all([
    prisma.resource.findMany({
      where: { userId, fileId: { not: null } },
      select: { mongoIndex: true, fileId: true },
    }),
    prisma.track.findMany({
      where: { userId, fileId: { not: null } },
      select: { mongoIndex: true, fileId: true },
    }),
  ]);

  let filesDeleted = 0;
  for (const file of [...resources, ...tracks]) {
    if (file.mongoIndex == null || !file.fileId) continue;
    // deleteFileFromMongo already swallows "already gone" — one unreachable
    // cluster must not strand the account in a half-deleted state.
    try {
      await deleteFileFromMongo(file.mongoIndex, file.fileId);
      filesDeleted += 1;
    } catch (err) {
      console.error(`[purge] failed to delete file ${file.fileId}:`, err);
    }
  }

  filesDeleted += await deleteNoteMedia({ userId });

  await prisma.user.delete({ where: { id: userId } });

  return { filesDeleted };
}
