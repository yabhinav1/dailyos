import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteFileFromMongo } from "@/lib/mongo-storage";

/** How long a soft-deleted note, task or project stays restorable. */
export const TRASH_RETENTION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Cap on tasks/projects resolved per call, so one cron run can't outlive the
 * function timeout. Anything past it is still expired tomorrow and goes then.
 */
const MAX_PER_RUN = 1000;

export type TrashSelection = {
  notes?: Prisma.NoteWhereInput;
  tasks?: Prisma.TaskWhereInput;
  projects?: Prisma.ProjectWhereInput;
};

export type TrashPurgeResult = {
  notes: number;
  tasks: number;
  projects: number;
  filesDeleted: number;
};

// Every selection is narrowed to rows that are actually in the trash, so no
// caller can permanently delete a live item by passing a loose filter.
const TRASHED = { deletedAt: { not: null } } as const;

/**
 * Permanently deletes trashed notes, tasks and projects matching `selection`.
 *
 * The schema decides what happens to dependents: milestones, subtasks,
 * checklists and tags cascade; tasks of a deleted project keep living with
 * `projectId` set to null. Resources are SetNull on both sides too, which
 * would leave a file attached to nothing — unreachable in the UI, its bytes
 * still occupying GridFS. So a resource whose every owner is going away is
 * deleted here as well, and, as in `deleteResource` and `purgeAccount`, its
 * blob goes before its row: the row holds the only pointer to the bytes.
 */
export async function hardDeleteTrashed(selection: TrashSelection): Promise<TrashPurgeResult> {
  const [tasks, projects] = await Promise.all([
    selection.tasks
      ? prisma.task.findMany({
          where: { AND: [selection.tasks, TRASHED] },
          select: { id: true },
          take: MAX_PER_RUN,
        })
      : [],
    selection.projects
      ? prisma.project.findMany({
          where: { AND: [selection.projects, TRASHED] },
          select: { id: true },
          take: MAX_PER_RUN,
        })
      : [],
  ]);
  const taskIds = tasks.map((t) => t.id);
  const projectIds = projects.map((p) => p.id);

  // Orphaned once this runs: owned by a doomed task or project, and every
  // owner it has is doomed (a missing owner counts as already gone).
  const orphanedResources: Prisma.ResourceWhereInput = {
    AND: [
      { OR: [{ taskId: { in: taskIds } }, { projectId: { in: projectIds } }] },
      { OR: [{ taskId: null }, { taskId: { in: taskIds } }] },
      { OR: [{ projectId: null }, { projectId: { in: projectIds } }] },
    ],
  };

  let filesDeleted = 0;
  if (taskIds.length > 0 || projectIds.length > 0) {
    const files = await prisma.resource.findMany({
      where: { AND: [orphanedResources, { fileId: { not: null } }] },
      select: { mongoIndex: true, fileId: true },
    });
    for (const file of files) {
      if (file.mongoIndex == null || !file.fileId) continue;
      // deleteFileFromMongo already swallows "already gone". An unreachable
      // cluster is logged rather than aborting the whole delete, same as
      // purgeAccount: half a purge is worse than one stranded blob.
      try {
        await deleteFileFromMongo(file.mongoIndex, file.fileId);
        filesDeleted += 1;
      } catch (err) {
        console.error(`[trash] failed to delete file ${file.fileId}:`, err);
      }
    }
  }

  const [, deletedTasks, deletedProjects, deletedNotes] = await prisma.$transaction([
    prisma.resource.deleteMany({ where: orphanedResources }),
    prisma.task.deleteMany({ where: { id: { in: taskIds }, ...TRASHED } }),
    prisma.project.deleteMany({ where: { id: { in: projectIds }, ...TRASHED } }),
    prisma.note.deleteMany({
      where: selection.notes ? { AND: [selection.notes, TRASHED] } : { id: { in: [] } },
    }),
  ]);

  return {
    notes: deletedNotes.count,
    tasks: deletedTasks.count,
    projects: deletedProjects.count,
    filesDeleted,
  };
}

/**
 * Permanently deletes everything that has sat in the trash longer than
 * TRASH_RETENTION_DAYS, across all users. Run daily by the purge cron.
 */
export async function purgeExpiredTrash(now: Date = new Date()): Promise<TrashPurgeResult> {
  const cutoff = new Date(now.getTime() - TRASH_RETENTION_DAYS * DAY_MS);
  const expired = { deletedAt: { lte: cutoff } };
  return hardDeleteTrashed({ notes: expired, tasks: expired, projects: expired });
}
