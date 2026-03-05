/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, closestCorners, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useEffect, useState } from 'react';
import { HorizonView } from './components/HorizonView';
import { ThinkPad } from './components/ThinkPad';
import { PomodoroBar } from './components/PomodoroBar';
import { Task } from './store';
import { useStore, THEMES, deriveThemeFromAccent } from './store';
import { newProjectTrigger } from './components/MacroGoalsPanel';
import { KeyboardShortcuts } from './components/KeyboardShortcuts';
import { CommandPalette } from './components/CommandPalette';

export default function App() {
  const { tasks, projects, updateTask, theme, customAccent, undo } = useStore();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

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
      if (e.key === 'n' || e.key === 'N') {
        document.getElementById('new-task-input')?.focus();
      } else if (e.key === 'p' || e.key === 'P') {
        newProjectTrigger.open();
      } else if (e.key === '?') {
        setShowShortcuts(prev => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [undo]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement required before drag starts
      },
    })
  );

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

    if (overId === 'think-pad') {
      updateTask(taskId, { date: null });
      return;
    }

    // overId is either a date string (column drop) or another task id (sortable reorder)
    const isDateDrop = /^\d{4}-\d{2}-\d{2}$/.test(overId);

    if (isDateDrop) {
      const targetDate = overId;
      if (draggedTask.date === targetDate) return; // same day, nothing to do
      // Cross-day: move to end of target day
      const targetDayTasks = tasks.filter(t => t.date === targetDate && t.id !== taskId);
      const maxOrder = targetDayTasks.reduce((m, t) => Math.max(m, t.sortOrder ?? 0), 0);
      updateTask(taskId, { date: targetDate, sortOrder: maxOrder + 1000 });
    } else {
      // Reorder within same day (overId = another task's id)
      const overTask = tasks.find(t => t.id === overId);
      if (!overTask) return;
      if (draggedTask.date !== overTask.date) {
        // Cross-day via task hover — just move to that date
        const targetDayTasks = tasks.filter(t => t.date === overTask.date && t.id !== taskId);
        const maxOrder = targetDayTasks.reduce((m, t) => Math.max(m, t.sortOrder ?? 0), 0);
        updateTask(taskId, { date: overTask.date, sortOrder: overTask.sortOrder != null ? overTask.sortOrder - 1 : maxOrder + 1000 });
      } else {
        // Same day reorder: swap sortOrders
        const dayTasks = tasks
          .filter(t => t.date === draggedTask.date)
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        const oldIdx = dayTasks.findIndex(t => t.id === taskId);
        const newIdx = dayTasks.findIndex(t => t.id === overId);
        if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return;
        const reordered = arrayMove(dayTasks, oldIdx, newIdx);
        const updates = reordered.map((t, i) => ({ id: t.id, sortOrder: i * 1000 }));
        updates.forEach(u => updateTask(u.id, { sortOrder: u.sortOrder }));
      }
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-screen w-full font-sans overflow-hidden" style={{ background: 'var(--bg-1)', color: 'var(--text-1)' }}>
        {/* Left Sidebar: Think Pad */}
        <div className="w-80 flex flex-col shrink-0" style={{ background: 'var(--bg-0)', borderRight: '1px solid var(--border-1)' }}>
          <ThinkPad />
        </div>

        {/* Main Area: Horizon View */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <HorizonView />
        </div>
      </div>

      <DragOverlay>
        {activeTask ? (() => {
          const proj = projects.find(p => p.id === activeTask.projectId);
          const PRIORITY_BORDER: Record<string, string> = { High: '#ef4444', Medium: '#eab308', Low: '#2A2A2A' };
          const borderColor = PRIORITY_BORDER[activeTask.priority ?? 'Low'];
          return (
            <div className="p-2 rounded shadow-2xl text-sm cursor-grabbing flex items-center gap-2 opacity-95"
              style={{
                background: 'var(--bg-2)',
                border: `1px solid var(--border-1)`,
                borderLeft: `2px solid ${borderColor}`,
                color: 'var(--text-1)',
                maxWidth: 240,
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
    </DndContext>
  );
}
