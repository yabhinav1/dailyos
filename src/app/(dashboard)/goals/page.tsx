"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getGoalsAction, createGoal, updateGoalProgress, deleteGoal } from "@/features/goals/actions";
import { Target, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import type { Goal, GoalTimeframe } from "@/lib/types";

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<{ title: string; description: string; targetDate: string; timeframe: GoalTimeframe }>(
    { title: "", description: "", targetDate: "", timeframe: "MONTHLY" }
  );
  const [saving, setSaving] = useState(false);

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    const res = await getGoalsAction();
    if (res.success && res.data) setGoals(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    await createGoal({ ...form, description: form.description || undefined, targetDate: form.targetDate || null });
    setForm({ title: "", description: "", targetDate: "", timeframe: "MONTHLY" });
    setShowCreate(false);
    setSaving(false);
    fetchGoals();
  };

  const handleProgressChange = async (goalId: string, progress: number) => {
    await updateGoalProgress(goalId, Math.min(100, Math.max(0, progress)));
    fetchGoals();
  };

  const handleDelete = async (goalId: string, title: string) => {
    if (!confirm(`Delete goal "${title}"?`)) return;
    await deleteGoal(goalId);
    fetchGoals();
  };

  const activeGoals = goals.filter((g) => !g.isCompleted);
  const completedGoals = goals.filter((g) => g.isCompleted);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Target className="h-5.5 w-5.5 text-emerald-400" /> Goals
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            {activeGoals.length} active · {completedGoals.length} completed
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1 text-xs font-semibold h-8 shrink-0">
          <Plus className="h-3.5 w-3.5" /> New Goal
        </Button>
      </div>

      {loading ? (
        <div className="py-24 text-center">
          <Loader />
        </div>
      ) : goals.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-zinc-850 rounded-xl">
          <Target className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm font-semibold text-zinc-400">No goals set yet</p>
          <p className="text-xs text-zinc-500 mt-1">Define clear goals to track your long-term growth</p>
          <Button size="sm" onClick={() => setShowCreate(true)} className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1">
            <Plus className="h-3.5 w-3.5" /> Set First Goal
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {activeGoals.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Active Goals</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {activeGoals.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} onProgressChange={handleProgressChange} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          )}
          {completedGoals.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">🎉 Completed</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 opacity-60">
                {completedGoals.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} onProgressChange={handleProgressChange} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm bg-[#171717] border border-zinc-800 p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-white">New Goal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">Goal Title</Label>
              <Input autoFocus placeholder="e.g. Complete DSA Roadmap" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="bg-zinc-900/50 border-zinc-800 text-white placeholder-zinc-500 text-xs" required disabled={saving} />
            </div>
            <div className="space-y-1">
              <Label className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">Description</Label>
              <Textarea placeholder="Why is this important?" value={form.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, description: e.target.value })}
                className="bg-zinc-900/50 border-zinc-800 text-white placeholder-zinc-500 text-xs min-h-[60px]" disabled={saving} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">Timeframe</Label>
                <select value={form.timeframe} onChange={(e) => setForm({ ...form, timeframe: e.target.value as GoalTimeframe })}
                  className="w-full h-9 px-3 rounded-lg border border-zinc-800 bg-[#1f1f1f] text-xs text-white">
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="YEARLY">Yearly</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">Target Date</Label>
                <Input type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
                  className="bg-zinc-900/50 border-zinc-800 text-white text-xs h-9" disabled={saving} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-900">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}
                className="border-zinc-800 text-zinc-400 text-xs h-8">Cancel</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold h-8" disabled={saving}>
                {saving ? "Saving..." : "Create Goal"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function GoalCard({ goal, onProgressChange, onDelete }: { goal: Goal; onProgressChange: (id: string, p: number) => void; onDelete: (id: string, t: string) => void }) {
  const [localProgress, setLocalProgress] = useState(goal.progress);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setLocalProgress(val);
  };

  const handleSliderRelease = () => {
    if (localProgress !== goal.progress) onProgressChange(goal.id, localProgress);
  };

  return (
    <Card className="border-zinc-850 bg-[#0C0C0E]/40 hover:border-zinc-800 transition-all">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={`text-sm font-semibold ${goal.isCompleted ? "line-through text-zinc-500" : "text-zinc-100"}`}>{goal.title}</p>
            {goal.description && <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">{goal.description}</p>}
          </div>
          <button onClick={() => onDelete(goal.id, goal.title)} className="text-zinc-700 hover:text-red-400 transition-colors p-1 shrink-0">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-zinc-500 uppercase font-bold tracking-wider">{goal.timeframe}</span>
            <span className={`font-bold ${localProgress >= 100 ? "text-emerald-400" : localProgress > 50 ? "text-blue-400" : "text-amber-400"}`}>
              {localProgress}%
            </span>
          </div>
          <div className="relative h-2 w-full rounded-full bg-zinc-900">
            <div className={`absolute h-full rounded-full transition-all duration-300 ${
              localProgress >= 100 ? "bg-emerald-500" : localProgress > 50 ? "bg-blue-500" : "bg-amber-500"
            }`} style={{ width: `${localProgress}%` }} />
          </div>
          <input type="range" min="0" max="100" value={localProgress}
            onChange={handleSliderChange} onMouseUp={handleSliderRelease} onTouchEnd={handleSliderRelease}
            className="w-full h-1 bg-transparent appearance-none cursor-pointer accent-blue-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow" />
        </div>

        {goal.targetDate && (
          <div className="text-[10px] text-zinc-600">
            Target: {new Date(goal.targetDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
