import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Task, Priority, useStore } from '../store';
import { GripVertical, Trash2, FileText } from 'lucide-react';
import { cn } from '../lib/utils';
import { format, parseISO, startOfToday } from 'date-fns';
import { TaskNotesModal } from './TaskNotesModal';
import { DatePickerPopover } from './DatePickerPopover';

const PRIORITY_NEXT: Record<Priority, Priority> = { High: 'Medium', Medium: 'Low', Low: 'High' };
const PRIORITY_BORDER: Record<Priority, string> = {
  High: 'border-l-red-500',
  Medium: 'border-l-yellow-400',
  Low: 'border-l-[#2A2A2A]',
};

export function DraggableTask({ task, showDate }: { key?: React.Key; task: Task; showDate?: boolean }) {
  const { projects, updateTask, setHoveredProjectId, deleteTask } = useStore();
  const project = projects.find(p => p.id === task.projectId);
  const parentProject = project?.parentId ? projects.find(p => p.id === project.parentId) : null;
  const projectLabel = parentProject ? `${parentProject.name} › ${project!.name}` : project?.name;

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState(task.title);
  const [editingDate, setEditingDate] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const dateButtonRef = React.useRef<HTMLButtonElement>(null);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  const priority: Priority = task.priority ?? 'Low';

  const saveTitle = () => {
    if (titleVal.trim()) updateTask(task.id, { title: titleVal.trim() });
    else setTitleVal(task.title);
    setEditingTitle(false);
  };

  return (
    <div
      ref={setNodeRef}
      onMouseEnter={() => setHoveredProjectId(task.projectId)}
      onMouseLeave={() => setHoveredProjectId(null)}
      className={cn(
        'relative group flex flex-col bg-[#141414] border border-[#222] border-l-2 rounded transition-colors',
        PRIORITY_BORDER[priority],
        isDragging ? 'opacity-40' : 'hover:border-[#333] hover:border-l-2',
        task.completed && 'opacity-40'
      )}
    >
      <div className="flex items-center gap-2 px-2 py-1.5">
        {/* Drag — hover only */}
        <div {...attributes} {...listeners}
          className="hidden group-hover:block cursor-grab text-[#444] hover:text-[#777] shrink-0 -ml-1">
          <GripVertical size={13} />
        </div>

        {/* Project color dot */}
        {project && (
          <div
            className="shrink-0 w-1.5 h-1.5 rounded-full opacity-70 group-hover:opacity-100"
            style={{ backgroundColor: project.color }}
            title={projectLabel}
          />
        )}

        {/* Check */}
        <button
          onClick={() => updateTask(task.id, { completed: !task.completed })}
          className={cn('shrink-0 w-3.5 h-3.5 rounded-full border transition-colors',
            task.completed ? 'bg-[#F27D26] border-[#F27D26]' : 'border-[#444] hover:border-[#F27D26]'
          )}
          title="Toggle complete"
        />

        {/* Title */}
        {editingTitle ? (
          <input autoFocus value={titleVal}
            onChange={e => setTitleVal(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitleVal(task.title); setEditingTitle(false); } }}
            className="flex-1 text-sm text-white bg-transparent border-b border-[#F27D26] focus:outline-none" />
        ) : (
          <span
            onClick={() => setEditingTitle(true)}
            className={cn('flex-1 text-sm leading-snug cursor-text select-none truncate',
              task.completed ? 'line-through text-[#555]' : 'text-[#C8C7C4]'
            )}
            title={task.title}
          >{task.title}</span>
        )}

        {/* Note badge — visible when description exists and notes panel is closed */}
        {task.description && !showNotes && (
          <FileText size={10} className="shrink-0 text-[#444] group-hover:hidden" />
        )}

        {/* Date — dim, right-aligned; only in calendar views */}
        {showDate && task.date && !editingDate && (
          <span onClick={() => setEditingDate(true)}
            className="text-[10px] text-[#444] font-mono cursor-pointer hover:text-[#888] shrink-0 group-hover:hidden">
            {format(parseISO(task.date), 'MMM d')}
          </span>
        )}
        {/* Date picker popover */}
        {editingDate && (
          <DatePickerPopover
            value={task.date}
            onChange={date => { updateTask(task.id, { date }); setEditingDate(false); }}
            onClose={() => setEditingDate(false)}
            clearable
            anchorRef={dateButtonRef}
          />
        )}

        {/* Hover actions */}
        <div className="hidden group-hover:flex items-center gap-1.5 shrink-0">
          {/* Move to today — only show if task is not already today */}
          {task.date !== format(startOfToday(), 'yyyy-MM-dd') && (
            <button
              onClick={() => updateTask(task.id, { date: format(startOfToday(), 'yyyy-MM-dd') })}
              className="text-[10px] text-[#444] hover:text-[#F27D26] font-mono"
              title="Move to today"
            >→ Today</button>
          )}
          {!editingDate && (
            <button ref={dateButtonRef} onClick={() => setEditingDate(true)}
              className="text-[10px] text-[#444] hover:text-[#888] font-mono">
              {task.date ? format(parseISO(task.date), 'MMM d') : '+date'}
            </button>
          )}
          <button
            onClick={() => updateTask(task.id, { priority: PRIORITY_NEXT[priority] })}
            title={`Priority: ${priority}`}
            className={cn('text-[10px] font-semibold leading-none hover:opacity-80',
              priority === 'High' ? 'text-red-400' : priority === 'Medium' ? 'text-yellow-400' : 'text-[#444]'
            )}>
            {priority === 'High' ? 'H' : priority === 'Medium' ? 'M' : 'L'}
          </button>
          <button onClick={() => setShowNotes(n => !n)} className="text-[#444] hover:text-[#888]" title="Notes">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </button>
          <button onClick={() => deleteTask(task.id)} className="text-[#444] hover:text-red-500 transition-colors">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {showNotes && (
        <TaskNotesModal task={task} onClose={() => setShowNotes(false)} />
      )}
    </div>
  );
}

