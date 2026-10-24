"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Circle,
  Flame,
  Plus,
  Repeat,
  Sun,
  Target,
  Timer,
} from "lucide-react";
import { getTodayAction } from "@/features/today/actions";
import { createTask, toggleTaskCompleted } from "@/features/tasks/actions";
import { logHabit } from "@/features/habits/actions";
import { SkeletonCards } from "@/components/ui/skeleton";
import { toast } from "@/stores/toast-store";
import { formatDay, localDateKey } from "@/lib/dates";

type TodayData = NonNullable<Awaited<ReturnType<typeof getTodayAction>>["data"]>;
type TodayTask = TodayData["dueToday"][number];

const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

function greeting(hour: number) {
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function TodayPage() {
  const [data, setData] = useState<TodayData | null>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getTodayAction(localDateKey(), browserZone());
      if (cancelled) return;
      if (res.success && res.data) setData(res.data);
      else toast.error("Couldn't load today.");
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  // Optimistic: the tick lands before the server answers, then a reload
  // brings in anything the change caused (a recurring task's next copy).
  const toggleTask = async (task: TodayTask) => {
    const done = task.status !== "COMPLETED";
    const patch = (t: TodayTask) => (t.id === task.id ? { ...t, status: done ? ("COMPLETED" as const) : ("TODO" as const) } : t);
    setData((d) => d && { ...d, dueToday: d.dueToday.map(patch), overdue: d.overdue.map(patch) });
    try {
      await toggleTaskCompleted(task.id, done);
      reload();
    } catch {
      toast.error("Couldn't update the task.");
      reload();
    }
  };

  const toggleHabit = async (habitId: string, doneToday: boolean) => {
    setData((d) =>
      d && {
        ...d,
        habits: d.habits.map((h) =>
          h.id === habitId ? { ...h, doneToday: !doneToday, donePeriod: !doneToday || h.donePeriod } : h
        ),
      }
    );
    try {
      await logHabit(habitId, localDateKey(), localDateKey());
      reload();
    } catch {
      toast.error("Couldn't save that check-in.");
      reload();
    }
  };

  const quickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = quickTitle.trim();
    if (!title) return;
    setAdding(true);
    try {
      await createTask({ title, dueDate: localDateKey() });
      setQuickTitle("");
      reload();
    } catch {
      toast.error("Couldn't add the task.");
    } finally {
      setAdding(false);
    }
  };

  if (!data) return <SkeletonCards cards={4} />;

  const now = new Date();
  const firstName = data.name?.trim().split(/\s+/)[0];
  const doneCount = data.dueToday.filter((t) => t.status === "COMPLETED").length;
  const habitsDone = data.habits.filter((h) => h.donePeriod).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <Sun className="h-5.5 w-5.5 text-amber-400" />
          {greeting(now.getHours())}{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-xs text-zinc-300 mt-1">
          {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          {" · "}
          {data.dueToday.length ? `${doneCount}/${data.dueToday.length} tasks done` : "No tasks due"}
          {data.habits.length > 0 && ` · ${habitsDone}/${data.habits.length} habits`}
          {data.focusMinutes > 0 && ` · ${data.focusMinutes} min focused`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Tasks */}
        <section className="lg:col-span-2 rounded-xl border border-zinc-850 bg-[#0C0C0E]/40 p-4 space-y-4">
          <SectionTitle icon={CheckCircle2} title="Tasks" href="/tasks" />

          <form onSubmit={quickAdd} className="flex items-center gap-2">
            <input
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder="Add a task for today…"
              aria-label="Add a task for today"
              className="flex-1 h-9 px-3 rounded-lg border border-zinc-800 bg-zinc-900/50 text-xs text-white placeholder-zinc-400 outline-none focus:border-zinc-700"
              disabled={adding}
            />
            <button
              type="submit"
              aria-label="Add task"
              disabled={adding || !quickTitle.trim()}
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg bg-zinc-100 text-zinc-900 hover:bg-white disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
          </form>

          {data.overdue.length > 0 && (
            <div className="space-y-1">
              <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-red-400">
                <AlertCircle className="h-3 w-3" /> Overdue
              </h3>
              {data.overdue.map((t) => (
                <TaskRow key={t.id} task={t} onToggle={toggleTask} showDate />
              ))}
            </div>
          )}

          <div className="space-y-1">
            {data.overdue.length > 0 && (
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Due today</h3>
            )}
            {data.dueToday.length === 0 ? (
              <p className="py-4 text-center text-xs text-zinc-400">Nothing due today. Add something above, or enjoy the space.</p>
            ) : (
              data.dueToday.map((t) => <TaskRow key={t.id} task={t} onToggle={toggleTask} />)
            )}
          </div>
        </section>

        {/* Schedule */}
        <section className="rounded-xl border border-zinc-850 bg-[#0C0C0E]/40 p-4 space-y-3">
          <SectionTitle icon={CalendarDays} title="Schedule" href="/calendar" />
          {data.events.length === 0 ? (
            <p className="py-4 text-center text-xs text-zinc-400">No events today.</p>
          ) : (
            <ul className="space-y-2">
              {data.events.map((ev) => (
                <li key={ev.key} className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-2 w-2 rounded-full shrink-0" style={{ background: ev.color || "#3b82f6" }} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-200 truncate">{ev.title}</p>
                    <p className="text-[11px] text-zinc-400">
                      {ev.isAllDay
                        ? "All day"
                        : `${new Date(ev.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} – ${new Date(ev.end).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Habits */}
        <section className="lg:col-span-2 rounded-xl border border-zinc-850 bg-[#0C0C0E]/40 p-4 space-y-3">
          <SectionTitle icon={Flame} title="Habits" href="/habits" />
          {data.habits.length === 0 ? (
            <p className="py-4 text-center text-xs text-zinc-400">
              No habits yet. <Link href="/habits" className="text-blue-400 hover:text-blue-300">Start one</Link>.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {data.habits.map((h) => {
                // Weekly/monthly habits already done this period show as
                // done even on a day without its own tick.
                const done = h.doneToday || h.donePeriod;
                return (
                  <button
                    key={h.id}
                    onClick={() => toggleHabit(h.id, h.doneToday)}
                    disabled={h.donePeriod && !h.doneToday}
                    title={h.donePeriod && !h.doneToday ? `Already done this ${h.frequency === "WEEKLY" ? "week" : "month"}` : undefined}
                    className="flex items-center gap-2.5 rounded-lg border border-zinc-850 bg-zinc-950/40 px-3 py-2 text-left hover:border-zinc-700 transition-colors disabled:cursor-default"
                  >
                    {done ? <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400 shrink-0" /> : <Circle className="h-4.5 w-4.5 text-zinc-400 shrink-0" />}
                    <span className={`flex-1 truncate text-xs font-medium ${done ? "text-zinc-400 line-through" : "text-zinc-200"}`}>
                      {h.name}
                      {h.frequency !== "DAILY" && <span className="ml-1 text-[10px] text-zinc-500 no-underline">({h.frequency.toLowerCase()})</span>}
                    </span>
                    <span className="flex items-center gap-0.5 text-[11px] font-bold text-orange-400">
                      <Flame className="h-3 w-3" />
                      {h.streak}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Focus + goals */}
        <section className="rounded-xl border border-zinc-850 bg-[#0C0C0E]/40 p-4 space-y-4">
          <div className="space-y-1">
            <SectionTitle icon={Timer} title="Focus" href="/study" />
            <p className="text-2xl font-bold text-white">
              {data.focusMinutes}
              <span className="ml-1 text-xs font-medium text-zinc-400">min today</span>
            </p>
          </div>
          <div className="space-y-2">
            <SectionTitle icon={Target} title="Goals" href="/goals" />
            {data.goals.length === 0 ? (
              <p className="text-xs text-zinc-400">No open goals.</p>
            ) : (
              data.goals.map((g) => (
                <div key={g.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate text-zinc-200 font-medium">{g.title}</span>
                    <span className="text-zinc-400 shrink-0">
                      {g.progress}%{g.targetDate && ` · ${formatDay(g.targetDate)}`}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-900 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${g.progress}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, href }: { icon: React.ElementType; title: string; href: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-300">
        <Icon className="h-3.5 w-3.5" /> {title}
      </h2>
      <Link href={href} className="text-[11px] text-zinc-400 hover:text-zinc-200">
        Open
      </Link>
    </div>
  );
}

function TaskRow({ task, onToggle, showDate }: { task: TodayTask; onToggle: (t: TodayTask) => void; showDate?: boolean }) {
  const done = task.status === "COMPLETED";
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-zinc-950/60">
      <button
        onClick={() => onToggle(task)}
        aria-label={done ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
        className="text-zinc-400 hover:text-blue-500 shrink-0"
      >
        {done ? <CheckCircle2 className="h-4.5 w-4.5 text-blue-500" /> : <Circle className="h-4.5 w-4.5" />}
      </button>
      <span className={`flex-1 truncate text-xs font-medium ${done ? "line-through text-zinc-500" : "text-zinc-200"}`}>
        {task.title}
      </span>
      {task.recurrence && <Repeat className="h-3 w-3 text-zinc-400 shrink-0" aria-label="Repeats" />}
      {task.project && <span className="hidden sm:inline text-[11px] text-zinc-400 truncate max-w-[120px]">{task.project.name}</span>}
      {task.dueTime && <span className="text-[11px] text-zinc-400 shrink-0">{task.dueTime}</span>}
      {showDate && task.dueDate && <span className="text-[11px] text-red-400 shrink-0">{formatDay(task.dueDate)}</span>}
      {task.priority === "CRITICAL" || task.priority === "HIGH" ? (
        <span className={`text-[10px] font-bold shrink-0 ${task.priority === "CRITICAL" ? "text-red-400" : "text-amber-400"}`}>
          {task.priority}
        </span>
      ) : null}
    </div>
  );
}
