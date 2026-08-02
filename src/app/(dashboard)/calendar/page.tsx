"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getEventsAction, createEvent, deleteEvent } from "@/features/calendar/actions";
import { CalendarDays, ChevronLeft, ChevronRight, Trash2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CalendarEvent } from "@/lib/types";
import { toDateKey } from "@/lib/utils";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const EVENT_COLORS = ["#3b82f6","#8b5cf6","#ef4444","#f59e0b","#10b981","#ec4899","#06b6d4"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [form, setForm] = useState({ title: "", description: "", startTime: "09:00", endTime: "10:00", color: EVENT_COLORS[0] });

  const fetchEvents = useCallback(async () => {
    const res = await getEventsAction(year, month);
    if (res.success && res.data) setEvents(res.data);
  }, [year, month]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return events.filter((e) => {
      const start = toDateKey(e.startDate);
      const end = toDateKey(e.endDate);
      return dateStr >= start && dateStr <= end;
    });
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !selectedDay) return;
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;
    await createEvent({
      title: form.title,
      description: form.description || undefined,
      startDate: `${dateStr}T${form.startTime}:00`,
      endDate: `${dateStr}T${form.endTime}:00`,
      color: form.color,
      isAllDay: false,
    });
    setForm({ title: "", description: "", startTime: "09:00", endTime: "10:00", color: EVENT_COLORS[0] });
    setShowCreate(false);
    setSelectedDay(null);
    fetchEvents();
  };

  const handleDeleteEvent = async (eventId: string) => {
    await deleteEvent(eventId);
    fetchEvents();
  };

  const handleDayClick = (day: number) => {
    setSelectedDay(day);
    setShowCreate(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <CalendarDays className="h-5.5 w-5.5 text-cyan-400" /> Calendar
        </h1>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between bg-[#171717]/50 border border-zinc-850 rounded-xl p-3">
        <button onClick={prevMonth} className="text-zinc-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-zinc-900">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <h2 className="text-sm font-bold text-white">{MONTH_NAMES[month]} {year}</h2>
          <p className="text-[10px] text-zinc-500">{events.length} events this month</p>
        </div>
        <button onClick={nextMonth} className="text-zinc-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-zinc-900">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="border border-zinc-850 rounded-xl overflow-hidden bg-[#171717]/30">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-zinc-900">
          {DAY_LABELS.map((d) => (
            <div key={d} className="p-2 text-center text-[10px] font-bold uppercase tracking-wider text-zinc-600">{d}</div>
          ))}
        </div>

        {/* Day Cells */}
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-zinc-900/50 bg-zinc-950/30" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isToday = dayStr === todayStr;
            const dayEvents = getEventsForDay(day);

            return (
              <div
                key={day}
                onClick={() => handleDayClick(day)}
                className={`min-h-[80px] border-b border-r border-zinc-900/50 p-1.5 cursor-pointer transition-colors hover:bg-zinc-900/30 ${
                  isToday ? "bg-blue-950/20" : ""
                }`}
              >
                <span className={`text-[11px] font-semibold inline-flex h-5 w-5 items-center justify-center rounded-full ${
                  isToday ? "bg-blue-500 text-white" : "text-zinc-400"
                }`}>
                  {day}
                </span>
                <div className="mt-0.5 space-y-0.5">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <div key={ev.id} className="text-[9px] px-1 py-0.5 rounded truncate font-medium"
                      style={{ background: `${ev.color || "#3b82f6"}20`, color: ev.color || "#3b82f6" }}>
                      {ev.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="text-[9px] text-zinc-500">+{dayEvents.length - 3} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming Events List */}
      {events.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Events This Month</h3>
          <div className="space-y-1.5">
            {events.map((ev) => (
              <div key={ev.id} className="flex items-center gap-3 p-3 bg-[#171717]/50 border border-zinc-850 rounded-lg group">
                <div className="h-2 w-2 rounded-full shrink-0" style={{ background: ev.color || "#3b82f6" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-zinc-200 truncate">{ev.title}</p>
                  <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {new Date(ev.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {" · "}
                    {new Date(ev.startDate).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <button onClick={() => handleDeleteEvent(ev.id)}
                  className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all p-1">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Event Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) setSelectedDay(null); }}>
        <DialogContent className="max-w-sm bg-[#171717] border border-zinc-800 p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-white">
              New Event — {selectedDay && `${MONTH_NAMES[month]} ${selectedDay}`}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateEvent} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">Event Title</Label>
              <Input autoFocus placeholder="e.g. Team Meeting" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="bg-zinc-900/50 border-zinc-800 text-white placeholder-zinc-500 text-xs" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">Start</Label>
                <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  className="bg-zinc-900/50 border-zinc-800 text-white text-xs h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">End</Label>
                <Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  className="bg-zinc-900/50 border-zinc-800 text-white text-xs h-9" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">Color</Label>
              <div className="flex gap-2">
                {EVENT_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                    className={`h-6 w-6 rounded-full transition-transform ${form.color === c ? "scale-125 ring-2 ring-white/30" : "hover:scale-110"}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-900">
              <Button type="button" variant="outline" onClick={() => { setShowCreate(false); setSelectedDay(null); }}
                className="border-zinc-800 text-zinc-400 text-xs h-8">Cancel</Button>
              <Button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold h-8">Create Event</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
