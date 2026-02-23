import React, { useState } from 'react';
import { useStore, Recurrence } from '../store';
import { useDroppable } from '@dnd-kit/core';
import { DraggableTask } from './DraggableTask';
import { Plus, GripVertical } from 'lucide-react';

export function ThinkPad() {
  const { tasks, thinkPadNotes, setThinkPadNotes, addTask, projects } = useStore();
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [newTaskDate, setNewTaskDate] = useState('');
  const [newTaskRecurrence, setNewTaskRecurrence] = useState<Recurrence>('none');

  // Tasks that are not scheduled (date is null)
  const inboxTasks = tasks.filter(t => t.date === null);

  const { setNodeRef, isOver } = useDroppable({
    id: 'think-pad',
  });

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    
    addTask({
      title: newTaskTitle.trim(),
      projectId: selectedProjectId || null,
      date: newTaskDate || null,
    }, newTaskRecurrence, newTaskDate || undefined);
    
    setNewTaskTitle('');
    setNewTaskDate('');
    setNewTaskRecurrence('none');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[#2A2A2A]">
        <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
          Think Pad
        </h2>
        <p className="text-xs text-[#8E9299] mt-1 font-mono">Unstructured thoughts & inbox</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
        {/* Notes Area */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9299]">Scratchpad</label>
          <textarea
            value={thinkPadNotes}
            onChange={(e) => setThinkPadNotes(e.target.value)}
            className="w-full h-40 bg-[#1A1A1A] border border-[#2A2A2A] rounded-md p-3 text-sm text-[#E4E3E0] placeholder-[#555] focus:outline-none focus:border-[#F27D26] resize-none font-mono"
            placeholder="Dump your thoughts here..."
          />
        </div>

        {/* Inbox Tasks */}
        <div className="flex flex-col gap-2 flex-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9299]">Inbox Tasks</label>
          
          <form onSubmit={handleAddTask} className="flex flex-col gap-2 mb-2 bg-[#141414] p-3 rounded-md border border-[#2A2A2A]">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Add a new task..."
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#F27D26]"
            />
            <div className="flex gap-2">
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="flex-1 bg-[#0A0A0A] border border-[#2A2A2A] rounded-md px-2 py-2 text-xs text-[#8E9299] focus:outline-none focus:border-[#F27D26]"
              >
                <option value="">No Project</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <input 
                type="date" 
                value={newTaskDate}
                onChange={(e) => setNewTaskDate(e.target.value)}
                className="flex-1 bg-[#0A0A0A] border border-[#2A2A2A] rounded-md px-2 py-2 text-xs text-[#8E9299] focus:outline-none focus:border-[#F27D26]"
              />
              <select
                value={newTaskRecurrence}
                onChange={(e) => setNewTaskRecurrence(e.target.value as Recurrence)}
                className="flex-1 bg-[#0A0A0A] border border-[#2A2A2A] rounded-md px-2 py-2 text-xs text-[#8E9299] focus:outline-none focus:border-[#F27D26]"
                disabled={!newTaskDate}
              >
                <option value="none">Once</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
              <button type="submit" className="bg-[#2A2A2A] hover:bg-[#3A3A3A] text-white px-3 py-2 rounded-md transition-colors flex items-center justify-center">
                <Plus size={16} />
              </button>
            </div>
          </form>

          <div 
            ref={setNodeRef} 
            className={`flex-1 flex flex-col gap-2 rounded-md transition-colors ${isOver ? 'bg-[#1A1A1A]' : ''}`}
          >
            {inboxTasks.length === 0 ? (
              <div className="text-xs text-[#555] italic p-4 text-center border border-dashed border-[#2A2A2A] rounded-md">
                No tasks in inbox.
              </div>
            ) : (
              inboxTasks.map(task => (
                <DraggableTask key={task.id} task={task} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
