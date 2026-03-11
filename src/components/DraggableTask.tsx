import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task, Priority, TaskStatus, TaskLabel, useStore, fmtDuration, Subtask } from '../store';
import { GripVertical, Trash2, FileText, Flag, CalendarDays, ArrowRight, AlignLeft, Timer, Download, Maximize2, Lock, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { format, parseISO, startOfToday, differenceInDays, addDays, subDays, formatDistanceToNow } from 'date-fns';
import { TaskNotesModal } from './TaskNotesModal';
import { DatePickerPopover } from './DatePickerPopover';
import { exportTimeLogCSV } from '../utils/exportTimeLogs';
import { useToast } from './Toast';
import { ConfettiBurst } from './ConfettiBurst';

let hoveredTaskId: string | null = null;
export function getHoveredTaskId() { return hoveredTaskId; }

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

// Cycle: undefined → Low → Medium → High → undefined
const PRIORITY_CYCLE: Record<string, Priority | undefined> = {
  none: 'Low', Low: 'Medium', Medium: 'High', High: undefined,
};
const PRIORITY_BADGE: Record<string, { text: string; color: string }> = {
  High:   { text: '!!!', color: '#ef4444' },
  Medium: { text: '!!',  color: '#eab308' },
  Low:    { text: '!',   color: '#666' },
  none:   { text: '·',   color: '#444' },
};

function deadlineAccent(days: number | null) {
  if (days === null) return null;
  if (days < 0)  return { color: '#ef4444', label: `${Math.abs(days)}d overdue`, bold: false };
  if (days === 0) return { color: '#f97316', label: 'Due today', bold: true };
  if (days === 1) return { color: '#eab308', label: 'Due tomorrow', bold: false };
  if (days <= 7)  return { color: 'var(--text-1, #C8C7C4)', label: `Due ${format(addDays(startOfToday(), days), 'EEE')}`, bold: false };
  return { color: 'var(--text-2, #888)', label: `in ${days}d`, bold: false };
}

/** Convert hex color (e.g. "#4ade80") to rgba string. */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function formatEstimate(mins: number): string {
  if (mins < 60) return `${mins}m`;
  return `${mins / 60}h`;
}

const TIME_PRESETS = [
  { label: '15m', value: 15 },
  { label: '30m', value: 30 },
  { label: '45m', value: 45 },
  { label: '1h', value: 60 },
  { label: '1.5h', value: 90 },
  { label: '2h', value: 120 },
  { label: '3h', value: 180 },
  { label: '4h', value: 240 },
];

function TimeEstimatePicker({ anchorRef, value, onChange, onClose }: {
  anchorRef: React.RefObject<HTMLElement | null>;
  value: number | null | undefined;
  onChange: (minutes: number | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!anchorRef.current || !ref.current) return;
    const anchor = anchorRef.current.getBoundingClientRect();
    const menu = ref.current.getBoundingClientRect();
    let top = anchor.bottom + 4;
    let left = anchor.left;
    if (top + menu.height > window.innerHeight - 8) top = anchor.top - menu.height - 4;
    if (left + menu.width > window.innerWidth - 8) left = window.innerWidth - menu.width - 8;
    if (left < 8) left = 8;
    setPos({ top, left });
  }, [anchorRef]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  return ReactDOM.createPortal(
    <div ref={ref} style={{
      position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999,
      background: 'var(--bg-1)', border: '1px solid var(--border-1)',
      borderRadius: 8, padding: 4,
      boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2,
    }}>
      {TIME_PRESETS.map(opt => (
        <button key={opt.value}
          onClick={(e) => { e.stopPropagation(); onChange(opt.value); onClose(); }}
          className="transition-colors"
          style={{
            padding: '4px 6px', fontSize: 10, fontFamily: 'var(--font-mono, monospace)',
            color: value === opt.value ? 'var(--accent)' : 'var(--text-2)',
            background: value === opt.value ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent',
            border: 'none', borderRadius: 4, cursor: 'pointer', textAlign: 'center',
          }}
          onMouseEnter={e => {
            (e.currentTarget).style.background = 'var(--bg-2)';
            (e.currentTarget).style.color = 'var(--text-1)';
          }}
          onMouseLeave={e => {
            (e.currentTarget).style.background = value === opt.value ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent';
            (e.currentTarget).style.color = value === opt.value ? 'var(--accent)' : 'var(--text-2)';
          }}
        >
          {opt.label}
        </button>
      ))}
      {value != null && (
        <button
          onClick={(e) => { e.stopPropagation(); onChange(null); onClose(); }}
          className="transition-colors"
          style={{
            padding: '4px 6px', fontSize: 10, color: 'var(--text-2)',
            background: 'transparent', border: 'none', borderRadius: 4,
            cursor: 'pointer', textAlign: 'center', gridColumn: '1 / -1',
          }}
          onMouseEnter={e => { (e.currentTarget).style.background = 'var(--bg-2)'; (e.currentTarget).style.color = 'var(--text-1)'; }}
          onMouseLeave={e => { (e.currentTarget).style.background = 'transparent'; (e.currentTarget).style.color = 'var(--text-2)'; }}
        >
          Clear
        </button>
      )}
    </div>,
    document.body
  );
}

export function TaskPopup({ task, anchorRef, onClose, onOpenNotes, onMouseEnter, onMouseLeave }: {
  task: Task;
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  onOpenNotes: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const { projects, tasks, timeEntries, updateTask, updateRecurringTask, deleteTask, startPomodoro, getTaskTime, pomodoro, addSubtask, updateSubtask, deleteSubtask } = useStore();
  const { showToast } = useToast();
  const [editingDate, setEditingDate] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [editingStartDate, setEditingStartDate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showTimeLog, setShowTimeLog] = useState(false);
  const [showAllTimeEntries, setShowAllTimeEntries] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [hoveredSubtaskId, setHoveredSubtaskId] = useState<string | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<{ field: 'date' | 'deadline'; value: string | null } | null>(null);
  const pickerOpen = editingDate || editingDeadline || editingStartDate;

  // Cancel close whenever a picker is open
  useEffect(() => { if (pickerOpen) onMouseEnter(); }, [pickerOpen]);
  const dateButtonRef = useRef<HTMLButtonElement>(null);
  const deadlineButtonRef = useRef<HTMLButtonElement>(null);
  const startDateButtonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const today = startOfToday();
  const priority: Priority = task.priority ?? 'Low';
  const deadlineDays = task.deadline ? differenceInDays(parseISO(task.deadline), today) : null;
  const dl = deadlineAccent(deadlineDays);

  // Position popup to the RIGHT of the card (fallback: left side)
  const [pos, setPos] = useState<{ top: number; left: number; ready: boolean }>({ top: 0, left: 0, ready: false });
  const computePos = () => {
    if (!anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    const popW = 288; // w-72
    const popH = popupRef.current ? popupRef.current.offsetHeight : 400;
    const gap = 6;

    // Try right side first
    let left = r.right + gap;
    if (left + popW > window.innerWidth - 8) {
      // Not enough room on right → go left
      left = r.left - popW - gap;
    }
    // Clamp left within viewport (min 328 = 320px sidebar + 8px gap)
    left = Math.max(8, left);

    // Vertical: align top with card, clamp so popup doesn't go off bottom
    let top = r.top;
    if (top + popH > window.innerHeight - 8) {
      top = window.innerHeight - popH - 8;
    }
    top = Math.max(8, top);

    setPos({ top, left, ready: true });
  };
  // First pass: position offscreen to measure real height
  useLayoutEffect(() => {
    setPos({ top: -9999, left: -9999, ready: false });
  }, []);
  // Second pass: measure actual height, then position correctly
  useEffect(() => {
    if (pos.top === -9999) {
      computePos();
    }
  }, [pos.top, anchorRef]);

  return ReactDOM.createPortal(
    <>
      <div ref={popupRef}
        onMouseEnter={onMouseEnter}
        onMouseLeave={pickerOpen ? undefined : onMouseLeave}
        data-no-inbox-close
        className="fixed z-[9999] w-72 rounded-xl border border-[#2A2A2A] shadow-2xl p-3 flex flex-col gap-3"
        style={{ top: pos.top, left: pos.left, opacity: pos.ready ? 1 : 0, pointerEvents: pos.ready ? 'auto' : 'none', background: 'var(--bg-0)' }}>

        {/* Title row with delete icon */}
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-white leading-snug flex-1 min-w-0 truncate">{task.title}</div>
          {confirmDelete ? (
            <span className="flex items-center gap-1 text-xs shrink-0">
              <button onClick={() => {
                const deletedTask = { ...task };
                deleteTask(task.id);
                onClose();
                showToast('Task deleted', () => {
                  useStore.setState((state) => ({
                    tasks: [...state.tasks, deletedTask],
                  }));
                });
              }} className="px-2 py-0.5 rounded border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 font-bold transition-colors">Yes</button>
              <button onClick={() => setConfirmDelete(false)} className="px-2 py-0.5 rounded border border-[#2A2A2A] bg-[#111] text-[#aaa] hover:text-white transition-colors">No</button>
            </span>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="shrink-0 p-1 rounded text-[#444] hover:text-red-400 hover:bg-red-400/10 transition-colors">
              <Trash2 size={13} />
            </button>
          )}
        </div>

        {/* Project selector */}
        <div className="flex items-center gap-1.5">
          {task.projectId && (() => {
            const proj = projects.find(p => p.id === task.projectId);
            return proj ? <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: proj.color }} /> : null;
          })()}
          <select
            value={task.projectId ?? ''}
            onChange={e => updateTask(task.id, { projectId: e.target.value || null })}
            className="flex-1 text-xs cursor-pointer rounded px-1.5 py-0.5 outline-none appearance-none"
            style={{
              background: 'var(--bg-2)',
              color: 'var(--text-1)',
              border: '1px solid var(--border-1)',
            }}
          >
            <option value="" style={{ background: 'var(--bg-2)', color: 'var(--text-1)' }}>No project</option>
            {projects.filter(p => !p.parentId).map(p => (
              <React.Fragment key={p.id}>
                <option value={p.id} style={{ background: 'var(--bg-2)', color: 'var(--text-1)' }}>{p.name}</option>
                {projects.filter(c => c.parentId === p.id).map(c => (
                  <option key={c.id} value={c.id} style={{ background: 'var(--bg-2)', color: 'var(--text-1)' }}>{'  › ' + c.name}</option>
                ))}
              </React.Fragment>
            ))}
          </select>
        </div>

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
                className="text-[12px] hover:underline font-mono flex items-center gap-0.5" style={{ color: 'var(--accent)' }}>
                <ArrowRight size={10} /> Today
              </button>
            )}
            <button ref={dateButtonRef} onClick={() => setEditingDate(v => !v)}
              className="text-xs font-mono text-[#888] hover:text-white px-1.5 py-0.5 rounded bg-[#1A1A1A] hover:bg-[#222]">
              {task.date ? format(parseISO(task.date), 'MMM d') : '+ set'}
            </button>
          </div>
        </div>

        {/* Start date */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-[#999]">
            <CalendarDays size={13} />
            <span>Start</span>
          </div>
          <button ref={startDateButtonRef} onClick={() => setEditingStartDate(v => !v)}
            className="text-xs font-mono text-[#888] hover:text-white px-1.5 py-0.5 rounded bg-[#1A1A1A] hover:bg-[#222]">
            {task.startDate ? format(parseISO(task.startDate), 'MMM d') : '+ set'}
          </button>
        </div>

        {/* Deadline */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs" style={{ color: dl ? dl.color : '#666' }}>
            <Flag size={13} />
            <span style={dl?.bold ? { fontWeight: 700 } : undefined}>{dl ? dl.label : 'Deadline'}</span>
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

        {/* Deadline History */}
        {task.deadlineHistory && task.deadlineHistory.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-2, #555)' }}>Deadline History</span>
            {task.deadlineHistory.map((oldDate, i) => {
              const nextDate = i < task.deadlineHistory.length - 1 ? task.deadlineHistory[i + 1] : task.deadline;
              if (!nextDate) return null;
              const days = differenceInDays(parseISO(nextDate), parseISO(oldDate));
              const isLast = i === task.deadlineHistory.length - 1;
              return (
                <div key={i} className="flex items-center gap-1 text-[11px] font-mono" style={{ color: 'var(--text-2, #666)' }}>
                  <span>{format(parseISO(oldDate), 'MMM d')}</span>
                  <span style={{ color: '#444' }}>→</span>
                  <span>{format(parseISO(nextDate), 'MMM d')}</span>
                  <span style={{ color: days > 0 ? '#ef4444' : '#22c55e' }}>
                    ({days > 0 ? '+' : ''}{days}d)
                  </span>
                  {isLast && <span className="text-[10px]" style={{ color: '#444' }}>← current</span>}
                </div>
              );
            })}
          </div>
        )}

        {/* Recurring task scope prompt */}
        {pendingUpdate && (
          <div className="flex flex-col gap-1.5 p-2 rounded bg-[#1A1A1A] border border-[#2A2A2A]">
            <span className="text-[11px] text-[#888]">Update this or all?</span>
            <div className="flex gap-1.5">
              <button
                onClick={() => { updateRecurringTask(task.id, { [pendingUpdate.field]: pendingUpdate.value }, 'one'); setPendingUpdate(null); onClose(); }}
                className="flex-1 text-[11px] py-1 rounded bg-[#252525] hover:bg-[#303030] text-[#ccc] transition-colors">
                Just this
              </button>
              <button
                onClick={() => { updateRecurringTask(task.id, { [pendingUpdate.field]: pendingUpdate.value }, 'all'); setPendingUpdate(null); onClose(); }}
                className="flex-1 text-[11px] py-1 rounded bg-[#252525] hover:bg-[#303030] text-[#ccc] transition-colors">
                All future
              </button>
            </div>
          </div>
        )}

        {/* Priority */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-[#999]">Priority</span>
          <button onClick={() => updateTask(task.id, { priority: PRIORITY_NEXT[priority] })}
            className="text-xs font-semibold px-2 py-0.5 rounded"
            style={{ background: PRIORITY_COLOR[priority] + '22', color: PRIORITY_COLOR[priority] }}>
            {PRIORITY_LABEL[priority]}
          </button>
        </div>

        {/* Effort estimate */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-[#999]">
            <Clock size={13} />
            <span>Effort</span>
          </div>
          <div className="flex items-center gap-1">
            {([['XS', 15], ['S', 30], ['M', 60], ['L', 120], ['XL', 180]] as [string, number][]).map(([label, mins]) => (
              <button key={label}
                onClick={() => updateTask(task.id, { estimatedMinutes: task.estimatedMinutes === mins ? null : mins })}
                className="text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors"
                style={{
                  background: task.estimatedMinutes === mins ? 'color-mix(in srgb, var(--accent) 25%, transparent)' : '#1A1A1A',
                  color: task.estimatedMinutes === mins ? 'var(--accent)' : '#555',
                  border: `1px solid ${task.estimatedMinutes === mins ? 'var(--accent)' : '#2A2A2A'}`,
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Status: blocked / waiting */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-[#999]">
            <Lock size={13} />
            <span>Status</span>
          </div>
          <div className="flex items-center gap-1">
            {(['active', 'blocked', 'waiting'] as TaskStatus[]).map(s => {
              const active = (task.taskStatus ?? 'active') === s;
              const color = s === 'blocked' ? '#ef4444' : s === 'waiting' ? '#eab308' : 'var(--accent)';
              return (
                <button key={s}
                  onClick={() => updateTask(task.id, { taskStatus: s === 'active' ? undefined : s })}
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded capitalize transition-colors"
                  style={{
                    background: active ? color + '22' : '#1A1A1A',
                    color: active ? color : '#555',
                    border: `1px solid ${active ? color : '#2A2A2A'}`,
                  }}>
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-[#1E1E1E]" />

        {/* Labels */}
        {(() => {
          const { availableLabels } = useStore.getState();
          const taskLabels = task.labels ?? [];
          return (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-[#999]">Labels</span>
              <div className="flex flex-wrap gap-1">
                {availableLabels.map((label: TaskLabel) => {
                  const isActive = taskLabels.includes(label.name);
                  return (
                    <button key={label.name}
                      onClick={() => {
                        const newLabels = isActive
                          ? taskLabels.filter(l => l !== label.name)
                          : [...taskLabels, label.name];
                        updateTask(task.id, { labels: newLabels });
                      }}
                      className="rounded-full px-2 py-0.5 transition-colors"
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: isActive ? label.color : '#555',
                        background: isActive ? label.color + '33' : '#1A1A1A',
                        border: `1px solid ${isActive ? label.color + '55' : '#2A2A2A'}`,
                      }}>
                      {label.name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        <div className="border-t border-[#1E1E1E]" />

        {/* Focus timer */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              startPomodoro(task.id);
              window.dispatchEvent(new CustomEvent('horizon:toast', { detail: `◉ Pomodoro started — ${task.title}` }));
              onClose();
            }}
            className={cn(
              'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border transition-colors font-medium',
              pomodoro.taskId === task.id && pomodoro.phase === 'work'
                ? 'border-[var(--accent)] text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]'
                : 'border-[#2A2A2A] text-[#aaa] bg-[#111] hover:border-[var(--accent)] hover:text-[var(--accent)]'
            )}>
            <Timer size={12} />
            {pomodoro.taskId === task.id && pomodoro.phase === 'work' ? 'Focusing…' : 'Focus 25m'}
          </button>
          {(() => { const t = getTaskTime(task.id); return t > 0
            ? <span className="text-xs text-[#555] font-mono">{fmtDuration(t)}</span>
            : null; })()}
        </div>

        <div className="border-t border-[#1E1E1E]" />

        {/* Time Log */}
        {(() => {
          const taskEntries = timeEntries.filter(e => e.taskId === task.id);
          const totalTime = getTaskTime(task.id);
          const visible = showAllTimeEntries ? taskEntries : taskEntries.slice(0, 5);
          const overflow = taskEntries.length - 5;
          return (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowTimeLog(v => !v)}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-[#2A2A2A] bg-[#111] text-[#aaa] hover:border-[#3A3A3A] hover:text-[#F0EFEB] transition-colors">
                  <span>⏱</span>
                  <span>Time Log</span>
                  {totalTime > 0 && (
                    <span className="font-mono text-[#555]">{fmtDuration(totalTime)}</span>
                  )}
                </button>
                {taskEntries.length > 0 && (
                  <button
                    onClick={() => exportTimeLogCSV(tasks, timeEntries, projects)}
                    title="Export CSV"
                    className="text-[#444] hover:text-[#aaa] transition-colors p-1">
                    <Download size={12} />
                  </button>
                )}
              </div>
              {showTimeLog && taskEntries.length > 0 && (
                <div className="flex flex-col gap-1">
                  {visible.map(e => (
                    <div key={e.id} className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-[#666]">{format(parseISO(e.startedAt), 'MMM d')}</span>
                      <span className="text-[#555]">{fmtDuration(e.duration)}</span>
                    </div>
                  ))}
                  {overflow > 0 && (
                    <button
                      onClick={() => setShowAllTimeEntries(v => !v)}
                      className="text-[11px] text-[var(--accent)] font-mono hover:underline text-left">
                      {showAllTimeEntries ? '↑ show less' : `+${overflow} more`}
                    </button>
                  )}
                </div>
              )}
              {showTimeLog && taskEntries.length === 0 && (
                <div className="text-[11px] text-[#555] font-mono">No sessions yet</div>
              )}
            </div>
          );
        })()}

        <div className="border-t border-[#1E1E1E]" />

        {/* Notes (inline expandable) */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <button onClick={() => setShowNotes(v => !v)}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-[#2A2A2A] bg-[#111] text-[#aaa] hover:border-[#3A3A3A] hover:text-[#F0EFEB] transition-colors flex-1">
              <AlignLeft size={12} />
              {task.description ? 'Edit notes' : 'Add notes'}
            </button>
            <button onClick={onOpenNotes} title="Expand notes"
              className="p-1.5 rounded-md border border-[#2A2A2A] bg-[#111] text-[#444] hover:text-[#aaa] hover:border-[#3A3A3A] transition-colors">
              <Maximize2 size={11} />
            </button>
          </div>
          {showNotes && (
            <textarea
              defaultValue={task.description ?? ''}
              onChange={e => updateTask(task.id, { description: e.target.value })}
              placeholder="Write anything…"
              rows={3}
              className="w-full bg-[#1A1A1A] text-xs text-[#C8C7C4] placeholder-[#444] rounded p-1.5 resize-none focus:outline-none border border-[#2A2A2A] focus:border-[#444]"
            />
          )}
        </div>

        <div className="border-t border-[#1E1E1E]" />

        {/* Subtasks */}
        {(() => {
          const subtasks = task.subtasks ?? [];
          const doneCount = subtasks.filter(s => s.done).length;
          return (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[#aaa]" style={{ fontFamily: 'Consolas, monospace' }}>Subtasks</span>
                {subtasks.length > 0 && (
                  <span className="text-[11px] font-mono px-1 py-0.5 rounded"
                    style={{ background: '#ffffff10', color: '#888' }}>
                    {doneCount}/{subtasks.length}
                  </span>
                )}
              </div>
              {subtasks.map((s: Subtask) => (
                <div key={s.id}
                  onMouseEnter={() => setHoveredSubtaskId(s.id)}
                  onMouseLeave={() => setHoveredSubtaskId(null)}
                  className="flex items-center gap-1.5 group/sub">
                  <input type="checkbox" checked={s.done}
                    onChange={e => updateSubtask(task.id, s.id, e.target.checked)}
                    style={{ accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }} />
                  <span className="flex-1 text-xs"
                    style={{
                      color: s.done ? '#555' : '#C8C7C4',
                      textDecoration: s.done ? 'line-through' : 'none',
                      fontFamily: 'Consolas, monospace',
                    }}>
                    {s.title}
                  </span>
                  {hoveredSubtaskId === s.id && (
                    <button onClick={() => deleteSubtask(task.id, s.id)}
                      style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: 13 }}
                      title="Remove subtask">×</button>
                  )}
                </div>
              ))}
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={e => setNewSubtaskTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newSubtaskTitle.trim()) {
                    addSubtask(task.id, newSubtaskTitle.trim());
                    setNewSubtaskTitle('');
                  }
                }}
                placeholder="+ add subtask (Enter)"
                className="w-full bg-[#1A1A1A] text-xs placeholder-[#444] rounded p-1.5 focus:outline-none border border-[#2A2A2A] focus:border-[#444]"
                style={{ color: '#C8C7C4', fontFamily: 'Consolas, monospace' }}
              />
            </div>
          );
        })()}

        {/* Created age indicator */}
        {(() => {
          const creationDate = task.startedAt ?? task.date;
          if (!creationDate) return null;
          const parsed = parseISO(creationDate);
          const isToday = differenceInDays(startOfToday(), parsed) === 0;
          return (
            <div style={{
              textAlign: 'right',
              fontSize: 10,
              fontStyle: 'italic',
              color: 'var(--text-2)',
              paddingTop: 4,
            }}>
              {isToday ? 'Created today' : `Created ${formatDistanceToNow(parsed, { addSuffix: true })}`}
            </div>
          );
        })()}
      </div>

      {editingStartDate && (
        <DatePickerPopover value={task.startDate ?? null} onChange={startDate => {
          updateTask(task.id, { startDate }); setEditingStartDate(false);
        }} onClose={() => setEditingStartDate(false)} clearable anchorRef={startDateButtonRef} />
      )}
      {editingDate && (
        <DatePickerPopover value={task.date} onChange={date => {
          if (task.recurrenceGroupId) { setPendingUpdate({ field: 'date', value: date }); setEditingDate(false); }
          else { updateTask(task.id, { date }); setEditingDate(false); }
        }} onClose={() => setEditingDate(false)} clearable anchorRef={dateButtonRef} />
      )}
      {editingDeadline && (
        <DatePickerPopover value={task.deadline} onChange={deadline => {
          if (task.recurrenceGroupId) { setPendingUpdate({ field: 'deadline', value: deadline }); setEditingDeadline(false); }
          else { updateTask(task.id, { deadline }); setEditingDeadline(false); }
        }} onClose={() => setEditingDeadline(false)} clearable anchorRef={deadlineButtonRef} />
      )}
    </>,
    document.body
  );
}

export function DraggableTask({ task, showDate, isFocused = false, isSelected = false, onToggleSelect, isSuggested = false }: { key?: React.Key; task: Task; showDate?: boolean; isFocused?: boolean; isSelected?: boolean; onToggleSelect?: (taskId: string) => void; isSuggested?: boolean }) {
  const { projects, tasks, updateTask, setHoveredProjectId, getTaskTime, pomodoro } = useStore();
  const { showToast } = useToast();
  const project = projects.find(p => p.id === task.projectId);
  const parentProject = project?.parentId ? projects.find(p => p.id === project.parentId) : null;
  const projectLabel = parentProject ? `${parentProject.name} › ${project!.name}` : project?.name;

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState(task.title);
  useEffect(() => {
    if (!editingTitle) setTitleVal(task.title);
  }, [task.title, editingTitle]);
  const [showPopup, setShowPopup] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [checkAnim, setCheckAnim] = useState(false);
  const [completionNudge, setCompletionNudge] = useState<string | null>(null);
  const [confettiBurst, setConfettiBurst] = useState<{ x: number; y: number } | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const timeBadgeRef = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showNotesTooltip, setShowNotesTooltip] = useState(false);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setShowPopup(false), 80);
  };
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  const handleToggleComplete = () => {
    const wasCompleted = task.completed;
    const prevCompletedAt = task.completedAt;
    if (!wasCompleted) {
      setCheckAnim(true);
      setTimeout(() => setCheckAnim(false), 300);
      // Confetti burst for High priority tasks
      if ((task.priority ?? 'Low') === 'High' && cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        setConfettiBurst({ x: rect.left + 28, y: rect.top + rect.height / 2 });
      }
      // Friction: if project has other incomplete tasks, nudge
      if (task.projectId) {
        const siblings = tasks.filter(t => t.projectId === task.projectId && !t.completed && t.id !== task.id);
        if (siblings.length > 0) {
          const msg = `${siblings.length} task${siblings.length !== 1 ? 's' : ''} still remain in ${project?.name ?? 'this project'}`;
          setCompletionNudge(msg);
          setTimeout(() => setCompletionNudge(null), 5000);
        }
      }
    }
    updateTask(task.id, { completed: !wasCompleted, completedAt: !wasCompleted ? format(startOfToday(), 'yyyy-MM-dd') : null });
    showToast(
      wasCompleted ? 'Task uncompleted' : 'Task completed',
      () => updateTask(task.id, { completed: wasCompleted, completedAt: prevCompletedAt ?? null }),
    );
  };

  const { attributes, listeners, setNodeRef, isDragging, transform, transition } = useSortable({ id: task.id, data: { date: task.date } });
  const priority: Priority = task.priority ?? 'Low';
  const [priorityFlash, setPriorityFlash] = useState(false);

  const cyclePriority = (e: React.MouseEvent) => {
    e.stopPropagation();
    const key = task.priority ?? 'none';
    const next = PRIORITY_CYCLE[key];
    updateTask(task.id, { priority: next });
    setPriorityFlash(true);
    setTimeout(() => setPriorityFlash(false), 200);
  };

  const today = startOfToday();
  const deadlineDays = task.deadline ? differenceInDays(parseISO(task.deadline), today) : null;
  const dl = deadlineAccent(deadlineDays);
  const isOverdue = !task.completed && deadlineDays !== null && deadlineDays < 0;
  const daysStale = !task.completed && task.date ? differenceInDays(startOfToday(), parseISO(task.date)) : 0;

  // Dependency status: count completed vs total dependencies
  const depStatus = useMemo(() => {
    if (!task.dependencies?.length) return null;
    const total = task.dependencies.length;
    const done = task.dependencies.filter(depId => {
      const dep = tasks.find(t => t.id === depId);
      return dep?.completed;
    }).length;
    return { done, total, allMet: done === total };
  }, [task.dependencies, tasks]);

  // Streak: count consecutive days (ending at task's date or today) with a same-title completed task
  const streak = useMemo(() => {
    if (task.completed) return 0;
    const anchor = task.date ? parseISO(task.date) : today;
    const titleLower = task.title.toLowerCase();
    const completedDates = new Set(
      tasks
        .filter(t => t.completed && t.date && t.title.toLowerCase() === titleLower)
        .map(t => t.date!)
    );
    let count = 0;
    for (let i = 0; i < 365; i++) {
      const d = format(subDays(anchor, i), 'yyyy-MM-dd');
      if (completedDates.has(d)) count++;
      else break;
    }
    return count;
  }, [task.completed, task.title, task.date, tasks]);

  const saveTitle = () => {
    if (titleVal.trim()) updateTask(task.id, { title: titleVal.trim() });
    else setTitleVal(task.title);
    setEditingTitle(false);
  };

  // Priority left-border glow (overdue pulse animation handles its own border)
  const priorityGlowStyle: React.CSSProperties = isOverdue ? {} :
    !task.completed && priority === 'High' ? { borderLeft: '3px solid #ef4444' } :
    !task.completed && priority === 'Medium' ? { borderLeft: '3px solid #F27D26' } :
    {};
  const highGlowShadow = !task.completed && priority === 'High' ? 'inset 3px 0 8px -3px rgba(239,68,68,0.3), ' : '';

  // Project-based color tint (skipped for completed tasks)
  const cardBaseBg = task.completed
    ? '#141414'
    : (project?.color ? hexToRgba(project.color, 0.06) : (PRIORITY_BG[priority] || '#141414'));
  const projectTintBorder: React.CSSProperties = (!task.completed && project?.color)
    ? { borderTop: `2px solid ${hexToRgba(project.color, 0.3)}` }
    : {};

  // Combined ref: dnd + card
  const setRefs = (el: HTMLDivElement | null) => {
    (cardRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    setNodeRef(el);
  };

  // Auto-scroll focused task into view
  useEffect(() => {
    if (isFocused && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isFocused]);

  return (
    <>
      <div
        ref={setRefs}
        data-task-id={task.id}
        onClick={(e) => {
          if (e.shiftKey && onToggleSelect) {
            e.stopPropagation();
            onToggleSelect(task.id);
            return;
          }
          setShowPopup(prev => !prev);
        }}
        onMouseEnter={() => {
          hoveredTaskId = task.id; cancelClose(); setHoveredProjectId(task.projectId); setShowPopup(true);
          if (task.description) {
            tooltipTimer.current = setTimeout(() => setShowNotesTooltip(true), 500);
          }
        }}
        onMouseLeave={() => {
          hoveredTaskId = null; setHoveredProjectId(null); scheduleClose();
          if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
          setShowNotesTooltip(false);
        }}
        className={cn(
          'relative group flex flex-col border border-l-2 rounded cursor-grab',
          isSelected ? 'border-[color:var(--accent)]' : 'border-[#222]',
          task.completed ? 'border-l-[#333]' : isOverdue ? '' : PRIORITY_BORDER[priority],
          isOverdue && 'overdue-pulse',
          isDragging ? 'opacity-40 scale-[0.98]' : '',
          task.completed && 'opacity-40'
        )}
        style={{
          background: isSelected
            ? 'color-mix(in srgb, var(--accent) 8%, var(--bg-2))'
            : task.completed ? '#141414' : 'var(--bg-2)',
          boxShadow: (isSelected || isFocused)
            ? '0 0 0 2px var(--accent)'
            : '0 1px 3px rgba(0,0,0,0.3)',
          transform: CSS.Transform.toString(transform),
          transition,
          ...priorityGlowStyle,
        }}
      >
        <div className={cn('flex items-center gap-2 px-2', task.completed ? 'py-0.5' : 'py-1.5')}>
          <div {...attributes} {...listeners}
            className="opacity-0 group-hover:opacity-40 cursor-grab text-[#888] shrink-0 -ml-1">
            <GripVertical size={13} />
          </div>

          {/* Project color dot */}
          {project && (
            <div className="shrink-0 w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: project.color }} title={projectLabel} />
          )}

          {/* Checkbox */}
          <button onClick={handleToggleComplete}
            role="checkbox"
            aria-checked={task.completed}
            className={cn(
              'shrink-0 w-3.5 h-3.5 rounded-full border transition-colors',
              task.completed ? 'border-[var(--accent)]' : 'border-[#444] hover:border-[var(--accent)]'
            )}
            style={task.completed ? { background: 'var(--accent)' } : undefined}
          />

          {/* Title */}
          {editingTitle ? (
            <input autoFocus value={titleVal} onChange={e => setTitleVal(e.target.value)}
              onClick={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
              onBlur={saveTitle}
              onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitleVal(task.title); setEditingTitle(false); } }}
              className="flex-1 text-sm bg-transparent border-none focus:outline-none"
              style={{ color: task.completed ? '#555' : '#C8C7C4' }} />
          ) : (
            <span onDoubleClick={(e) => { e.stopPropagation(); setEditingTitle(true); setTitleVal(task.title); }}
              className={cn('flex-1 text-sm leading-snug cursor-text select-none truncate',
                task.completed ? 'line-through text-[#555]' : 'text-[#C8C7C4]'
              )} title={task.title}>{task.title}</span>
          )}

          {/* Only essential inline indicators */}
          {task.estimatedMinutes && !task.completed && (
            <span className="text-[9px] font-mono shrink-0 text-[#666]">
              {formatEstimate(task.estimatedMinutes)}
            </span>
          )}
          {dl && !task.completed && (
            <span className="text-[10px] font-mono shrink-0" style={{ color: dl.color, fontWeight: dl.bold ? 700 : undefined }}>
              {dl.label}
            </span>
          )}
          {pomodoro.taskId === task.id && pomodoro.phase === 'work' && (
            <span className="text-[11px] font-mono shrink-0 animate-pulse" style={{ color: 'var(--accent)' }}>▶</span>
          )}
          {task.taskStatus === 'blocked' && (
            <span className="text-[9px] shrink-0" style={{ color: '#ef4444' }}>●</span>
          )}
        </div>
        {/* Subtask progress — compact */}
        {(task.subtasks?.length ?? 0) > 0 && !task.completed && (() => {
          const total = task.subtasks!.length;
          const done = task.subtasks!.filter(s => s.done).length;
          return (
            <div className="px-2 pb-1 flex items-center gap-1" style={{ marginTop: -4 }}>
              <span className="text-[9px] font-mono text-[#555]">{done}/{total} subtasks</span>
            </div>
          );
        })()}
        {/* Snooze to tomorrow — absolute button on hover for incomplete tasks */}
        {!task.completed && (
          <button
            onClick={e => {
              e.stopPropagation();
              const prevDate = task.date;
              updateTask(task.id, { date: format(addDays(new Date(), 1), 'yyyy-MM-dd') });
              showToast('Snoozed to tomorrow', () => updateTask(task.id, { date: prevDate }));
            }}
            title="Snooze to tomorrow"
            className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[11px] font-mono px-1 py-0.5 rounded text-[#555] hover:text-[#ccc] hover:bg-[#2A2A2A] cursor-pointer z-10"
          >
            »
          </button>
        )}
        {/* Deadline progress bar */}
        {task.deadline && !task.completed && (() => {
          const totalDays = differenceInDays(parseISO(task.deadline), parseISO(task.startedAt || task.date || task.deadline));
          const daysLeft = differenceInDays(parseISO(task.deadline), startOfToday());
          const pct = Math.max(0, Math.min(1, daysLeft / Math.max(1, totalDays)));
          const color = pct > 0.5 ? '#3B82F6' : pct > 0.2 ? '#eab308' : pct > 0 ? '#F27D26' : '#ef4444';
          return (
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: `${pct * 100}%`,
                height: 2,
                borderRadius: 9999,
                backgroundColor: color,
              }}
            />
          );
        })()}
      </div>

      {showPopup && !isDragging && !editingTitle && (
        <TaskPopup task={task} anchorRef={cardRef}
          onClose={() => setShowPopup(false)}
          onOpenNotes={() => setShowNotes(true)}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        />
      )}
      {showTimePicker && !task.completed && (
        <TimeEstimatePicker
          anchorRef={timeBadgeRef}
          value={task.estimatedMinutes}
          onChange={(mins) => updateTask(task.id, { estimatedMinutes: mins })}
          onClose={() => setShowTimePicker(false)}
        />
      )}
      {showNotes && <TaskNotesModal task={task} onClose={() => setShowNotes(false)} />}
      {completionNudge && (
        <div className="mt-1 px-2 py-1 rounded text-[11px] font-mono animate-fade"
          style={{ background: 'rgba(234,179,8,0.08)', color: '#eab308', border: '1px solid rgba(234,179,8,0.2)' }}>
          ↑ {completionNudge}
        </div>
      )}
      {showNotesTooltip && !isDragging && task.description && cardRef.current && ReactDOM.createPortal(
        (() => {
          const rect = cardRef.current!.getBoundingClientRect();
          const preview = task.description!.length > 150
            ? task.description!.slice(0, 150) + '...'
            : task.description!;
          return (
            <div style={{
              position: 'fixed',
              top: rect.top - 8,
              left: rect.left + rect.width / 2,
              transform: 'translateX(-50%) translateY(-100%)',
              background: '#1a1a2e',
              color: 'white',
              padding: '8px 12px',
              borderRadius: 8,
              fontSize: 11,
              maxWidth: 250,
              zIndex: 50,
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              animation: 'fadeIn 200ms ease',
              pointerEvents: 'none',
              lineHeight: 1.4,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {preview}
              <div style={{
                position: 'absolute',
                bottom: -6,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 0,
                height: 0,
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: '6px solid #1a1a2e',
              }} />
            </div>
          );
        })(),
        document.body
      )}

      {confettiBurst && (
        <ConfettiBurst x={confettiBurst.x} y={confettiBurst.y} onDone={() => setConfettiBurst(null)} />
      )}
    </>
  );
}
