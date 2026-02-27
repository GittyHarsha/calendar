import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useDraggable } from '@dnd-kit/core';
import { Task, Priority, useStore, fmtDuration } from '../store';
import { GripVertical, Trash2, FileText, Flag, CalendarDays, ArrowRight, AlignLeft, Timer } from 'lucide-react';
import { cn } from '../lib/utils';
import { format, parseISO, startOfToday, differenceInDays } from 'date-fns';
import { TaskNotesModal } from './TaskNotesModal';
import { DatePickerPopover } from './DatePickerPopover';

const PRIORITY_NEXT: Record<Priority, Priority> = { High: 'Medium', Medium: 'Low', Low: 'High' };
const PRIORITY_BORDER: Record<Priority, string> = {
  High: 'border-l-red-500',
  Medium: 'border-l-yellow-400',
  Low: 'border-l-[#2A2A2A]',
};
const PRIORITY_BG: Record<Priority, string> = {
  High: 'rgba(239,68,68,0.04)',
  Medium: 'rgba(234,179,8,0.03)',
  Low: 'transparent',
};
const PRIORITY_LABEL: Record<Priority, string> = { High: 'High', Medium: 'Medium', Low: 'Low' };
const PRIORITY_COLOR: Record<Priority, string> = { High: '#ef4444', Medium: '#eab308', Low: '#666' };

function deadlineAccent(days: number | null) {
  if (days === null) return null;
  if (days < 0)  return { color: '#ef4444', label: `${Math.abs(days)}d overdue` };
  if (days === 0) return { color: '#F27D26', label: 'due today' };
  if (days === 1) return { color: '#F27D26', label: 'due tmrw' };
  if (days <= 7)  return { color: '#f97316', label: `due in ${days}d` };
  if (days <= 14) return { color: '#eab308', label: `due in ${days}d` };
  return { color: '#555', label: `due in ${days}d` };
}

