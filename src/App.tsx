/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useEffect, useState } from 'react';
import { HorizonView } from './components/HorizonView';
import { ThinkPad } from './components/ThinkPad';
import { PomodoroBar } from './components/PomodoroBar';
import { Task } from './store';
import { useStore, THEMES } from './store';
import { newProjectTrigger } from './components/MacroGoalsPanel';

export default function App() {
  const { tasks, updateTask, theme } = useStore();
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Apply theme CSS vars to root
  useEffect(() => {
    const t = THEMES[theme] ?? THEMES.void;
    const r = document.documentElement;
    r.style.setProperty('--accent', t.accent);
    r.style.setProperty('--bg-0', t.bg0);
    r.style.setProperty('--bg-1', t.bg1);
    r.style.setProperty('--bg-2', t.bg2);
    r.style.setProperty('--border-1', t.border);
    r.style.setProperty('--text-1', t.text1);
    r.style.setProperty('--text-2', t.text2);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (e.key === 'n' || e.key === 'N') {
        document.getElementById('new-task-input')?.focus();
      } else if (e.key === 'p' || e.key === 'P') {
        newProjectTrigger.open();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

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

    // overId can be a date string (e.g., '2023-10-25') or 'think-pad'
    if (overId === 'think-pad') {
      updateTask(taskId, { date: null });
    } else {
      // It's a date
      updateTask(taskId, { date: overId });
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-screen w-full font-sans overflow-hidden" style={{ background: 'var(--bg-1)', color: 'var(--text-1)' }}>
        {/* Left Sidebar: Think Pad */}
        <div className="w-80 border-r border-[#2A2A2A] flex flex-col shrink-0" style={{ background: 'var(--bg-0)' }}>
          <ThinkPad />
        </div>

        {/* Main Area: Horizon View */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <HorizonView />
        </div>
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="bg-[#2A2A2A] border border-[#444] p-3 rounded-md shadow-xl text-sm opacity-90 cursor-grabbing">
            {activeTask.title}
          </div>
        ) : null}
      </DragOverlay>

      <PomodoroBar />
    </DndContext>
  );
}
