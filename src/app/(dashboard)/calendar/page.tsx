"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getCalendarAction, getEventAction, createEvent, updateEvent, deleteEvent } from "@/features/calendar/actions";
import { CalendarDays, ChevronLeft, ChevronRight, Trash2, Clock, Repeat, Download, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "@/stores/toast-store";
import type { CalendarEvent, CalendarTask } from "@/lib/types";
import { getErrorMessage } from "@/lib/utils";
import {
  RECURRENCES,
  addDays,
  addMonths,
  localDateKey,
  utcDateToKey,
  weekday,
  type Recurrence,
} from "@/lib/dates";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const EVENT_COLORS = ["#3b82f6","#8b5cf6","#ef4444","#f59e0b","#10b981","#ec4899","#06b6d4"];
const REPEAT_LABELS: Record<Recurrence, string> = {
  DAILY: "Every day",
  WEEKDAYS: "Every weekday",
  WEEKLY: "Every week",
  MONTHLY: "Every month",
  YEARLY: "Every year",
};

type View = "month" | "week";

type EventForm = {
  id: string | null;
  title: string;
  description: string;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  color: string;
  recurrence: Recurrence | "";
  recurrenceUntil: string;
};

const blankForm = (date: string): EventForm => ({
  id: null,
  title: "",
  description: "",
  date,
  endDate: date,
  startTime: "09:00",
  endTime: "10:00",
  isAllDay: false,
  color: EVENT_COLORS[0],
  recurrence: "",
  recurrenceUntil: "",
});

const sundayOf = (key: string) => addDays(key, -weekday(key));
const pad = (n: number) => String(n).padStart(2, "0");
const timeOf = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Day keys (browser zone) an event occurrence touches. */
function eventDays(ev: CalendarEvent): [string, string] {
  const start = localDateKey(new Date(ev.start));
  // An event ending exactly at midnight doesn't spill into the next day.
  const end = localDateKey(new Date(new Date(ev.end).getTime() - 1));
  return [start, end < start ? start : end];
}

export default function CalendarPage() {
  const confirm = useConfirm();
  const todayKey = localDateKey();
  const [view, setView] = useState<View>("month");
  const [anchor, setAnchor] = useState(todayKey);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [form, setForm] = useState<EventForm | null>(null);
  const [saving, setSaving] = useState(false);

  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  const [year, month] = anchor.split("-").map(Number);
  const monthStart = `${year}-${pad(month)}-01`;
  const rangeStart = view === "month" ? monthStart : sundayOf(anchor);
  const rangeEnd = view === "month" ? addDays(addMonths(monthStart, 1), -1) : addDays(sundayOf(anchor), 6);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getCalendarAction(rangeStart, rangeEnd, browserZone());
      if (cancelled) return;
      if (res.success && res.data) {
        setEvents(res.data.events);
        setTasks(res.data.tasks);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rangeStart, rangeEnd, reloadToken]);

  const step = (dir: 1 | -1) =>
    setAnchor(view === "month" ? addMonths(monthStart, dir) : addDays(anchor, 7 * dir));

  const eventsOn = (day: string) =>
    events.filter((e) => {
      const [s, en] = eventDays(e);
      return day >= s && day <= en;
    });
  const tasksOn = (day: string) => tasks.filter((t) => t.dueDate && utcDateToKey(t.dueDate) === day);

  const openNew = (day: string) => setForm(blankForm(day));

  const openEdit = async (ev: CalendarEvent) => {
    // Occurrences of a repeating event are copies; edit the stored series.
    const res = await getEventAction(ev.eventId);
    if (!res.success || !res.data) {
      toast.error("Couldn't open that event.");
      return;
    }
    const e = res.data;
    const start = new Date(e.startDate);
    const end = new Date(e.endDate);
    setForm({
      id: e.id,
      title: e.title,
      description: e.description ?? "",
      date: localDateKey(start),
      endDate: localDateKey(new Date(end.getTime() - (e.isAllDay ? 1 : 0))),
      startTime: timeOf(start),
      endTime: timeOf(end),
      isAllDay: e.isAllDay,
      color: e.color ?? EVENT_COLORS[0],
      recurrence: (RECURRENCES as readonly string[]).includes(e.recurrence ?? "") ? (e.recurrence as Recurrence) : "",
      recurrenceUntil: e.recurrenceUntil ? utcDateToKey(e.recurrenceUntil) : "",
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !form.title.trim()) return;
    const endDay = form.endDate < form.date ? form.date : form.endDate;
    // Built in the browser's zone and sent as instants.
    const start = form.isAllDay ? new Date(`${form.date}T00:00`) : new Date(`${form.date}T${form.startTime}`);
    const end = form.isAllDay
      ? new Date(`${addDays(endDay, 1)}T00:00`)
      : new Date(`${endDay}T${form.endTime}`);
    if (end < start) {
      toast.error("The event ends before it starts.");
      return;
    }
    const payload = {
      title: form.title,
      description: form.description || undefined,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      isAllDay: form.isAllDay,
      color: form.color,
      recurrence: form.recurrence || null,
      recurrenceUntil: form.recurrence && form.recurrenceUntil ? form.recurrenceUntil : null,
    };
    setSaving(true);
    try {
      if (form.id) await updateEvent(form.id, payload);
      else await createEvent(payload);
      setForm(null);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't save the event."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (eventId: string, title: string, repeating: boolean) => {
    const ok = await confirm({
      title: `Delete "${title}"?`,
      body: repeating ? "This removes every occurrence of the repeating event." : undefined,
      confirmLabel: "Delete event",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteEvent(eventId);
      setForm(null);
      reload();
    } catch {
      toast.error("Couldn't delete the event.");
    }
  };

  const title =
    view === "month"
      ? `${MONTH_NAMES[month - 1]} ${year}`
      : `${new Date(`${rangeStart}T00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(
          `${rangeEnd}T00:00`
        ).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  // Month grid: blanks before the 1st, then each day of the month.
  const monthDays: (string | null)[] = [];
  if (view === "month") {
    for (let i = 0; i < weekday(monthStart); i++) monthDays.push(null);
    for (let d = monthStart; d <= rangeEnd; d = addDays(d, 1)) monthDays.push(d);
  }
  const weekDays = view === "week" ? Array.from({ length: 7 }, (_, i) => addDays(rangeStart, i)) : [];

  const upcoming = events.filter((e) => eventDays(e)[1] >= todayKey);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <CalendarDays className="h-5.5 w-5.5 text-cyan-400" /> Calendar
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-zinc-850 bg-zinc-950 p-0.5 text-xs">
            {(["month", "week"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`h-7 px-3 rounded-md capitalize transition-colors ${
                  view === v ? "bg-zinc-900 text-white" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={() => setAnchor(todayKey)} className="h-8 text-xs border-zinc-800 text-zinc-300">
            Today
          </Button>
          <a
            href="/api/calendar/ics"
            download
            title="Download your events and dated tasks as an .ics file for Google Calendar, Outlook or Apple Calendar"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-zinc-800 text-xs text-zinc-300 hover:text-white hover:border-zinc-700"
          >
            <Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Export</span>
          </a>
          <Button size="sm" onClick={() => openNew(view === "month" && anchor.slice(0, 7) !== todayKey.slice(0, 7) ? monthStart : todayKey)}
            className="h-8 text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-semibold">
            New Event
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between bg-[#171717]/50 border border-zinc-850 rounded-xl p-3">
        <button onClick={() => step(-1)} aria-label={`Previous ${view}`} className="text-zinc-300 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-zinc-900">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <h2 className="text-sm font-bold text-white">{title}</h2>
          <p className="text-[11px] text-zinc-400">
            {events.length} event{events.length === 1 ? "" : "s"} · {tasks.length} task{tasks.length === 1 ? "" : "s"} due
          </p>
        </div>
        <button onClick={() => step(1)} aria-label={`Next ${view}`} className="text-zinc-300 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-zinc-900">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Grid */}
      <div className="border border-zinc-850 rounded-xl overflow-hidden bg-[#171717]/30">
        {/* Week view on phones is a list of days, so no column headers there. */}
        <div className={`${view === "week" ? "hidden sm:grid" : "grid"} grid-cols-7 border-b border-zinc-900`}>
          {(view === "month" ? DAY_LABELS : weekDays.map((d) => `${DAY_LABELS[weekday(d)]} ${Number(d.slice(8))}`)).map((d) => (
            <div key={d} className="p-2 text-center text-[11px] font-bold uppercase tracking-wider text-zinc-400">{d}</div>
          ))}
        </div>
        <div className={`grid ${view === "week" ? "grid-cols-1 sm:grid-cols-7" : "grid-cols-7"}`}>
          {(view === "month" ? monthDays : weekDays).map((day, i) =>
            day === null ? (
              <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-zinc-900/50 bg-zinc-950/30" />
            ) : (
              <DayCell
                key={day}
                day={day}
                tall={view === "week"}
                isToday={day === todayKey}
                events={eventsOn(day)}
                tasks={tasksOn(day)}
                onNew={() => openNew(day)}
                onOpenEvent={openEdit}
              />
            )
          )}
        </div>
      </div>

      {/* Upcoming in this range */}
      {upcoming.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Upcoming</h3>
          <div className="space-y-1.5">
            {upcoming.map((ev) => (
              <div key={ev.key} className="flex items-center gap-3 p-3 bg-[#171717]/50 border border-zinc-850 rounded-lg group">
                <div className="h-2 w-2 rounded-full shrink-0" style={{ background: ev.color || "#3b82f6" }} />
                <button onClick={() => openEdit(ev)} className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-semibold text-zinc-200 truncate flex items-center gap-1.5">
                    {ev.title}
                    {ev.recurrence && <Repeat className="h-3 w-3 text-zinc-400" aria-label="Repeats" />}
                  </p>
                  <p className="text-[11px] text-zinc-400 flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {new Date(ev.start).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    {!ev.isAllDay && <> · {new Date(ev.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</>}
                    {ev.isAllDay && " · All day"}
                  </p>
                </button>
                <button onClick={() => handleDelete(ev.eventId, ev.title, !!ev.recurrence)} aria-label={`Delete ${ev.title}`}
                  className="opacity-0 pointer-coarse:opacity-100 group-hover:opacity-100 focus:opacity-100 text-zinc-400 hover:text-red-400 transition-all p-1">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Event dialog */}
      <Dialog open={form !== null} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="max-w-sm bg-[#171717] border border-zinc-800 p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-white">{form?.id ? "Edit Event" : "New Event"}</DialogTitle>
          </DialogHeader>
          {form && (
            <form onSubmit={handleSave} className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label htmlFor="ev-title" className="text-zinc-300 text-[11px] uppercase font-bold tracking-wider">Event Title</Label>
                <Input id="ev-title" autoFocus placeholder="e.g. Team Meeting" value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="bg-zinc-900/50 border-zinc-800 text-white placeholder-zinc-400 text-xs" required />
              </div>
              <label className="flex items-center gap-2 text-xs text-zinc-300">
                <input type="checkbox" checked={form.isAllDay} onChange={(e) => setForm({ ...form, isAllDay: e.target.checked })}
                  className="h-3.5 w-3.5" />
                All day
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="ev-date" className="text-zinc-300 text-[11px] uppercase font-bold tracking-wider">Starts</Label>
                  <Input id="ev-date" type="date" value={form.date} required
                    onChange={(e) => setForm({ ...form, date: e.target.value, endDate: form.endDate < e.target.value ? e.target.value : form.endDate })}
                    className="bg-zinc-900/50 border-zinc-800 text-white text-xs h-9" />
                  {!form.isAllDay && (
                    <Input type="time" aria-label="Start time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                      className="bg-zinc-900/50 border-zinc-800 text-white text-xs h-9" />
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ev-end" className="text-zinc-300 text-[11px] uppercase font-bold tracking-wider">Ends</Label>
                  <Input id="ev-end" type="date" value={form.endDate} min={form.date}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="bg-zinc-900/50 border-zinc-800 text-white text-xs h-9" />
                  {!form.isAllDay && (
                    <Input type="time" aria-label="End time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                      className="bg-zinc-900/50 border-zinc-800 text-white text-xs h-9" />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="ev-repeat" className="text-zinc-300 text-[11px] uppercase font-bold tracking-wider">Repeat</Label>
                  <select id="ev-repeat" value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value as Recurrence | "" })}
                    className="w-full h-9 px-2 rounded-lg border border-zinc-800 bg-[#1f1f1f] text-xs text-white">
                    <option value="">Doesn&apos;t repeat</option>
                    {RECURRENCES.map((r) => <option key={r} value={r}>{REPEAT_LABELS[r]}</option>)}
                  </select>
                </div>
                {form.recurrence && (
                  <div className="space-y-1">
                    <Label htmlFor="ev-until" className="text-zinc-300 text-[11px] uppercase font-bold tracking-wider">Until (optional)</Label>
                    <Input id="ev-until" type="date" value={form.recurrenceUntil} min={form.date}
                      onChange={(e) => setForm({ ...form, recurrenceUntil: e.target.value })}
                      className="bg-zinc-900/50 border-zinc-800 text-white text-xs h-9" />
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-zinc-300 text-[11px] uppercase font-bold tracking-wider">Color</Label>
                <div className="flex gap-2">
                  {EVENT_COLORS.map((c) => (
                    <button key={c} type="button" aria-label={`Color ${c}`} onClick={() => setForm({ ...form, color: c })}
                      className={`h-6 w-6 rounded-full transition-transform ${form.color === c ? "scale-125 ring-2 ring-white/30" : "hover:scale-110"}`}
                      style={{ background: c }} />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-900">
                {form.id ? (
                  <button type="button" onClick={() => handleDelete(form.id!, form.title, !!form.recurrence)}
                    className="text-xs text-red-400 hover:text-red-300">Delete</button>
                ) : <span />}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setForm(null)}
                    className="border-zinc-800 text-zinc-300 text-xs h-8">Cancel</Button>
                  <Button type="submit" disabled={saving} className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold h-8">
                    {saving ? "Saving..." : form.id ? "Save" : "Create Event"}
                  </Button>
                </div>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DayCell({
  day,
  tall,
  isToday,
  events,
  tasks,
  onNew,
  onOpenEvent,
}: {
  day: string;
  tall: boolean;
  isToday: boolean;
  events: CalendarEvent[];
  tasks: CalendarTask[];
  onNew: () => void;
  onOpenEvent: (ev: CalendarEvent) => void;
}) {
  const limit = tall ? 50 : 3;
  const items = events.length + tasks.length;
  return (
    // A div rather than a button: event chips inside are buttons themselves.
    <div
      role="button"
      tabIndex={0}
      onClick={onNew}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onNew();
        }
      }}
      aria-label={`${day}${items ? `, ${items} item${items === 1 ? "" : "s"}` : ""}. Add event`}
      className={`${tall ? "min-h-[64px] sm:min-h-[320px]" : "min-h-[80px]"} w-full border-b border-r border-zinc-900/50 p-1.5 text-left transition-colors hover:bg-zinc-900/30 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-500 ${
        isToday ? "bg-blue-950/20" : ""
      }`}
    >
      <span className={`text-xs font-semibold inline-flex h-5 w-5 items-center justify-center rounded-full ${
        isToday ? "bg-blue-500 text-white" : "text-zinc-300"
      }`}>
        {Number(day.slice(8))}
      </span>
      {tall && (
        <span className="ml-1.5 text-xs font-semibold text-zinc-400 sm:hidden">
          {new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })}
        </span>
      )}
      {/* Phones, month view: a dot per item; the names don't fit in a cell
          that narrow, and the list under the grid has them. */}
      {!tall && items > 0 && (
        <div className="mt-1 flex flex-wrap gap-0.5 sm:hidden" aria-hidden>
          {events.slice(0, 6).map((ev) => (
            <span key={ev.key} className="h-1.5 w-1.5 rounded-full" style={{ background: ev.color || "#3b82f6" }} />
          ))}
          {tasks.slice(0, Math.max(0, 6 - events.length)).map((t) => (
            <span key={t.id} className={`h-1.5 w-1.5 rounded-full border ${t.status === "COMPLETED" ? "border-zinc-600" : "border-zinc-300"}`} />
          ))}
        </div>
      )}
      <div className={`mt-0.5 space-y-0.5 ${tall ? "" : "hidden sm:block"}`}>
        {events.slice(0, limit).map((ev) => (
          <button
            key={ev.key}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenEvent(ev);
            }}
            className="w-full text-left text-[11px] px-1 py-0.5 rounded truncate font-medium flex items-center gap-1"
            style={{ background: `${ev.color || "#3b82f6"}20`, color: ev.color || "#3b82f6" }}
          >
            {!ev.isAllDay && tall && (
              <span className="opacity-80">{new Date(ev.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
            )}
            <span className="truncate">{ev.title}</span>
          </button>
        ))}
        {tasks.slice(0, Math.max(0, limit - events.length)).map((t) => (
          <Link
            key={t.id}
            href="/tasks"
            onClick={(e) => e.stopPropagation()}
            className={`flex items-center gap-1 text-[11px] px-1 py-0.5 rounded truncate ${
              t.status === "COMPLETED" ? "text-zinc-500 line-through" : "text-zinc-300"
            }`}
            title={`Task: ${t.title}`}
          >
            {t.status === "COMPLETED" ? <CheckCircle2 className="h-3 w-3 shrink-0" /> : <Circle className="h-3 w-3 shrink-0" />}
            <span className="truncate">{t.title}</span>
          </Link>
        ))}
        {items > limit && <span className="text-[11px] text-zinc-400">+{items - limit} more</span>}
      </div>
    </div>
  );
}
