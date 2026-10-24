"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getErrorMessage } from "@/lib/utils";
import { hardDeleteTrashed, TRASH_RETENTION_DAYS } from "@/lib/trash-purge";
import { restoreNote, hardDeleteNote } from "@/features/notes/actions";
import { restoreTask, hardDeleteTask } from "@/features/tasks/actions";
import { restoreProject, hardDeleteProject } from "@/features/projects/actions";
import { getDeletedTasks } from "@/features/tasks/queries";
import { getDeletedProjects } from "@/features/projects/queries";

const trashItemSchema = z.object({
  kind: z.enum(["note", "task", "project"]),
  id: z.string().min(1),
});

export type TrashItemRef = z.infer<typeof trashItemSchema>;

async function getUserIdOrThrow() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

function revalidateTrash() {
  revalidatePath("/trash");
  revalidatePath("/notes");
  revalidatePath("/tasks");
  revalidatePath("/projects");
}

// -------------------------------------------------------------
// QUERY ACTIONS
// -------------------------------------------------------------

export async function getTrashAction() {
  try {
    const userId = await getUserIdOrThrow();

    const [notes, tasks, projects] = await Promise.all([
      // Body columns (content, doodle, canvas) can be large and the list
      // never shows them, so they stay in the database.
      prisma.note.findMany({
        where: { userId, deletedAt: { not: null } },
        orderBy: { deletedAt: "desc" },
        select: {
          id: true,
          title: true,
          color: true,
          deletedAt: true,
          folder: { select: { name: true } },
        },
      }),
      getDeletedTasks(),
      getDeletedProjects(),
    ]);

    return {
      success: true,
      data: { notes, tasks, projects, retentionDays: TRASH_RETENTION_DAYS },
    };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to load trash") };
  }
}

// -------------------------------------------------------------
// MUTATIONS
// -------------------------------------------------------------

// Each per-kind action does its own ownership check. Notes report failure in
// the result; tasks and projects throw — both end up as `{ success: false }`.

export async function restoreTrashItem(item: TrashItemRef) {
  try {
    const { kind, id } = trashItemSchema.parse(item);

    if (kind === "note") {
      const res = await restoreNote(id);
      if (!res.success) throw new Error(res.message);
    } else if (kind === "task") {
      await restoreTask(id);
    } else {
      await restoreProject(id);
    }

    revalidateTrash();
    return { success: true };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to restore item") };
  }
}

export async function deleteTrashItemForever(item: TrashItemRef) {
  try {
    const { kind, id } = trashItemSchema.parse(item);

    if (kind === "note") {
      const res = await hardDeleteNote(id);
      if (!res.success) throw new Error(res.message);
    } else if (kind === "task") {
      await hardDeleteTask(id);
    } else {
      await hardDeleteProject(id);
    }

    revalidateTrash();
    return { success: true };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to delete item") };
  }
}

export async function emptyTrash() {
  try {
    const userId = await getUserIdOrThrow();
    const owned = { userId };

    const result = await hardDeleteTrashed({ notes: owned, tasks: owned, projects: owned });

    revalidateTrash();
    return { success: true, data: result };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to empty trash") };
  }
}
