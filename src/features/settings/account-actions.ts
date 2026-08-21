"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth, signOut } from "@/lib/auth";
import { getErrorMessage } from "@/lib/utils";
import {
  sendDataExportEmail,
  sendExportSentElsewhereEmail,
  sendAccountDeletionScheduledEmail,
  sendAccountDeletionCancelledEmail,
} from "@/lib/email";

// How long a user has to change their mind before the account is purged.
// Not exported: a "use server" module may only export async functions, and
// exporting a constant here silently breaks every other export in the file.
const DELETION_GRACE_HOURS = 24;

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

// ---------------------------------------------------------------------------
// Data export
// ---------------------------------------------------------------------------

/**
 * Collects everything stored for one account.
 *
 * Deliberately explicit rather than a loop over relations: the point of an
 * export is that a person can read it, and the shape should change only when
 * someone decides it should.
 */
async function collectUserData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      image: true,
      role: true,
      emailVerified: true,
      createdAt: true,
      settings: true,
      notes: { include: { tags: true } },
      noteFolders: true,
      tasks: true,
      projects: true,
      categories: true,
      tags: true,
      habits: { include: { logs: true } },
      goals: true,
      events: true,
      studySubjects: { include: { topics: true } },
      studySessions: true,
      codingProjects: true,
      snippets: true,
      // Attachment bytes live in MongoDB; this is the catalogue, not the files.
      resources: true,
      notifications: true,
      activities: true,
    },
  });

  if (!user) throw new Error("Account not found.");
  return user;
}

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.");

/**
 * Emails a full JSON copy of the account's data.
 *
 * `alternateEmail` lets someone send it somewhere else — to a work address, or
 * to an account they still control. When they do, the registered address is
 * told, so a stolen session cannot quietly siphon the data out.
 */
export async function requestDataExport(alternateEmail?: string) {
  try {
    const userId = await requireUser();

    const account = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!account?.email) {
      return { success: false, message: "This account has no email address on file." };
    }

    let destination = account.email;
    if (alternateEmail && alternateEmail.trim()) {
      const parsed = emailSchema.safeParse(alternateEmail);
      if (!parsed.success) {
        return { success: false, message: parsed.error.issues[0]?.message ?? "Enter a valid email address." };
      }
      destination = parsed.data;
    }

    const data = await collectUserData(userId);
    const json = JSON.stringify(
      { exportedAt: new Date().toISOString(), account: data },
      null,
      2
    );

    await sendDataExportEmail(destination, json, account.email);

    const wentElsewhere = destination.toLowerCase() !== account.email.toLowerCase();
    if (wentElsewhere) {
      await sendExportSentElsewhereEmail(account.email, destination);
    }

    return {
      success: true,
      message: wentElsewhere
        ? `Export sent to ${destination}. We've also let ${account.email} know.`
        : `Export sent to ${destination}.`,
    };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Couldn't send the export.") };
  }
}

// ---------------------------------------------------------------------------
// Account deletion
// ---------------------------------------------------------------------------

export async function requestAccountDeletion() {
  try {
    const userId = await requireUser();
    const deletesAt = new Date(Date.now() + DELETION_GRACE_HOURS * 60 * 60 * 1000);

    const user = await prisma.user.update({
      where: { id: userId },
      data: { deletionScheduledAt: deletesAt },
      select: { email: true },
    });

    if (user.email) {
      await sendAccountDeletionScheduledEmail(user.email, deletesAt);
    }

    return { success: true, deletesAt: deletesAt.toISOString() };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Couldn't schedule the deletion.") };
  }
}

export async function cancelAccountDeletion() {
  try {
    const userId = await requireUser();

    const user = await prisma.user.update({
      where: { id: userId },
      data: { deletionScheduledAt: null },
      select: { email: true },
    });

    if (user.email) {
      await sendAccountDeletionCancelledEmail(user.email);
    }

    return { success: true };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Couldn't cancel the deletion.") };
  }
}

/** Signs the current user out, leaving the scheduled deletion in place. */
export async function signOutPendingDeletion() {
  await signOut({ redirectTo: "/login" });
}
