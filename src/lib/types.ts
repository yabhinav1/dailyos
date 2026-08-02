/**
 * Shared domain types for the UI layer.
 *
 * These are derived from the query/action functions rather than hand-written,
 * so they stay correct automatically when a Prisma `include`/`select` changes.
 * Pages should use these instead of `any` when holding fetched entities.
 */
import type { getTasks, getTaskById } from "@/features/tasks/queries";
import type { getProjects, getProjectById } from "@/features/projects/queries";
import type { getNotesAction, getFoldersAction } from "@/features/notes/actions";
import type { getHabitsAction } from "@/features/habits/actions";
import type { getGoalsAction } from "@/features/goals/actions";
import type { getEventsAction } from "@/features/calendar/actions";
import type { getStudyDataAction } from "@/features/study/actions";
import type { getCodingProjects, getSnippets } from "@/features/developer/actions";
import type { getNotifications } from "@/features/notifications/actions";
import type { getResourcesForProject } from "@/features/projects/actions";
import type { getAnalyticsData } from "@/features/analytics/actions";

/** Unwraps `{ success, data }` action results down to the element type. */
type DataOf<T> = T extends { data?: infer D } ? NonNullable<D> : never;
type Result<F extends (...args: never[]) => unknown> = DataOf<Awaited<ReturnType<F>>>;
type Item<T> = T extends readonly (infer E)[] ? E : T;

export type Task = Item<Awaited<ReturnType<typeof getTasks>>>;
export type TaskDetail = NonNullable<Awaited<ReturnType<typeof getTaskById>>>;

export type Project = Item<Awaited<ReturnType<typeof getProjects>>>;
export type ProjectDetail = NonNullable<Awaited<ReturnType<typeof getProjectById>>>;

/** A file or link attached to a project. */
export type ProjectResource = Item<Result<typeof getResourcesForProject>>;

/** Goal.timeframe is a plain String column; these are the values the UI uses. */
export type GoalTimeframe = "WEEKLY" | "MONTHLY" | "YEARLY";

export type Note = Item<Result<typeof getNotesAction>>;
export type NoteFolder = Item<Result<typeof getFoldersAction>>;

export type Habit = Item<Result<typeof getHabitsAction>>;
export type HabitLog = Habit extends { logs: readonly (infer L)[] } ? L : never;

export type Goal = Item<Result<typeof getGoalsAction>>;
export type CalendarEvent = Item<Result<typeof getEventsAction>>;

export type StudyData = Result<typeof getStudyDataAction>;
export type StudySubject = Item<StudyData["subjects"]>;
export type StudyTopic = StudySubject extends { topics: readonly (infer T)[] } ? T : never;
export type StudySession = Item<StudyData["recentSessions"]>;

export type CodingProject = Item<Result<typeof getCodingProjects>>;
export type CodeSnippet = Item<Result<typeof getSnippets>>;

export type Notification = Item<Result<typeof getNotifications>>;
export type AnalyticsData = Result<typeof getAnalyticsData>;
export type HabitStat = Item<AnalyticsData["habitStats"]>;
export type StudyStat = Item<AnalyticsData["studyStats"]>;
