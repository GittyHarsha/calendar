/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useState } from 'react';
import { HorizonView } from './components/HorizonView';
import { ThinkPad } from './components/ThinkPad';
import { Task } from './store';
import { useStore } from './store';

export default function App() {
  const { tasks, updateTask } = useStore();
  const [activeTask, setActiveTask] = useState<Task | null>(null);

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
      <div className="flex h-screen w-full bg-[#141414] text-[#E4E3E0] font-sans overflow-hidden">
        {/* Left Sidebar: Think Pad */}
        <div className="w-80 border-r border-[#2A2A2A] flex flex-col bg-[#0A0A0A] shrink-0">
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
    </DndContext>
  );
}
