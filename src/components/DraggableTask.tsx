import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Task, useStore } from '../store';
import { GripVertical, CheckCircle2, Circle, Trash2, PlayCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { format, parseISO } from 'date-fns';

export function DraggableTask({ task, showDate }: { key?: React.Key; task: Task; showDate?: boolean }) {
  const { projects, updateTask, setHoveredProjectId, deleteTask } = useStore();
  const project = projects.find(p => p.id === task.projectId);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
  });

  const toggleComplete = () => {
    updateTask(task.id, { completed: !task.completed });
  };

  const startTask = () => {
    updateTask(task.id, { startedAt: new Date().toISOString() });
  };

  return (
    <div
      ref={setNodeRef}
      onMouseEnter={() => setHoveredProjectId(task.projectId)}
      onMouseLeave={() => setHoveredProjectId(null)}
      className={cn(
        "flex items-center gap-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-md p-2 group transition-all relative",
        isDragging ? "opacity-50" : "hover:border-[#444]",
        task.completed && "opacity-50"
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab text-[#555] hover:text-[#888] p-1 -ml-1 shrink-0"
      >
        <GripVertical size={14} />
      </div>

      <button onClick={toggleComplete} className="text-[#555] hover:text-[#F27D26] transition-colors shrink-0">
        {task.completed ? <CheckCircle2 size={16} className="text-[#F27D26]" /> : <Circle size={16} />}
      </button>

      {!task.completed && !task.startedAt && (
        <button 
          onClick={startTask} 
          className="text-[#555] hover:text-blue-400 transition-colors shrink-0"
          title="Start Task"
        >
          <PlayCircle size={16} />
        </button>
      )}

      <div className="flex flex-col flex-1 min-w-0">
        <span className={cn(
          "text-sm truncate",
          task.completed && "line-through text-[#888]"
        )}>
          {task.title}
        </span>
        {(showDate && task.date) || task.startedAt ? (
          <span className="text-[10px] text-[#8E9299] font-mono mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
            {showDate && task.date && <span>{format(parseISO(task.date), 'MMM d')}</span>}
            {task.startedAt && <span className="text-blue-400/80">Started {format(parseISO(task.startedAt), 'MMM d, h:mm a')}</span>}
          </span>
        ) : null}
      </div>

      {project && (
        <div 
          className="w-2 h-2 rounded-full shrink-0 group-hover:hidden" 
          style={{ backgroundColor: project.color }}
          title={project.name}
        />
      )}

      <button 
        onClick={() => deleteTask(task.id)}
        className="hidden group-hover:flex text-[#555] hover:text-red-500 p-1 transition-colors shrink-0"
        title="Delete task"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
