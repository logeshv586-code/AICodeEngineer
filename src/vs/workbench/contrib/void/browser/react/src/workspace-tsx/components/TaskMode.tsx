/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useCallback } from 'react';
import { CheckCircle2, Circle, Clock, Zap, ChevronDown, ChevronRight } from 'lucide-react';

export type TaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  subtasks?: TaskItem[];
  createdAt: number;
  completedAt?: number;
}

interface TaskModeProps {
  enabled: boolean;
  tasks: TaskItem[];
  onToggle: () => void;
  onAddTask?: (title: string) => void;
  onUpdateTask?: (id: string, updates: Partial<TaskItem>) => void;
  onCompleteTask?: (id: string) => void;
  disabled?: boolean;
}

const statusIcon: Record<TaskStatus, React.ReactNode> = {
  pending: <Circle size={13} className="text-zinc-500 flex-shrink-0" />,
  running: <Clock size={13} className="text-blue-400 flex-shrink-0 animate-spin" />,
  done: <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />,
  failed: <Circle size={13} className="text-red-400 flex-shrink-0" />,
  skipped: <Circle size={13} className="text-zinc-600 flex-shrink-0" />,
};

const statusTextColor: Record<TaskStatus, string> = {
  pending: 'text-zinc-500',
  running: 'text-zinc-200 font-medium',
  done: 'text-zinc-400 line-through opacity-70',
  failed: 'text-red-400',
  skipped: 'text-zinc-600 line-through',
};

export const TaskMode: React.FC<TaskModeProps> = ({
  enabled,
  tasks,
  onToggle,
  onAddTask,
  onUpdateTask,
  onCompleteTask,
  disabled = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const handleAddTask = useCallback(() => {
    if (!newTaskTitle.trim() || !onAddTask) return;
    onAddTask(newTaskTitle.trim());
    setNewTaskTitle('');
  }, [newTaskTitle, onAddTask]);

  if (!enabled) {
    return (
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors cursor-pointer disabled:opacity-30"
        title="Enable Task Mode"
      >
        <Zap size={14} />
        <span>Tasks</span>
      </button>
    );
  }

  const doneCount = tasks.filter(t => t.status === 'done').length;
  const totalCount = tasks.length;
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="flex flex-col gap-1 p-2 rounded-lg bg-zinc-900/60 border border-zinc-700/60">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsExpanded(v => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-zinc-300 hover:text-zinc-200 transition-colors cursor-pointer"
        >
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <Zap size={12} className="text-emerald-400" />
          <span>Tasks</span>
          <span className="text-zinc-500">{doneCount}/{totalCount}</span>
        </button>
      </div>

      {isExpanded && (
        <>
          {/* Progress bar */}
          <div className="h-1 bg-zinc-700/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500/70 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Task list */}
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
            {tasks.map(task => (
              <div
                key={task.id}
                className="flex items-start gap-2 py-0.5"
              >
                <div className="mt-0.5">{statusIcon[task.status]}</div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className={`leading-tight text-xs ${statusTextColor[task.status]}`}>
                    {task.title}
                  </span>
                  {task.description && task.status === 'running' && (
                    <span className="text-zinc-500 text-[10px] leading-tight mt-0.5 truncate">
                      {task.description}
                    </span>
                  )}
                </div>
                {task.status === 'pending' && onCompleteTask && (
                  <button
                    type="button"
                    onClick={() => onCompleteTask(task.id)}
                    className="text-zinc-600 hover:text-zinc-400 transition-colors"
                    title="Mark as done"
                  >
                    <CheckCircle2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add task */}
          {onAddTask && (
            <div className="flex gap-1">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Add task..."
                className="flex-1 bg-zinc-800 text-zinc-200 text-xs rounded px-2 py-1 border border-zinc-700/60 focus:border-zinc-500 outline-none placeholder:text-zinc-600"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddTask();
                  }
                }}
                disabled={disabled}
              />
              <button
                type="button"
                onClick={handleAddTask}
                disabled={disabled || !newTaskTitle.trim()}
                className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors disabled:opacity-30 cursor-pointer"
              >
                +
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
