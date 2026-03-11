/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, closestCorners, useSensor, useSensors } from '@dnd-kit/core';
import { useCallback, useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { HorizonView, getColumnTaskCounts, triggerTaskClick, bulkSelectionTrigger } from './components/HorizonView';
import { PomodoroBar } from './components/PomodoroBar';
import { Task } from './store';
import { useStore, THEMES, deriveThemeFromAccent } from './store';
import { newProjectTrigger } from './components/MacroGoalsPanel';
import { getHoveredTaskId } from './components/DraggableTask';
import { KeyboardShortcuts } from './components/KeyboardShortcuts';
import { CommandPalette } from './components/CommandPalette';
import { ToastProvider } from './components/Toast';

export default function App() {
  const { tasks, projects, updateTask, reorderTask, theme, customAccent, undo } = useStore();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [infoToast, setInfoToast] = useState<string | null>(null);

  // Keyboard navigation state
  const [focusedColumn, setFocusedColumn] = useState<number | null>(null);
  const [focusedTask, setFocusedTask] = useState<number>(0);

  const clearNavFocus = useCallback(() => {
    setFocusedColumn(null);
    setFocusedTask(0);
  }, []);

  // Listen for info-only toast events fired by child components (e.g. drag warnings)
  useEffect(() => {
    const handler = (e: Event) => {
      const msg = (e as CustomEvent<string>).detail;
      setInfoToast(msg);
      setTimeout(() => setInfoToast(null), 3000);
    };
    window.addEventListener('horizon:toast', handler);
    return () => window.removeEventListener('horizon:toast', handler);
  }, []);

  // Apply theme CSS vars to root
  useEffect(() => {
    const t = customAccent ? deriveThemeFromAccent(customAccent) : (THEMES[theme] ?? THEMES.void);
    const r = document.documentElement;
    r.style.setProperty('--accent', t.accent);
    r.style.setProperty('--bg-0', t.bg0);
    r.style.setProperty('--bg-1', t.bg1);
    r.style.setProperty('--bg-2', t.bg2);
    r.style.setProperty('--border-1', t.border);
    r.style.setProperty('--text-1', t.text1);
    r.style.setProperty('--text-2', t.text2);
    document.documentElement.setAttribute('data-theme', customAccent ? 'custom' : theme);
  }, [theme, customAccent]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      // Arrow key navigation
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) {
        const counts = getColumnTaskCounts();
        const totalCols = counts.length;
        if (totalCols === 0) return;

        if (e.key === 'Escape') {
          clearNavFocus();
          bulkSelectionTrigger.clear();
          return;
        }

        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          setFocusedColumn(prev => {
            if (prev === null) return 0;
            const next = e.key === 'ArrowRight'
              ? Math.min(prev + 1, totalCols - 1)
              : Math.max(prev - 1, 0);
            return next;
          });
          setFocusedTask(0);
          return;
        }

        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          setFocusedColumn(prev => prev ?? 0);
          setFocusedTask(prev => {
            const colIdx = focusedColumn ?? 0;
            const maxTask = Math.max(0, (counts[colIdx] ?? 1) - 1);
            if (e.key === 'ArrowDown') return Math.min(prev + 1, maxTask);
            return Math.max(prev - 1, 0);
          });
          return;
        }

        if (e.key === 'Enter' && focusedColumn !== null) {
          e.preventDefault();
          triggerTaskClick(focusedColumn, focusedTask);
          return;
        }
        return;
      }

      if (e.key === 't' || e.key === 'T') {
        const tid = getHoveredTaskId();
        if (tid) {
          const t = tasks.find(tk => tk.id === tid);
          if (t) {
            updateTask(tid, {
              completed: !t.completed,
              completedAt: !t.completed ? format(new Date(), 'yyyy-MM-dd') : null,
            });
          }
        }
      } else if (e.key === 'p' || e.key === 'P') {
        newProjectTrigger.open();
      } else if (e.key === '?') {
        setShowShortcuts(prev => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [undo, tasks, updateTask, focusedColumn, clearNavFocus]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement required before drag starts
      },
    })
  );

  const fireToast = (msg: string) =>
    window.dispatchEvent(new CustomEvent('horizon:toast', { detail: msg }));

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;
    const draggedTask = tasks.find(t => t.id === taskId);
    if (!draggedTask) return;

    // overId is either a date string (column drop) or another task id (sortable reorder)
    const isDateDrop = /^\d{4}-\d{2}-\d{2}$/.test(overId);

    // Helper: compute sortOrder to place a task at the position of `targetIdx`
    // in a sorted list, using the average of its neighbors' sortOrders.
    const calcSortOrder = (sorted: Task[], targetIdx: number): number => {
      const above = targetIdx > 0 ? (sorted[targetIdx - 1].sortOrder ?? 0) : null;
      const below = targetIdx < sorted.length ? (sorted[targetIdx].sortOrder ?? 0) : null;
      if (above !== null && below !== null) return (above + below) / 2;
      if (above !== null) return above + 1000;
      if (below !== null) return below - 1000;
      return Date.now();
    };

    if (isDateDrop) {
      const targetDate = overId;
      if (draggedTask.date === targetDate) return; // same day, nothing to do
      // Cross-column: place at end of target column
      const targetDayTasks = tasks
        .filter(t => t.date === targetDate && t.id !== taskId)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      const newOrder = calcSortOrder(targetDayTasks, targetDayTasks.length);
      updateTask(taskId, { date: targetDate, sortOrder: newOrder });
      if (draggedTask.deadline && targetDate > draggedTask.deadline) {
        fireToast(`⚠️ Scheduled after deadline · due ${format(parseISO(draggedTask.deadline), 'MMM d')}`);
      }
    } else {
      // overId = another task's id
      const overTask = tasks.find(t => t.id === overId);
      if (!overTask) return;

      if (draggedTask.date !== overTask.date) {
        // Cross-column via task hover: place at the target task's position
        const targetDayTasks = tasks
          .filter(t => t.date === overTask.date && t.id !== taskId)
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        const targetIdx = targetDayTasks.findIndex(t => t.id === overId);
        const newOrder = targetIdx !== -1
          ? calcSortOrder(targetDayTasks, targetIdx)
          : calcSortOrder(targetDayTasks, targetDayTasks.length);
        updateTask(taskId, { date: overTask.date, sortOrder: newOrder });
        if (draggedTask.deadline && overTask.date && overTask.date > draggedTask.deadline) {
          fireToast(`⚠️ Scheduled after deadline · due ${format(parseISO(draggedTask.deadline), 'MMM d')}`);
        }
      } else {
        // Same column reorder: calculate new sortOrder from neighbors
        const dayTasks = tasks
          .filter(t => t.date === draggedTask.date && t.id !== taskId)
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        const targetIdx = dayTasks.findIndex(t => t.id === overId);
        if (targetIdx === -1) return;
        const newOrder = calcSortOrder(dayTasks, targetIdx);
        reorderTask(taskId, newOrder);
      }
    }
  };

  return (
    <ToastProvider>
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-screen w-full font-sans overflow-hidden" style={{ background: 'var(--bg-1)', color: 'var(--text-1)' }}>
        {/* Main Area: Horizon View */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <HorizonView focusedColumn={focusedColumn} focusedTask={focusedTask} />
        </div>
      </div>

      <DragOverlay>
        {activeTask ? (() => {
          const proj = projects.find(p => p.id === activeTask.projectId);
          const PRIORITY_BORDER: Record<string, string> = { High: '#ef4444', Medium: '#eab308', Low: '#2A2A2A' };
          const borderColor = PRIORITY_BORDER[activeTask.priority ?? 'Low'];
          return (
            <div className="p-2 rounded text-sm flex items-center gap-2"
              style={{
                background: 'var(--bg-2)',
                border: '2px solid var(--accent)',
                borderLeft: `3px solid ${borderColor}`,
                color: 'var(--text-1)',
                maxWidth: 240,
                opacity: 0.92,
                cursor: 'grabbing',
                boxShadow: '0 12px 24px rgba(0,0,0,0.4)',
                transform: 'scale(1.05) rotate(2deg)',
                transition: 'transform 150ms ease, box-shadow 150ms ease, opacity 150ms ease',
              }}>
              {proj && <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: proj.color }} />}
              <span className="truncate text-[13px]">{activeTask.title}</span>
            </div>
          );
        })() : null}
      </DragOverlay>

      <PomodoroBar />
      <CommandPalette />
      {showShortcuts && <KeyboardShortcuts onClose={() => setShowShortcuts(false)} />}
      {infoToast && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[99999] px-4 py-2 rounded-lg text-sm font-medium shadow-xl pointer-events-none transition-all"
          style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)', color: 'var(--text-1)' }}>
          {infoToast}
        </div>
      )}
    </DndContext>
    </ToastProvider>
  );
}
