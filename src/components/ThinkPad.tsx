import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useStore, Recurrence, Priority } from '../store';
import { useDroppable } from '@dnd-kit/core';
import { DraggableTask } from './DraggableTask';
import { Plus, Maximize2 } from 'lucide-react';
import { format, startOfToday } from 'date-fns';
import { DatePickerPopover } from './DatePickerPopover';

function ScratchpadModal({ value, onChange, onClose }: { value: string; onChange: (v: string) => void; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0A0A0A]">
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#1E1E1E] shrink-0">
        <span className="text-xs font-bold uppercase tracking-widest text-[#555]">Scratchpad</span>
        <button onClick={onClose} className="text-[10px] font-bold uppercase tracking-wider text-[#555] hover:text-white px-3 py-1 border border-[#2A2A2A] rounded hover:border-[#444] transition-colors">
          Esc · Close
        </button>
      </div>
      <textarea
        autoFocus
        value={value}
        onChange={e => onChange(e.target.value)}
        className="flex-1 bg-transparent text-[#E4E3E0] font-mono text-sm p-8 focus:outline-none resize-none leading-relaxed"
        placeholder="Dump your thoughts here..."
        style={{ caretColor: '#F27D26' }}
      />
    </div>,
    document.body
  );
}

export function ThinkPad() {
  const { tasks, thinkPadNotes, setThinkPadNotes, addTask, projects, hideCompleted } = useStore();
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [newTaskDate, setNewTaskDate] = useState('');
  const [newTaskDeadline, setNewTaskDeadline] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);
  const [newTaskRecurrence, setNewTaskRecurrence] = useState<Recurrence>('none');
  const [selectedPriority, setSelectedPriority] = useState<Priority>('Medium');
  const [scratchpadFullscreen, setScratchpadFullscreen] = useState(false);

  const today = format(startOfToday(), 'yyyy-MM-dd');
  // Tasks with no date (inbox)
  const inboxTasks = tasks.filter(t => t.date === null && (!hideCompleted || !t.completed));
  // Overdue: has a date in the past, not completed
  const overdueTasks = tasks.filter(t => t.date !== null && t.date < today && !t.completed);

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
      deadline: newTaskDeadline || null,
      deadlineHistory: [],
      priority: selectedPriority,
    }, newTaskRecurrence, newTaskDate || undefined);
    
    setNewTaskTitle('');
    setNewTaskDate('');
    setNewTaskDeadline('');
    setNewTaskRecurrence('none');
    setSelectedPriority('Medium');
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
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9299]">Scratchpad</label>
            <button onClick={() => setScratchpadFullscreen(true)} className="text-[#444] hover:text-[#8E9299] transition-colors" title="Fullscreen">
              <Maximize2 size={12} />
            </button>
          </div>
          <textarea
            value={thinkPadNotes}
            onChange={(e) => setThinkPadNotes(e.target.value)}
            onDoubleClick={() => setScratchpadFullscreen(true)}
            className="w-full h-40 bg-[#1A1A1A] border border-[#2A2A2A] rounded-md p-3 text-sm text-[#E4E3E0] placeholder-[#555] focus:outline-none focus:border-[#F27D26] resize-none font-mono"
            placeholder="Dump your thoughts here..."
          />
        </div>
        {scratchpadFullscreen && (
          <ScratchpadModal value={thinkPadNotes} onChange={setThinkPadNotes} onClose={() => setScratchpadFullscreen(false)} />
        )}

        {/* Overdue Tasks */}
        {overdueTasks.length > 0 && (
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-red-500/80 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
              Overdue · {overdueTasks.length}
            </label>
            {overdueTasks.map(task => (
              <DraggableTask key={task.id} task={task} showDate />
            ))}
          </div>
        )}

        {/* Inbox Tasks */}
        <div className="flex flex-col gap-2 flex-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9299]">Inbox Tasks</label>
          
          <form onSubmit={handleAddTask} className="flex flex-col gap-2 mb-2 bg-[#141414] p-3 rounded-md border border-[#2A2A2A]">
            <input
              id="new-task-input"
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
                {projects.filter(p => !p.parentId).map(p => (
                  <React.Fragment key={p.id}>
                    <option value={p.id}>{p.name}</option>
                    {projects.filter(sp => sp.parentId === p.id).map(sp => (
                      <option key={sp.id} value={sp.id}>{'  ↳ ' + sp.name}</option>
                    ))}
                  </React.Fragment>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value as Priority)}
                className="flex-1 bg-[#0A0A0A] border border-[#2A2A2A] rounded-md px-2 py-2 text-xs text-[#8E9299] focus:outline-none focus:border-[#F27D26]"
              >
                <option value="High">High Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="Low">Low Priority</option>
              </select>
            </div>
            <div className="relative flex gap-2">
              <button type="button"
                onClick={() => setShowDatePicker(p => !p)}
                className="flex-1 text-left bg-[#0A0A0A] border border-[#2A2A2A] rounded-md px-2 py-2 text-xs text-[#8E9299] hover:border-[#F27D26] transition-colors focus:outline-none">
                {newTaskDate ? format(new Date(newTaskDate + 'T00:00:00'), 'MMM d, yyyy') : '📅 Work date…'}
              </button>
              {showDatePicker && (
                <DatePickerPopover value={newTaskDate || null} onChange={d => { setNewTaskDate(d ?? ''); setShowDatePicker(false); }} onClose={() => setShowDatePicker(false)} clearable />
              )}
              <button type="button"
                onClick={() => setShowDeadlinePicker(p => !p)}
                className="flex-1 text-left bg-[#0A0A0A] border border-[#2A2A2A] rounded-md px-2 py-2 text-xs hover:border-[#ef4444] transition-colors focus:outline-none"
                style={{ color: newTaskDeadline ? '#ef4444' : '#555' }}>
                {newTaskDeadline ? `🚩 ${format(new Date(newTaskDeadline + 'T00:00:00'), 'MMM d')}` : '🚩 Due date…'}
              </button>
              {showDeadlinePicker && (
                <DatePickerPopover value={newTaskDeadline || null} onChange={d => { setNewTaskDeadline(d ?? ''); setShowDeadlinePicker(false); }} onClose={() => setShowDeadlinePicker(false)} clearable />
              )}
            </div>
            <div className="flex gap-2">
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
