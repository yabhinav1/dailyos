"use client";

import { useEffect, useState } from "react";
import { getActiveProjectsListAction } from "@/features/projects/actions";
import { getGoalOptionsAction } from "@/features/goals/actions";
import { getTagsAction } from "@/features/tasks/actions";

export type TaskOptions = {
  projects: { id: string; name: string }[];
  goals: { id: string; title: string }[];
  tags: string[];
};

const EMPTY: TaskOptions = { projects: [], goals: [], tags: [] };

/**
 * Pickers for the task form. Loaded by the form itself so every place that
 * opens it gets the same choices — the tasks page never passed projects in,
 * so its project picker never appeared.
 */
export function useTaskOptions(): TaskOptions {
  const [options, setOptions] = useState<TaskOptions>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [projects, goals, tags] = await Promise.all([
        getActiveProjectsListAction(),
        getGoalOptionsAction(),
        getTagsAction(),
      ]);
      if (cancelled) return;
      setOptions({
        projects: projects.success && projects.data ? projects.data : [],
        goals: goals.success && goals.data ? goals.data : [],
        tags: tags.success && tags.data ? tags.data.map((t) => t.name) : [],
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return options;
}
