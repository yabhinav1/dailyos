"use client";

import React from "react";
import { TaskStatus } from "@prisma/client";
import { updateTask } from "@/features/tasks/actions";
import { DndContext, DragEndEvent, useSensor, useSensors, PointerSensor } from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import TaskCard from "./task-card";
import type { Task } from "@/lib/types";

interface TaskKanbanProps {
  tasks: Task[];
  onRefresh: () => void;
  projects?: { id: string; name: string }[];
}

const COLUMNS = [
  { id: TaskStatus.BACKLOG, title: "Backlog", color: "bg-zinc-800/40" },
  { id: TaskStatus.TODO, title: "Todo", color: "bg-blue-500/5 border-blue-500/10" },
  { id: TaskStatus.IN_PROGRESS, title: "In Progress", color: "bg-amber-500/5 border-amber-500/10" },
  { id: TaskStatus.REVIEW, title: "Review", color: "bg-purple-500/5 border-purple-500/10" },
  { id: TaskStatus.COMPLETED, title: "Completed", color: "bg-emerald-500/5 border-emerald-500/10" },
];

export default function TaskKanban({ tasks, onRefresh, projects = [] }: TaskKanbanProps) {
  // Setup pointer sensor for drag actions
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Drag starts after moving 8px, allows clicking dropdown menus without starting a drag!
      },
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const targetStatus = over.id as TaskStatus;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetStatus) return;

    // Trigger Server Action update
    try {
      await updateTask(taskId, { status: targetStatus });
      onRefresh();
    } catch (err) {
      console.error("Failed to update status on drag-end:", err);
    }
  };

  // Group tasks by status
  const tasksByColumn = COLUMNS.reduce((acc, col) => {
    acc[col.id] = tasks.filter((t) => t.status === col.id);
    return acc;
  }, {} as Record<TaskStatus, Task[]>);

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5 h-full min-h-[500px]">
        {COLUMNS.map((col) => (
          <DroppableColumn key={col.id} id={col.id} title={col.title} color={col.color} count={tasksByColumn[col.id].length}>
            <div className="space-y-3">
              {tasksByColumn[col.id].map((task) => (
                <DraggableWrapper key={task.id} id={task.id}>
                  <TaskCard task={task} onRefresh={onRefresh} projects={projects} />
                </DraggableWrapper>
              ))}
            </div>
          </DroppableColumn>
        ))}
      </div>
    </DndContext>
  );
}

// Droppable Column Component
interface ColumnProps {
  id: TaskStatus;
  title: string;
  color: string;
  count: number;
  children: React.ReactNode;
}

function DroppableColumn({ id, title, color, count, children }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl border border-zinc-900 bg-zinc-950/40 p-3 h-full min-h-[400px] transition-colors duration-200 ${color} ${
        isOver ? "border-blue-500/30 bg-blue-500/[0.02]" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-4 px-1">
        <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">{title}</h3>
        <span className="text-[10px] font-bold text-zinc-500 bg-zinc-900 border border-zinc-850 px-2 py-0.5 rounded-full">
          {count}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto min-h-[300px]">
        {children}
      </div>
    </div>
  );
}

// Draggable Wrapper Component
interface DraggableWrapperProps {
  id: string;
  children: React.ReactNode;
}

function DraggableWrapper({ id, children }: DraggableWrapperProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    opacity: isDragging ? 0.4 : undefined,
    cursor: "grab",
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {children}
    </div>
  );
}