function TaskPopup({ task, anchorRef, onClose, onOpenNotes, onMouseEnter, onMouseLeave }: {
  task: Task;
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  onOpenNotes: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const { projects, updateTask, deleteTask, startPomodoro, getTaskTime, pomodoro } = useStore();
  const [editingDate, setEditingDate] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pickerOpen = editingDate || editingDeadline;

  // Cancel close whenever a picker is open
  useEffect(() => { if (pickerOpen) onMouseEnter(); }, [pickerOpen]);
  const dateButtonRef = useRef<HTMLButtonElement>(null);
  const deadlineButtonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const today = startOfToday();
  const priority: Priority = task.priority ?? 'Low';
  const deadlineDays = task.deadline ? differenceInDays(parseISO(task.deadline), today) : null;
  const dl = deadlineAccent(deadlineDays);

  // Position popup to the RIGHT of the card (fallback: left side)
  const [pos, setPos] = useState<{ top: number; left: number; ready: boolean }>({ top: 0, left: 0, ready: false });
  useEffect(() => {
    if (!anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    const popW = 224; // w-56
    const popH = 280;
    const gap = 6;

    // Try right side first
    let left = r.right + gap;
    if (left + popW > window.innerWidth - 8) {
      // Not enough room on right → go left
      left = r.left - popW - gap;
    }
    // Clamp left within viewport
    left = Math.max(8, left);

    // Vertical: align top with card, clamp so popup doesn't go off bottom
    let top = r.top;
    if (top + popH > window.innerHeight - 8) {
      top = window.innerHeight - popH - 8;
    }
    top = Math.max(8, top);

    setPos({ top, left, ready: true });
  }, [anchorRef]);

  return ReactDOM.createPortal(
    <>
      <div ref={popupRef}
        onMouseEnter={onMouseEnter}
        onMouseLeave={pickerOpen ? undefined : onMouseLeave}
        className="fixed z-[9999] w-56 rounded-xl border border-[#2A2A2A] shadow-2xl p-3 flex flex-col gap-3"
        style={{ top: pos.top, left: pos.left, opacity: pos.ready ? 1 : 0, pointerEvents: pos.ready ? 'auto' : 'none', background: 'var(--bg-0)' }}>

        {/* Title row */}
        <div className="text-sm font-semibold text-white leading-snug">{task.title}</div>

        {/* Project label */}
        {task.projectId && (() => {
          const proj = projects.find(p => p.id === task.projectId);
          const parent = proj?.parentId ? projects.find(p => p.id === proj.parentId) : null;
          const label = parent ? `${parent.name} › ${proj!.name}` : proj?.name;
          return proj ? (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: proj.color }} />
              <span className="text-xs text-[#999] truncate" title={label}>{label}</span>
            </div>
          ) : null;
        })()}

        <div className="border-t border-[#1E1E1E]" />

        {/* Work date */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-[#999]">
            <CalendarDays size={13} />
            <span>Work date</span>
          </div>
          <div className="flex items-center gap-1.5">
            {task.date && task.date !== format(today, 'yyyy-MM-dd') && (
              <button onClick={() => { updateTask(task.id, { date: format(today, 'yyyy-MM-dd') }); onClose(); }}
                className="text-[12px] text-[#F27D26] hover:underline font-mono flex items-center gap-0.5">
                <ArrowRight size={10} /> Today
              </button>
            )}
            <button ref={dateButtonRef} onClick={() => setEditingDate(v => !v)}
              className="text-xs font-mono text-[#888] hover:text-white px-1.5 py-0.5 rounded bg-[#1A1A1A] hover:bg-[#222]">
              {task.date ? format(parseISO(task.date), 'MMM d') : '+ set'}
            </button>
          </div>
        </div>

        {/* Deadline */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs" style={{ color: dl ? dl.color : '#666' }}>
            <Flag size={13} />
            <span>{dl ? dl.label : 'Deadline'}</span>
            {(task.deadlineHistory?.length ?? 0) > 0 && (
              <span className="text-[13px] font-bold px-1 py-0.5 rounded"
                title={`Shifted ${task.deadlineHistory.length}× (was: ${task.deadlineHistory.map(d => format(parseISO(d), 'MMM d')).join(' → ')})`}
                style={{ background: '#ef444420', color: '#ef4444' }}>↻{task.deadlineHistory.length}</span>
            )}
          </div>
          <button ref={deadlineButtonRef} onClick={() => setEditingDeadline(v => !v)}
            className="text-xs font-mono text-[#888] hover:text-white px-1.5 py-0.5 rounded bg-[#1A1A1A] hover:bg-[#222]">
            {task.deadline ? format(parseISO(task.deadline), 'MMM d') : '+ set'}
          </button>
        </div>

        {/* Priority */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-[#999]">Priority</span>
          <button onClick={() => updateTask(task.id, { priority: PRIORITY_NEXT[priority] })}
            className="text-xs font-semibold px-2 py-0.5 rounded"
            style={{ background: PRIORITY_COLOR[priority] + '22', color: PRIORITY_COLOR[priority] }}>
            {PRIORITY_LABEL[priority]}
          </button>
        </div>

        <div className="border-t border-[#1E1E1E]" />

        {/* Focus timer */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => { startPomodoro(task.id); onClose(); }}
            className={cn(
              'flex items-center gap-1.5 text-xs transition-colors',
              pomodoro.taskId === task.id && pomodoro.phase === 'work'
                ? 'text-[#F27D26]' : 'text-[#aaa] hover:text-[#F27D26]'
            )}>
            <Timer size={13} />
            {pomodoro.taskId === task.id && pomodoro.phase === 'work' ? 'Focusing…' : 'Focus 25m'}
          </button>
          {(() => { const t = getTaskTime(task.id); return t > 0
            ? <span className="text-xs text-[#666] font-mono">⏱ {fmtDuration(t)}</span>
            : null; })()}
        </div>

        <div className="border-t border-[#1E1E1E]" />

        {/* Notes + Delete */}
        <div className="flex items-center justify-between">
          <button onClick={() => { onOpenNotes(); onClose(); }}
            className="flex items-center gap-1.5 text-xs text-[#aaa] hover:text-[#F0EFEB] transition-colors">
            <AlignLeft size={13} />
            {task.description ? 'Edit notes' : 'Add notes'}
          </button>
          {confirmDelete ? (
            <span className="flex items-center gap-1 text-xs">
              <button onClick={() => { deleteTask(task.id); onClose(); }} className="text-red-400 hover:text-red-300 font-bold">Yes</button>
              <span className="text-[#555]">/</span>
              <button onClick={() => setConfirmDelete(false)} className="text-[#aaa] hover:text-white">No</button>
            </span>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1 text-xs text-[#aaa] hover:text-red-400 transition-colors">
              <Trash2 size={13} />
              Delete
            </button>
          )}
        </div>
      </div>

      {editingDate && (
        <DatePickerPopover value={task.date} onChange={date => { updateTask(task.id, { date }); setEditingDate(false); }}
          onClose={() => setEditingDate(false)} clearable anchorRef={dateButtonRef} />
      )}
      {editingDeadline && (
        <DatePickerPopover value={task.deadline} onChange={deadline => { updateTask(task.id, { deadline }); setEditingDeadline(false); }}
          onClose={() => setEditingDeadline(false)} clearable anchorRef={deadlineButtonRef} />
      )}
    </>,
    document.body
  );
}

export function DraggableTask({ task, showDate }: { key?: React.Key; task: Task; showDate?: boolean }) {
  const { projects, updateTask, setHoveredProjectId, getTaskTime, pomodoro } = useStore();
  const project = projects.find(p => p.id === task.projectId);
  const parentProject = project?.parentId ? projects.find(p => p.id === project.parentId) : null;
  const projectLabel = parentProject ? `${parentProject.name} › ${project!.name}` : project?.name;

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState(task.title);
  const [showPopup, setShowPopup] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [checkAnim, setCheckAnim] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setShowPopup(false), 80);
  };
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  const handleToggleComplete = () => {
    if (!task.completed) { setCheckAnim(true); setTimeout(() => setCheckAnim(false), 300); }
    updateTask(task.id, { completed: !task.completed });
  };

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  const priority: Priority = task.priority ?? 'Low';

  const today = startOfToday();
  const deadlineDays = task.deadline ? differenceInDays(parseISO(task.deadline), today) : null;
  const dl = deadlineAccent(deadlineDays);

  const saveTitle = () => {
    if (titleVal.trim()) updateTask(task.id, { title: titleVal.trim() });
    else setTitleVal(task.title);
    setEditingTitle(false);
  };

  // Combined ref: dnd + card
  const setRefs = (el: HTMLDivElement | null) => {
    (cardRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    setNodeRef(el);
  };

  return (
    <>
      <div
        ref={setRefs}
        onMouseEnter={() => { cancelClose(); setHoveredProjectId(task.projectId); setShowPopup(true); }}
        onMouseLeave={() => { setHoveredProjectId(null); scheduleClose(); }}
        className={cn(
          'relative group flex flex-col border border-[#222] border-l-2 rounded transition-all overflow-hidden cursor-default',
          'hover:-translate-y-px',
          PRIORITY_BORDER[priority],
          isDragging ? 'opacity-40 scale-[0.98]' : '',
          task.completed && 'opacity-40'
        )}
        style={{
          background: task.completed ? '#141414' : PRIORITY_BG[priority] || '#141414',
          ...(showPopup && !isDragging ? { boxShadow: '0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent), 0 4px 16px color-mix(in srgb, var(--accent) 12%, transparent)' } : { boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }),
        }}
      >
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div {...attributes} {...listeners}
            className="opacity-0 group-hover:opacity-100 cursor-grab text-[#888] hover:text-[#777] shrink-0 -ml-1 pointer-events-none group-hover:pointer-events-auto">
            <GripVertical size={13} />
          </div>

          {/* Project color dot */}
          {project && (
            <div className="shrink-0 w-1.5 h-1.5 rounded-full opacity-70 group-hover:opacity-100 transition-opacity"
              style={{ backgroundColor: project.color }} title={projectLabel} />
          )}

          {/* Check */}
          <button onClick={handleToggleComplete}
            role="checkbox"
            aria-checked={task.completed}
            aria-label={task.completed ? 'Mark task incomplete' : 'Mark task complete'}
            className={cn(
              'shrink-0 w-3.5 h-3.5 rounded-full border transition-all',
              checkAnim && 'animate-check',
              task.completed ? 'border-[var(--accent)]' : 'border-[#444] hover:border-[var(--accent)]'
            )}
            style={task.completed ? { background: 'var(--accent)' } : undefined}
          />

          {/* Title */}
          {editingTitle ? (
            <input autoFocus value={titleVal} onChange={e => setTitleVal(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitleVal(task.title); setEditingTitle(false); } }}
              className="flex-1 text-sm text-white bg-transparent border-b focus:outline-none" style={{ borderColor: 'var(--accent)' }} />
          ) : (
            <span onClick={() => setEditingTitle(true)}
              className={cn('flex-1 text-sm leading-snug cursor-text select-none truncate transition-colors',
                task.completed ? 'line-through text-[#555]' : 'text-[#C8C7C4]'
              )} title={task.title}>{task.title}</span>
          )}

          {/* Badges — only show the 2 most important inline; rest in popup */}
          {pomodoro.taskId === task.id && pomodoro.phase === 'work' && (
            <span className="text-[11px] font-mono shrink-0 animate-pulse" style={{ color: 'var(--accent)' }}>▶</span>
          )}
          {dl && (
            <span className="text-[12px] font-mono shrink-0 group-hover:hidden" style={{ color: dl.color }}>
              <Flag size={9} className="inline mr-0.5" style={{ color: dl.color }} />{dl.label}
            </span>
          )}
          {showDate && task.date && (
            <span className="text-[12px] text-[#888] font-mono shrink-0 group-hover:hidden">
              {format(parseISO(task.date), 'MMM d')}
            </span>
          )}
        </div>
      </div>

      {showPopup && !isDragging && !editingTitle && (
        <TaskPopup task={task} anchorRef={cardRef}
          onClose={() => setShowPopup(false)}
          onOpenNotes={() => setShowNotes(true)}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        />
      )}
      {showNotes && <TaskNotesModal task={task} onClose={() => setShowNotes(false)} />}
    </>
  );
}
