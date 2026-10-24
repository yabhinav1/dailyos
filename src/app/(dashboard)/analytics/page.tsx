"use client";

import React, { useState, useEffect } from "react";
import { getAnalyticsData } from "@/features/analytics/actions";
import { BarChart3, Calendar, BookOpen, Target, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SkeletonCards, SkeletonStats } from "@/components/ui/skeleton";
import type { AnalyticsData, HabitStat, StudyStat } from "@/lib/types";

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getAnalyticsData();
      if (cancelled) return;
      if (res.success && res.data) setData(res.data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonStats tiles={4} />
        <SkeletonCards cards={2} />
      </div>
    );
  }

  if (!data) return null;

  const taskCompletionRate = data.tasks.total > 0 ? Math.round((data.tasks.completed / data.tasks.total) * 100) : 0;
  const goalCompletionRate = data.goals.total > 0 ? Math.round((data.goals.completed / data.goals.total) * 100) : 0;

  // Max values for chart height calculations
  const maxHabitCheckins = Math.max(...data.habitStats.map((d: HabitStat) => d.count), 1);
  const maxStudyHours = Math.max(...data.studyStats.map((d: StudyStat) => d.hours), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <BarChart3 className="h-5.5 w-5.5 text-violet-400" /> Performance Analytics
        </h1>
        <p className="text-xs text-zinc-300 mt-1">Real-time statistics of your habits, focus time, and productivity metrics.</p>
      </div>

      {/* Numerical Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Tasks Done", value: `${data.tasks.completed}/${data.tasks.total}`, rate: `${taskCompletionRate}% rate`, color: "text-blue-400", icon: CheckCircle2 },
          { label: "Goals Reached", value: `${data.goals.completed}/${data.goals.total}`, rate: `${goalCompletionRate}% rate`, color: "text-emerald-400", icon: Target },
          { label: "Habits Tracked", value: data.habitsCount, rate: "active logs", color: "text-orange-400", icon: Calendar },
          { label: "Study Focus Weeks", value: `${data.studyStats.reduce((acc: number, cur: StudyStat) => acc + cur.hours, 0)} hrs`, rate: "focus time", color: "text-indigo-400", icon: BookOpen },
        ].map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <Card key={idx} className="border-zinc-850 bg-[#0C0C0E]/40 hover:border-zinc-800 transition-all">
              <CardContent className="p-3 sm:p-4 flex items-center justify-between gap-2 sm:gap-4">
                <div className="space-y-1 min-w-0">
                  <span className="text-[11px] text-zinc-400 uppercase font-bold tracking-wider">{stat.label}</span>
                  <p className="text-lg font-bold text-white">{stat.value}</p>
                  <p className={`text-[11px] font-semibold ${stat.color}`}>{stat.rate}</p>
                </div>
                <div className="hidden sm:block p-2 bg-zinc-900 rounded-lg shrink-0">
                  <Icon className="h-4 w-4 text-zinc-300" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Visual Heatmaps and Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Habit completions chart */}
        <Card className="border-zinc-850 bg-[#0C0C0E]/40 p-5 space-y-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">Habit Check-ins (Last 7 Days)</h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">Total completed habits logged per day</p>
          </div>
          <div className="h-48 flex items-end gap-3 pt-6 border-b border-zinc-900/60 pb-1">
            {data.habitStats.map((item: HabitStat, idx: number) => {
              const pct = (item.count / maxHabitCheckins) * 100;
              const dateObj = new Date(item.day);
              const label = dateObj.toLocaleDateString("en-US", { weekday: "short" });

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                  <div className="w-full bg-zinc-900 rounded-t-sm flex items-end justify-center min-h-[4px]" style={{ height: `${pct || 5}%` }}>
                    <div className="w-full bg-orange-500/80 group-hover:bg-orange-400 rounded-t-sm transition-all duration-300" style={{ height: "100%" }} />
                  </div>
                  <div className="text-[11px] text-zinc-400 font-medium">{label}</div>
                  <div className="text-[11px] text-white opacity-0 group-hover:opacity-100 transition-opacity absolute -translate-y-8 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 font-bold">{item.count}</div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Study Hours chart */}
        <Card className="border-zinc-850 bg-[#0C0C0E]/40 p-5 space-y-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">Study Focus (Last 7 Days)</h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">Total focus hours logged per day</p>
          </div>
          <div className="h-48 flex items-end gap-3 pt-6 border-b border-zinc-900/60 pb-1">
            {data.studyStats.map((item: StudyStat, idx: number) => {
              const pct = (item.hours / maxStudyHours) * 100;
              const dateObj = new Date(item.day);
              const label = dateObj.toLocaleDateString("en-US", { weekday: "short" });

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                  <div className="w-full bg-zinc-900 rounded-t-sm flex items-end justify-center min-h-[4px]" style={{ height: `${pct || 5}%` }}>
                    <div className="w-full bg-indigo-500/80 group-hover:bg-indigo-400 rounded-t-sm transition-all duration-300" style={{ height: "100%" }} />
                  </div>
                  <div className="text-[11px] text-zinc-400 font-medium">{label}</div>
                  <div className="text-[11px] text-white opacity-0 group-hover:opacity-100 transition-opacity absolute -translate-y-8 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 font-bold">{item.hours}h</div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
