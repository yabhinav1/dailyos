"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getHabitsAction, createHabit, deleteHabit, logHabit } from "@/features/habits/actions";
import { Flame, Plus, Trash2, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { SkeletonCards } from "@/components/ui/skeleton";
import type { Habit, HabitLog } from "@/lib/types";
import { toDateKey } from "@/lib/utils";

function generateLast30Days(): string[] {
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

const DAYS_30 = generateLast30Days();

export default function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newFreq, setNewFreq] = useState<"DAILY" | "WEEKLY" | "MONTHLY">("DAILY");
  const [saving, setSaving] = useState(false);

  const [reloadToken, setReloadToken] = useState(0);
  const reloadHabits = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await getHabitsAction();
      if (cancelled) return;
      if (res.success && res.data) setHabits(res.data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    await createHabit({ name: newName, description: newDesc || undefined, frequency: newFreq });
    setNewName(""); setNewDesc(""); setNewFreq("DAILY");
    setShowCreate(false);
    setSaving(false);
    reloadHabits();
  };

  const handleToggleLog = async (habitId: string, date: string) => {
    await logHabit(habitId, date);
    reloadHabits();
  };

  const handleDelete = async (habitId: string, name: string) => {
    if (!confirm(`Delete habit "${name}"?`)) return;
    await deleteHabit(habitId);
    reloadHabits();
  };

  const today = new Date().toISOString().split("T")[0];
  const todayCompletedCount = habits.filter((h) =>
    h.logs.some((l: HabitLog) => toDateKey(l.date) === today && l.completed)
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Flame className="h-5.5 w-5.5 text-orange-400" />
            Habits Tracker
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Build consistent habits.{" "}
            <span className="text-orange-400 font-semibold">{todayCompletedCount}/{habits.length}</span> completed today.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}
          className="bg-orange-500 hover:bg-orange-400 text-white gap-1 text-xs font-semibold h-8 shrink-0">
          <Plus className="h-3.5 w-3.5" /> New Habit
        </Button>
      </div>

      {/* Summary Cards */}
      {habits.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Habits", value: habits.length, color: "text-zinc-300" },
            { label: "Best Streak", value: `${Math.max(...habits.map((h) => h.maxStreak), 0)}d`, color: "text-amber-400" },
            { label: "Today Done", value: `${todayCompletedCount}/${habits.length}`, color: "text-emerald-400" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-zinc-850 bg-[#171717]/50 p-4 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Habit Grid */}
      {loading ? (
        <SkeletonCards cards={6} />
      ) : habits.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-zinc-850 rounded-xl">
          <Flame className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm font-semibold text-zinc-400">No habits tracked yet</p>
          <p className="text-xs text-zinc-500 mt-1">Start small. Build something sustainable.</p>
          <Button size="sm" onClick={() => setShowCreate(true)} className="mt-4 bg-orange-500 hover:bg-orange-400 text-white text-xs gap-1">
            <Plus className="h-3.5 w-3.5" /> Add First Habit
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {habits.map((habit) => {
            const completedDates = new Set(habit.logs.map((l: HabitLog) => toDateKey(l.date)));
            const isCompletedToday = completedDates.has(today);

            return (
              <Card key={habit.id} className="border-zinc-850 bg-[#0C0C0E]/40 hover:border-zinc-800 transition-all">
                <CardContent className="p-4 space-y-3">
                  {/* Habit Header */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => handleToggleLog(habit.id, today)}
                        className="shrink-0 transition-colors"
                      >
                        {isCompletedToday
                          ? <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                          : <Circle className="h-5 w-5 text-zinc-600 hover:text-emerald-400" />}
                      </button>
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold ${isCompletedToday ? "line-through text-zinc-500" : "text-zinc-100"}`}>
                          {habit.name}
                        </p>
                        {habit.description && (
                          <p className="text-[11px] text-zinc-500 truncate">{habit.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-orange-400 font-bold text-sm">
                          <Flame className="h-3.5 w-3.5" />
                          {habit.streak}
                        </div>
                        <div className="text-[9px] text-zinc-600">streak</div>
                      </div>
                      <button
                        onClick={() => handleDelete(habit.id, habit.name)}
                        className="text-zinc-700 hover:text-red-400 transition-colors p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 30-Day Grid */}
                  <div className="flex gap-[2px] flex-wrap">
                    {DAYS_30.map((day) => {
                      const done = completedDates.has(day);
                      const isToday = day === today;
                      return (
                        <button
                          key={day}
                          title={day}
                          onClick={() => handleToggleLog(habit.id, day)}
                          className={`h-[14px] w-[14px] rounded-sm transition-colors ${
                            done ? "bg-emerald-500" : "bg-zinc-800 hover:bg-zinc-700"
                          } ${isToday ? "ring-1 ring-white/30 ring-offset-1 ring-offset-[#171717]" : ""}`}
                        />
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm bg-[#171717] border border-zinc-800 p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-white">New Habit</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">Habit Name</Label>
              <Input autoFocus placeholder="e.g. Morning workout" value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-zinc-900/50 border-zinc-800 focus:border-zinc-700 text-white placeholder-zinc-500 text-xs"
                required disabled={saving} />
            </div>
            <div className="space-y-1">
              <Label className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">Description (optional)</Label>
              <Input placeholder="30 min cardio or weights" value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="bg-zinc-900/50 border-zinc-800 focus:border-zinc-700 text-white placeholder-zinc-500 text-xs"
                disabled={saving} />
            </div>
            <div className="space-y-1">
              <Label className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">Frequency</Label>
              <select value={newFreq} onChange={(e) => setNewFreq(e.target.value as "DAILY" | "WEEKLY" | "MONTHLY")}
                className="w-full h-9 px-3 rounded-lg border border-zinc-800 bg-[#1f1f1f] text-xs text-white focus:border-zinc-700 focus:outline-none">
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-900">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}
                className="border-zinc-800 hover:bg-zinc-900 text-zinc-400 text-xs h-8" disabled={saving}>Cancel</Button>
              <Button type="submit"
                className="bg-orange-500 hover:bg-orange-400 text-white text-xs font-semibold h-8" disabled={saving}>
                {saving ? "Saving..." : "Add Habit"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
