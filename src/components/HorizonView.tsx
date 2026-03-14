import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useStore, fmtDuration, type Task, type Project } from '../store';
import { addDays, differenceInDays, format, startOfToday, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, addMonths, parseISO, startOfYear, endOfYear, addYears, subDays, subWeeks, subMonths, subYears, getISOWeek, nextDay } from 'date-fns';

type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const DATE_KEYWORD_DAY_MAP: Record<string, DayIndex> = {
  '/sun': 0, '/sunday': 0,
  '/mon': 1, '/monday': 1,
  '/tue': 2, '/tuesday': 2,
  '/wed': 3, '/wednesday': 3,
  '/thu': 4, '/thursday': 4,
  '/fri': 5, '/friday': 5,
  '/sat': 6, '/saturday': 6,
};

/** Parse a `/keyword` date shortcut at the end of a quick-add title. */
function parseDateKeyword(input: string, defaultDate: Date): { title: string; date: Date } {
  const match = input.match(/\s+(\/\S+)$/i);
  if (!match) return { title: input.trim(), date: defaultDate };

  const keyword = match[1].toLowerCase();
  const today = startOfToday();
  let resolved: Date | null = null;

  if (keyword === '/today') {
    resolved = today;
  } else if (keyword === '/tomorrow' || keyword === '/tmr') {
    resolved = addDays(today, 1);
  } else if (keyword === '/next-week') {
    resolved = nextDay(today, 1);
  } else if (keyword in DATE_KEYWORD_DAY_MAP) {
    resolved = nextDay(today, DATE_KEYWORD_DAY_MAP[keyword]);
  }

  if (resolved) {
    const title = input.slice(0, match.index!).trim();
    return { title: title || input.trim(), date: resolved };
  }

  return { title: input.trim(), date: defaultDate };
}
import { useDroppable, useDndContext } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { DraggableTask } from './DraggableTask';
import { cn } from '../lib/utils';
import { MacroGoalsPanel } from './MacroGoalsPanel';
import { ThemePanel } from './ThemePanel';
import { ChevronLeft, ChevronRight, Eye, EyeOff, LayoutGrid, Flag, AppWindow, Palette, Timer, BarChart2, Inbox, Sun, ClipboardList, BookOpen, Crosshair } from 'lucide-react';
import { AnalyticsPanel } from './AnalyticsPanel';
import { InboxPanel } from './InboxPanel';
import { DailyBriefing } from './DailyBriefing';
import { WeeklyReview } from './WeeklyReview';
import { JournalPanel } from './JournalPanel';


type ViewMode = 'daily' | 'weekly' | 'monthly' | 'yearly';
type QuickFilter = 'overdue' | 'high-priority' | 'this-week' | 'no-deadline' | null;

export const inboxTrigger = { open: () => {} };

// Bulk selection trigger so App.tsx can clear selection on Escape
export const bulkSelectionTrigger = { clear: () => {} };

// Shared state for keyboard nav: column task counts and click triggers
let _columnTaskCounts: number[] = [];
let _columnTaskClickHandlers: Array<Array<() => void>> = [];

export function getColumnTaskCounts(): number[] {
  return _columnTaskCounts;
}

export function triggerTaskClick(colIndex: number, taskIndex: number): void {
  _columnTaskClickHandlers[colIndex]?.[taskIndex]?.();
}

function TaskCarousel({ items }: { items: { label: string; sublabel: string; accent: string; urgent: boolean }[] }) {
  if (items.length === 0) return (
    <div className="flex items-center justify-center h-full text-[11px] text-[#555] italic">none due</div>
  );

  const item = items[0];
  return (
    <div className="flex flex-col justify-center h-full overflow-hidden">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[14px] font-mono font-bold leading-none" style={{ color: item.accent }}>{item.label}</span>
        </div>
        <span className="text-[11px] font-semibold leading-tight truncate" style={{ color: '#C8C7C4' }} title={item.sublabel}>{item.sublabel}</span>
      </div>
    </div>
  );
}

function ProjectDeadlinesStrip({ onOpenGoals, filterProjectId, onFilterProject }: { onOpenGoals: () => void; filterProjectId: string | null; onFilterProject: (id: string | null) => void }) {
  const { projects, tasks } = useStore();
  const today = startOfToday();
  const scrollRef = useRef<HTMLDivElement>(null);
  const topLevel = projects
    .filter(p => !p.parentId)
    .sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });

  if (topLevel.length === 0) return null;

  const descendantIds = (id: string): string[] => {
    const kids = projects.filter(p => p.parentId === id);
    return [id, ...kids.flatMap(k => descendantIds(k.id))];
  };

  return (
    <div className="relative group border-b border-[#1E1E1E] shrink-0" style={{ background: 'var(--bg-0)' }}>
      {/* "Projects" label on far left */}
      <span className="absolute left-2 top-3 text-[9px] font-bold uppercase tracking-widest text-[#3A3A3A] z-10 pointer-events-none select-none">Projects</span>
      {/* Clear filter button */}
      {filterProjectId && (
        <button
          className="absolute left-2 bottom-0.5 z-10 text-[10px] font-mono text-[var(--accent)] hover:text-white flex items-center gap-0.5 transition-colors"
          onClick={() => onFilterProject(null)}
          title="Clear filter">
          × clear
        </button>
      )}
      {/* Left scroll arrow */}
      <button
        className="absolute left-0 top-0 bottom-0 z-10 w-8 flex items-center justify-center text-[#666] hover:text-[#bbb] opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: 'linear-gradient(to right, var(--bg-0) 60%, transparent)' }}
        onClick={() => scrollRef.current?.scrollBy({ left: -200, behavior: 'smooth' })}
        title="Scroll left">
        <span className="text-lg leading-none">‹</span>
      </button>
      {/* Right scroll arrow */}
      <button
        className="absolute right-0 top-0 bottom-0 z-10 w-8 flex items-center justify-center text-[#666] hover:text-[#bbb] opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: 'linear-gradient(to left, var(--bg-0) 60%, transparent)' }}
        onClick={() => scrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' })}
        title="Scroll right">
        <span className="text-lg leading-none">›</span>
      </button>
      {/* Scrollable cards */}
      <div ref={scrollRef} className="flex items-stretch pl-16 pr-8 gap-3 overflow-x-auto py-2">
        {topLevel.map(p => {
          const days = p.deadline ? differenceInDays(parseISO(p.deadline), today) : null;
          const overdue = days !== null && days < 0;
          const urgent = days !== null && days >= 0 && days <= 7;
          const soon = days !== null && days > 7 && days <= 30;
          const accent = overdue ? '#ef4444' : urgent ? 'var(--accent)' : soon ? '#666' : '#333';
          const noDeadline = days === null;
          const isFiltered = filterProjectId === p.id;

           const ids = descendantIds(p.id);
           const allProjectTasks = tasks.filter(t => ids.includes(t.projectId ?? ''));

          const upcomingTasks = allProjectTasks
            .filter(t => t.deadline && !t.completed)
            .map(t => ({ ...t, d: differenceInDays(parseISO(t.deadline!), today) }))
            .sort((a, b) => a.d - b.d);
          const taskItems = upcomingTasks.map(t => {
            const ov = t.d < 0; const urg = t.d >= 0 && t.d <= 3;
            const so = t.d > 3 && t.d <= 10;
            const a = ov ? '#ef4444' : urg ? 'var(--accent)' : so ? '#eab308' : '#3B82F6';
            const lbl = ov ? `${Math.abs(t.d)}d` : t.d === 0 ? 'today' : `${t.d}d`;
            const shifts = t.deadlineHistory?.length ?? 0;
            return { label: lbl, sublabel: `${shifts > 0 ? `↻${shifts} ` : ''}${t.title}`, accent: a, urgent: ov || urg };
          });

          return (
            <button key={p.id}
              onClick={() => onFilterProject(isFiltered ? null : p.id)}
              className="flex flex-col gap-0 rounded-lg shrink-0 hover:brightness-110 transition-all text-left overflow-hidden"
              style={{
                minWidth: 280,
                background: `${p.color}12`,
                border: isFiltered ? `2px solid ${p.color}` : `1px solid ${noDeadline ? '#252525' : accent + '50'}`,
                boxShadow: isFiltered ? `0 0 8px ${p.color}40` : undefined,
              }}>

              {/* ── Single row: accent bar + deadline + tasks ── */}
              <div className="flex items-stretch gap-0">
                {/* Left accent bar */}
                <div className="w-1 self-stretch shrink-0" style={{ background: noDeadline ? '#222' : accent }} />
                {/* Project deadline */}
                <div className="flex flex-col justify-center gap-0.5 px-3 py-2 min-w-[120px]">
                  <span className="text-[12px] font-medium truncate max-w-[120px]" title={p.name}>{p.name}</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[24px] font-mono leading-none" style={{ fontWeight: 600, color: noDeadline ? '#333' : overdue ? '#ef4444' : '#aaa' }}>
                      {noDeadline ? '—' : Math.abs(days!)}
                    </span>
                    <span className="text-[11px] font-mono uppercase" style={{ fontWeight: 600, color: noDeadline ? '#333' : overdue ? '#ef4444' : '#aaa' }}>
                      {noDeadline ? 'no date' : overdue ? 'over' : 'left'}
                    </span>
                  </div>
                </div>
                {/* Divider */}
                <div className="w-px self-stretch bg-[#1E1E1E]" />
                {/* Tasks */}
                <div className="flex flex-col justify-center px-3 py-2 w-[180px] overflow-hidden">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#666] mb-1">Tasks</span>
                  <TaskCarousel items={taskItems} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const baseDateTrigger = { setDate: (_d: Date) => {} };

function DailyGoalIndicator({ doneCount, dailyGoal, goalMet, ringSize, strokeW, radius, circumference, dashOffset, setDailyGoal }: {
  doneCount: number; dailyGoal: number; goalMet: boolean; ringSize: number; strokeW: number;
  radius: number; circumference: number; dashOffset: number; setDailyGoal: (n: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(String(dailyGoal));
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLSpanElement>(null);
  const [goalConfetti, setGoalConfetti] = useState<{ x: number; y: number } | null>(null);
  const prevGoalMet = useRef(goalMet);

  useEffect(() => {
    prevGoalMet.current = goalMet;
  }, [goalMet]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commitGoal = () => {
    const n = parseInt(inputVal, 10);
    if (!isNaN(n) && n >= 1 && n <= 20) setDailyGoal(n);
    setEditing(false);
  };

  const goalColor = goalMet ? '#22c55e' : 'var(--accent, #a78bfa)';

  return (
    <span
      ref={containerRef}
      className="flex items-center gap-1 cursor-pointer select-none"
      style={{ position: 'relative' }}
      onClick={() => { if (!editing) { setInputVal(String(dailyGoal)); setEditing(true); } }}
      title={goalMet ? 'Daily goal reached!' : `${doneCount}/${dailyGoal} — click to change goal`}
    >
      <svg width={ringSize} height={ringSize} style={{ display: 'block', transform: 'rotate(-90deg)' }}>
        <circle cx={ringSize / 2} cy={ringSize / 2} r={radius} fill="none"
          stroke="var(--border-1, #333)" strokeWidth={strokeW} />
        <circle cx={ringSize / 2} cy={ringSize / 2} r={radius} fill="none"
          stroke={goalColor} strokeWidth={strokeW}
          strokeDasharray={circumference} strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.4s ease, stroke 0.3s ease' }} />
      </svg>
      {goalMet ? (
        <span style={{ color: '#22c55e', fontSize: 10, filter: 'drop-shadow(0 0 3px rgba(34,197,94,0.5))' }}>
          {doneCount}/{dailyGoal} 🎯
        </span>
      ) : (
        <span style={{ color: goalColor, fontSize: 10 }}>
          {doneCount}/{dailyGoal} ✓
        </span>
      )}
      {editing && (
        <span
          style={{
            position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
            marginBottom: 4, background: 'var(--bg-2, #191919)', border: '1px solid var(--border-1, #333)',
            borderRadius: 4, padding: '2px 4px', zIndex: 100, display: 'flex', alignItems: 'center', gap: 2,
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}
          onClick={e => e.stopPropagation()}
        >
          <span style={{ fontSize: 9, color: 'var(--text-2, #888)', whiteSpace: 'nowrap' }}>Goal:</span>
          <input
            ref={inputRef}
            type="number" min={1} max={20}
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitGoal(); if (e.key === 'Escape') setEditing(false); }}
            onBlur={commitGoal}
            style={{
              width: 32, fontSize: 10, fontFamily: 'monospace', textAlign: 'center',
              background: 'var(--bg-1, #0f0f0f)', color: 'var(--text-1, #eee)',
              border: '1px solid var(--border-1, #333)', borderRadius: 3, padding: '1px 2px',
              outline: 'none',
            }}
          />
        </span>
      )}
    </span>
  );
}

/** Compact time tracking stat for the today summary footer with project breakdown popup. */
function TimeTrackingSummary({ todayStr, projects, tasks, timeEntries }: {
  todayStr: string;
  projects: Project[];
  tasks: { id: string; projectId: string | null }[];
  timeEntries: { taskId: string; startedAt: string; duration: number }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Time entries that started today
  const todayEntries = useMemo(
    () => timeEntries.filter(e => e.startedAt.startsWith(todayStr)),
    [timeEntries, todayStr],
  );

  const totalMs = useMemo(
    () => todayEntries.reduce((s, e) => s + e.duration, 0),
    [todayEntries],
  );

  // Per-project breakdown
  const projectBreakdown = useMemo(() => {
    const taskProjectMap = new Map<string, string | null>();
    for (const t of tasks) taskProjectMap.set(t.id, t.projectId);
    const projectMap = new Map<string, { project: Project | null; ms: number }>();
    for (const e of todayEntries) {
      const pid = taskProjectMap.get(e.taskId) ?? null;
      const key = pid ?? '__none__';
      if (!projectMap.has(key)) {
        projectMap.set(key, { project: pid ? projects.find(p => p.id === pid) ?? null : null, ms: 0 });
      }
      projectMap.get(key)!.ms += e.duration;
    }
    return [...projectMap.values()].filter(x => x.ms > 0).sort((a, b) => b.ms - a.ms);
  }, [todayEntries, tasks, projects]);

  if (totalMs === 0) return null;

  const maxMs = projectBreakdown.length > 0 ? projectBreakdown[0].ms : 1;

  return (
    <div ref={ref} className="relative flex items-center">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-0.5 cursor-pointer hover:brightness-125 transition-colors"
        style={{ color: 'var(--accent)', fontSize: 10, fontFamily: 'inherit' }}
        title="Time tracked today — click for breakdown"
      >
        ⏱ {fmtDuration(totalMs)}
      </button>

      {open && projectBreakdown.length > 0 && (
        <div
          className="absolute bottom-full mb-1 right-0 rounded-md shadow-lg z-50 py-1.5 px-2 text-[10px] font-mono"
          style={{
            background: 'var(--bg-1)',
            border: '1px solid var(--border-1)',
            minWidth: 180,
            animation: 'fade-in 0.12s ease-out',
          }}
        >
          <div className="mb-1" style={{ color: 'var(--text-2)', fontSize: 9 }}>
            Time tracked today
          </div>
          {projectBreakdown.map(({ project, ms }) => {
            const color = project?.color ?? 'var(--text-2)';
            const barPct = Math.max((ms / maxMs) * 100, 4);
            return (
              <div key={project?.id ?? '__none__'} className="flex items-center gap-1.5 py-0.5">
                <span
                  className="shrink-0 rounded-full"
                  style={{ width: 6, height: 6, background: color }}
                />
                <span className="truncate" style={{ color: 'var(--text-1)', maxWidth: 90 }}>
                  {project?.name ?? 'No project'}
                </span>
                <div className="flex-1 flex items-center" style={{ minWidth: 40 }}>
                  <div
                    className="rounded-full"
                    style={{ height: 4, width: `${barPct}%`, background: color, opacity: 0.7 }}
                  />
                </div>
                <span className="shrink-0 tabular-nums" style={{ color: 'var(--text-2)' }}>
                  {fmtDuration(ms)}
                </span>
              </div>
            );
          })}
          <div className="mt-1 pt-1" style={{ borderTop: '1px solid var(--border-1)', color: 'var(--accent)' }}>
            Total: {fmtDuration(totalMs)}
          </div>
        </div>
      )}
    </div>
  );
}

export function HorizonView({ focusedColumn, focusedTask }: { focusedColumn: number | null; focusedTask: number }) {
  const { projects, tasks, timeEntries, hideCompleted, toggleHideCompleted, startPomodoro, pomodoro, stopPomodoro, updateTask, deleteTask, dailyGoal, setDailyGoal } = useStore();
  const today = startOfToday();
  const todayStr = format(today, 'yyyy-MM-dd');
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [baseDate, setBaseDate] = useState<Date>(today);

  // Bulk task selection state
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  const clearSelection = useCallback(() => setSelectedTaskIds(new Set()), []);

  const toggleTaskSelection = useCallback((taskId: string) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  // Register clear trigger for App.tsx Escape key
  React.useEffect(() => { bulkSelectionTrigger.clear = clearSelection; }, [clearSelection]);

  React.useEffect(() => { baseDateTrigger.setDate = setBaseDate; }, []);
  React.useEffect(() => { inboxTrigger.open = () => setShowInbox(true); }, []);
  const [showProjects, setShowProjects] = useState(false);
  const [showInbox, setShowInbox] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const journalPanelRef = useRef<HTMLDivElement>(null);

  // Inbox badge: unscheduled + overdue incomplete tasks
  const inboxCount = tasks.filter(t => !t.completed && (t.date === null || t.date < todayStr)).length;
  // Live urgency counts
  const overdueCount = tasks.filter(t => !t.completed && t.date && t.date < todayStr).length;
  const todayCount   = tasks.filter(t => !t.completed && t.date === todayStr).length;
  const weekDeadlineCount = tasks.filter(t => {
    if (t.completed || !t.deadline) return false;
    const d = differenceInDays(parseISO(t.deadline), today);
    return d >= 0 && d <= 7;
  }).length;



  // Live countdown in browser tab title
  useEffect(() => {
    const updateTitle = () => {
      const now = new Date();
      const todayDate = format(now, 'yyyy-MM-dd');

      const overdueTasks = tasks.filter(t => !t.completed && t.deadline && t.deadline < todayDate);
      if (overdueTasks.length > 0) {
        document.title = `\u{1F534} ${overdueTasks.length} overdue | Calendar`;
        return;
      }

      const dueTodayTasks = tasks.filter(t => !t.completed && t.deadline === todayDate);
      if (dueTodayTasks.length > 0) {
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);
        const hoursLeft = Math.max(0, Math.floor((endOfDay.getTime() - now.getTime()) / (1000 * 60 * 60)));
        document.title = `\u23F0 ${hoursLeft}h left \u00B7 ${dueTodayTasks[0].title} | Calendar`;
        return;
      }

      const tomorrowStr = format(addDays(now, 1), 'yyyy-MM-dd');
      const dueTomorrowTasks = tasks.filter(t => !t.completed && t.deadline === tomorrowStr);
      if (dueTomorrowTasks.length > 0) {
        document.title = `\u{1F4C5} Tomorrow \u00B7 ${dueTomorrowTasks[0].title} | Calendar`;
        return;
      }

      document.title = '\u2713 All clear | Calendar';
    };

    updateTitle();
    const interval = setInterval(updateTitle, 60000);
    return () => clearInterval(interval);
  }, [tasks]);

  const [showTheme, setShowTheme] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const [focusMode, setFocusMode] = useState(false);
  const [filterProjectId, setFilterProjectId] = useState<string | null>(() => {
    const saved = localStorage.getItem('calendar-filter-project');
    return saved || null;
  });
  // Persist project filter to localStorage
  useEffect(() => {
    if (filterProjectId) localStorage.setItem('calendar-filter-project', filterProjectId);
    else localStorage.removeItem('calendar-filter-project');
  }, [filterProjectId]);

  // Validate saved project still exists
  useEffect(() => {
    if (filterProjectId && !projects.find(p => p.id === filterProjectId)) {
      setFilterProjectId(null);
    }
  }, [filterProjectId, projects]);

  const [quickFilter, setQuickFilter] = useState<QuickFilter>(null);
  const [horizonLengths, setHorizonLengths]= useState<Record<ViewMode, number | ''>>({
    daily: 90,
    weekly: 14,
    monthly: 12,
    yearly: 5
  });
  const [colWidths, setColWidths] = useState<Record<ViewMode, number>>({
    daily: 240,
    weekly: 280,
    monthly: 540,
    yearly: 640,
  });
  const projectsPanelRef = useRef<HTMLDivElement>(null);
  const inboxPanelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);


  // Auto-scroll to today's column on initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      const todayEl = scrollContainerRef.current?.querySelector('[data-today]');
      todayEl?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Smooth-scroll to start when navigating dates
  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
  }, [baseDate]);

  // Close projects panel when clicking outside
  useEffect(() => {
    if (!showProjects) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Element;
      if (target.closest?.('[data-date-picker-portal]')) return;
      if (projectsPanelRef.current && !projectsPanelRef.current.contains(target)) {
        setShowProjects(false);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [showProjects]);

  // Close inbox panel when clicking outside
  useEffect(() => {
    if (!showInbox) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Element;
      // Don't close if click is inside the inbox panel or inside a portal popup (TaskPopup, DatePicker etc.)
      if (inboxPanelRef.current?.contains(target)) return;
      if (target.closest('[data-no-inbox-close]')) return;
      if (target.closest('[data-date-picker-portal]')) return;
      setShowInbox(false);
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [showInbox]);

  // Close journal panel when clicking outside
  useEffect(() => {
    if (!showJournal) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Element;
      if (journalPanelRef.current?.contains(target)) return;
      if (target.closest('[data-no-inbox-close]')) return;
      if (target.closest('[data-date-picker-portal]')) return;
      setShowJournal(false);
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [showJournal]);

  const currentLength = Math.max(1, typeof horizonLengths[viewMode] === 'number' ? (horizonLengths[viewMode] as number) : 1);

  let columns: { startDate: Date; endDate: Date }[] = [];
  if (viewMode === 'daily') {
    columns = Array.from({ length: currentLength }).map((_, i) => {
      const d = addDays(baseDate, i);
      return { startDate: d, endDate: d };
    });
  } else if (viewMode === 'weekly') {
    const start = startOfWeek(baseDate, { weekStartsOn: 1 });
    columns = Array.from({ length: currentLength }).map((_, i) => {
      const d = addWeeks(start, i);
      return { startDate: d, endDate: endOfWeek(d, { weekStartsOn: 1 }) };
    });
  } else if (viewMode === 'monthly') {
    const start = startOfMonth(baseDate);
    columns = Array.from({ length: currentLength }).map((_, i) => {
      const d = addMonths(start, i);
      return { startDate: d, endDate: endOfMonth(d) };
    });
  } else if (viewMode === 'yearly') {
    const start = startOfYear(baseDate);
    columns = Array.from({ length: currentLength }).map((_, i) => {
      const d = addYears(start, i);
      return { startDate: d, endDate: endOfYear(d) };
    });
  }

  const navigate = (dir: 1 | -1) => {
    setBaseDate(prev => {
      if (viewMode === 'daily') return dir > 0 ? addDays(prev, currentLength) : subDays(prev, currentLength);
      if (viewMode === 'weekly') return dir > 0 ? addWeeks(prev, currentLength) : subWeeks(prev, currentLength);
      if (viewMode === 'monthly') return dir > 0 ? addMonths(prev, currentLength) : subMonths(prev, currentLength);
      return dir > 0 ? addYears(prev, currentLength) : subYears(prev, currentLength);
    });
  };

  return (
    <div className="flex flex-col h-full w-full" style={{ background: 'var(--bg-1)' }}>

      {/* Toolbar */}
      <div className="h-12 shrink-0 flex items-center gap-0 px-4 border-b border-[#1E1E1E]" style={{ background: 'var(--bg-0)' }}>
        {/* Logo / App title */}
        <span className="text-[13px] font-semibold tracking-wide shrink-0 mr-5" style={{ color: 'var(--text-1)' }}>Horizon</span>

        {/* Nav */}
        <div className="flex items-center gap-0 mr-3">
          <button onClick={() => navigate(-1)} aria-label="Previous period" className="w-7 h-7 flex items-center justify-center rounded-md text-[#666] hover:text-[var(--text-1)] hover:bg-[#1A1A1A] transition-colors">
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => setBaseDate(today)} title="Go to today" className="text-[11px] font-medium px-2.5 py-1 rounded-md border border-[#333] hover:bg-[#1A1A1A] transition-colors" style={{ color: 'var(--text-1)' }}>
            Today
          </button>
          <button onClick={() => navigate(1)} aria-label="Next period" className="w-7 h-7 flex items-center justify-center rounded-md text-[#666] hover:text-[var(--text-1)] hover:bg-[#1A1A1A] transition-colors">
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Date range */}
        <span className="text-[13px] text-[#aaa] font-mono mr-auto tracking-wider">
          {format(columns[0].startDate, 'MMM d')} – {format(columns[columns.length - 1].endDate, 'MMM d, yyyy')}
        </span>

        {/* Cluster divider 1 */}
        <span className="w-px h-5 bg-white/10 mx-3 shrink-0" />

        {/* View mode segmented control */}
        <div className="flex items-center gap-0.5">
          {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(mode => {
            const labels: Record<string, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };
            const active = viewMode === mode;
            return (
              <button key={mode} onClick={() => setViewMode(mode)}
                aria-label={`${labels[mode]} view`}
                title={labels[mode]}
                className={cn(
                  'text-[11px] font-medium px-2 py-1 rounded-md transition-all duration-150 select-none focus-visible:ring-1 focus-visible:ring-[#333] outline-none',
                  active ? 'bg-[#1A1A1A] text-[var(--text-1)]' : 'text-[#555] hover:text-[var(--text-1)]'
                )}>
                {labels[mode]}
              </button>
            );
          })}
        </div>

        {/* Periods stepper */}
        <div className="flex items-center gap-1 ml-2 bg-[#0A0A0A] rounded-lg border border-[#252525] px-2 h-8">
          <span className="text-[11px] text-[#444] select-none">×</span>
          <button
            onClick={() => setHorizonLengths(prev => ({ ...prev, [viewMode]: Math.max(1, (prev[viewMode] as number) - 1) }))}
            className="w-4 h-4 flex items-center justify-center text-[#555] hover:text-[#bbb] transition-colors text-[14px] leading-none"
            title="Fewer periods">−</button>
          <input type="number" value={horizonLengths[viewMode]}
            onChange={e => {
              const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
              setHorizonLengths(prev => ({ ...prev, [viewMode]: val }));
            }}
            className="bg-transparent text-[#ccc] text-[12px] font-mono w-7 text-center focus-visible:ring-1 focus-visible:ring-[#333] outline-none"
            min="1" max="365"
          />
          <button
            onClick={() => setHorizonLengths(prev => ({ ...prev, [viewMode]: Math.min(365, (prev[viewMode] as number) + 1) }))}
            className="w-4 h-4 flex items-center justify-center text-[#555] hover:text-[#bbb] transition-colors text-[14px] leading-none"
            title="More periods">+</button>
        </div>

        {/* Cluster divider 2 */}
        <span className="w-px h-5 bg-white/10 mx-3 shrink-0" />

        {/* Right icon cluster */}
        <div className="flex items-center gap-0.5">
          {/* Hide done */}
          <button onClick={toggleHideCompleted}
            className={cn('w-7 h-7 flex items-center justify-center rounded-md transition-colors',
              hideCompleted ? '' : 'text-[#666] hover:text-[var(--text-1)] hover:bg-[#1A1A1A]'
            )}
            style={hideCompleted ? { color: 'var(--accent)' } : undefined}
            title={hideCompleted ? 'Show completed tasks' : 'Hide completed tasks'}>
            {hideCompleted ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>

          {/* Focus mode */}
          <button onClick={() => setFocusMode(f => !f)}
            className={cn('w-7 h-7 flex items-center justify-center rounded-md transition-colors',
              focusMode ? '' : 'text-[#666] hover:text-[var(--text-1)] hover:bg-[#1A1A1A]'
            )}
            style={focusMode ? { color: 'var(--accent)' } : undefined}
            title={focusMode ? 'Disable focus mode' : 'Focus on today'}>
            <Crosshair size={15} />
          </button>

          {/* Goals */}
          <button onClick={() => { setShowProjects(p => !p); setShowInbox(false); }}
            className={cn('w-7 h-7 flex items-center justify-center rounded-md transition-colors',
              showProjects ? '' : 'text-[#666] hover:text-[var(--text-1)] hover:bg-[#1A1A1A]'
            )}
            style={showProjects ? { color: 'var(--accent)' } : undefined}
            title="Goals">
            <LayoutGrid size={15} />
          </button>

          {/* Inbox */}
          <button onClick={() => { setShowInbox(p => !p); setShowProjects(false); }}
            className={cn('w-7 h-7 flex items-center justify-center rounded-md transition-colors relative',
              showInbox ? '' : 'text-[#666] hover:text-[var(--text-1)] hover:bg-[#1A1A1A]'
            )}
            style={showInbox ? { color: 'var(--accent)' } : undefined}
            title="Inbox">
            <Inbox size={15} />
            {inboxCount > 0 && (
              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
            )}
          </button>

          {/* Journal */}
          <button onClick={() => setShowJournal(p => !p)}
            className={cn('w-7 h-7 flex items-center justify-center rounded-md transition-colors',
              showJournal ? '' : 'text-[#666] hover:text-[var(--text-1)] hover:bg-[#1A1A1A]'
            )}
            style={showJournal ? { color: 'var(--accent)' } : undefined}
            title="Daily Journal">
            <BookOpen size={15} />
          </button>

          {/* Analytics */}
          <button
            onClick={() => setShowAnalytics(p => !p)}
            title="Time Analytics"
            className={cn('w-7 h-7 flex items-center justify-center rounded-md transition-colors',
              showAnalytics ? '' : 'text-[#666] hover:text-[var(--text-1)] hover:bg-[#1A1A1A]'
            )}
            style={showAnalytics ? { color: 'var(--accent)' } : undefined}>
            <BarChart2 size={15} />
          </button>

          {/* Theme */}
          <div className="relative">
            <button onClick={() => setShowTheme(p => !p)} title="Theme"
              className={cn('w-7 h-7 flex items-center justify-center rounded-md transition-colors',
                showTheme ? '' : 'text-[#666] hover:text-[var(--text-1)] hover:bg-[#1A1A1A]'
              )}
              style={showTheme ? { color: 'var(--accent)' } : undefined}>
              <Palette size={15} />
            </button>
            {showTheme && <ThemePanel onClose={() => setShowTheme(false)} />}
          </div>
        </div>
      </div>

      {/* Goals overlay panel */}
      {showProjects && (
        <div ref={projectsPanelRef} className="absolute top-12 left-0 right-0 z-40 border border-[#1E1E1E] rounded-lg overflow-hidden animate-panel-in" style={{ background: 'var(--bg-0)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          <MacroGoalsPanel />
        </div>
      )}

      {/* Inbox overlay panel */}
      {showInbox && (
        <div ref={inboxPanelRef} className="absolute top-12 right-0 z-40 w-[420px] border border-[#1E1E1E] rounded-lg overflow-hidden animate-panel-in" style={{ background: 'var(--bg-0)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          <InboxPanel onClose={() => setShowInbox(false)} />
        </div>
      )}

      {/* Journal overlay panel */}
      {showJournal && (
        <div ref={journalPanelRef} className="absolute top-12 right-0 z-40 border border-[#1E1E1E] rounded-lg overflow-hidden animate-panel-in" style={{ background: 'var(--bg-0)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          <JournalPanel onClose={() => setShowJournal(false)} />
        </div>
      )}

      {/* Always-visible project deadlines strip */}
      <ProjectDeadlinesStrip onOpenGoals={() => setShowProjects(true)} filterProjectId={filterProjectId} onFilterProject={setFilterProjectId} />

      {/* Timeline Scroll Container */}
      <div ref={scrollContainerRef} className="flex-1 overflow-x-auto flex relative min-h-0">
        <div
          className="flex min-w-full h-full"
        >
          {columns.map((col, index) => (
            <TimeColumn 
              key={col.startDate.toISOString()} 
              startDate={col.startDate} 
              endDate={col.endDate}
              mode={viewMode}
              index={index}
              hideCompleted={hideCompleted}
              filterProjectId={filterProjectId}
              quickFilter={quickFilter}
              colWidth={colWidths[viewMode]}
              onResizeCol={(newWidth) => setColWidths(prev => ({ ...prev, [viewMode]: Math.max(160, Math.min(900, newWidth)) }))}
              focusMode={focusMode}
              isFocused={focusedColumn === index}
              focusedTaskIndex={focusedColumn === index ? focusedTask : -1}
              totalColumns={columns.length}
              selectedTaskIds={selectedTaskIds}
              onToggleTaskSelection={toggleTaskSelection}

            />
          ))}
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedTaskIds.size > 0 && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-2.5 rounded-full shadow-lg"
          style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)' }}
        >
          <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
            {selectedTaskIds.size} selected
          </span>
          <div className="w-px h-5" style={{ background: 'var(--border-1)' }} />
          <button
            onClick={() => {
              selectedTaskIds.forEach(id => updateTask(id, { completed: true, completedAt: format(today, 'yyyy-MM-dd') }));
              clearSelection();
            }}
            className="text-sm px-3 py-1 rounded-md transition-colors hover:brightness-125"
            style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' }}
          >✓ Complete all</button>
          <button
            onClick={() => {
              const tomorrow = format(addDays(today, 1), 'yyyy-MM-dd');
              selectedTaskIds.forEach(id => updateTask(id, { date: tomorrow }));
              clearSelection();
            }}
            className="text-sm px-3 py-1 rounded-md transition-colors hover:brightness-125"
            style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--text-1)' }}
          >→ Move to tomorrow</button>
          <button
            onClick={() => {
              selectedTaskIds.forEach(id => deleteTask(id));
              clearSelection();
            }}
            className="text-sm px-3 py-1 rounded-md transition-colors hover:brightness-125"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
          >🗑 Delete all</button>
          <button
            onClick={clearSelection}
            className="text-sm px-2 py-1 rounded-md transition-colors"
            style={{ color: 'var(--text-2)' }}
          >✕</button>
        </div>
      )}

      {/* Today summary footer — clean and minimal */}
      {(() => {
        const todayTasks = tasks.filter(t => t.date === todayStr && !t.completed);
        const todayDone = tasks.filter(t => t.completedAt === todayStr);
        return (
          <div
            className="h-7 shrink-0 flex items-center justify-center gap-3 text-[11px] text-[#555]"
            style={{ background: 'var(--bg-0)', borderTop: '1px solid var(--border-1)' }}
          >
            <span>{todayTasks.length} remaining</span>
            <span>·</span>
            <span style={{ color: todayDone.length > 0 ? '#4ade80' : undefined }}>{todayDone.length} done</span>
            {overdueCount > 0 && <>
              <span>·</span>
              <span style={{ color: '#ef4444' }}>{overdueCount} overdue</span>
            </>}
          </div>
        );
      })()}
      {showAnalytics && <AnalyticsPanel onClose={() => setShowAnalytics(false)} />}

    </div>
  );
}

function TimeColumn({ startDate, endDate, mode, index, hideCompleted, filterProjectId, quickFilter, colWidth, onResizeCol, focusMode, isFocused, focusedTaskIndex, totalColumns, selectedTaskIds, onToggleTaskSelection }: { key?: React.Key; startDate: Date; endDate: Date; mode: ViewMode; index: number; hideCompleted: boolean; filterProjectId: string | null; quickFilter: QuickFilter; colWidth: number; onResizeCol: (newWidth: number) => void; focusMode: boolean; isFocused: boolean; focusedTaskIndex: number; totalColumns: number; selectedTaskIds: Set<string>; onToggleTaskSelection: (taskId: string) => void }) {
  const { tasks, projects, updateTask, addTask } = useStore();
  const today = startOfToday();
  const todayStr = format(today, 'yyyy-MM-dd');
  const startDateStr = format(startDate, 'yyyy-MM-dd');
  const endDateStr = format(endDate, 'yyyy-MM-dd');
  const [quickAddValue, setQuickAddValue] = useState('');
  const isPastColumn = endDate < today;
  const weekNumber = getISOWeek(startDate);
  const weekBadge = (
    <span style={{ fontSize: '9px', fontFamily: 'monospace', color: 'var(--text-2, #666)', opacity: 0.7, marginLeft: 4 }}>
      W{weekNumber}
    </span>
  );

  // Compute all descendant project IDs for the active filter
  const getDescendantIds = (id: string): string[] => {
    const kids = projects.filter(p => p.parentId === id);
    return [id, ...kids.flatMap(k => getDescendantIds(k.id))];
  };
  const filterProjectIds = filterProjectId ? getDescendantIds(filterProjectId) : null;

  const allColumnTasks = tasks.filter(t => {
    if (!t.date || t.date < startDateStr || t.date > endDateStr) return false;
    if (filterProjectIds && !filterProjectIds.includes(t.projectId ?? '')) return false;
    return true;
  });
  const quickFilterFn = (t: Task) => {
    if (!quickFilter) return true;
    if (quickFilter === 'overdue')       return t.date && t.date < todayStr;
    if (quickFilter === 'high-priority') return t.priority === 'High';
    if (quickFilter === 'this-week') {
      const ws = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const we = format(endOfWeek(today,   { weekStartsOn: 1 }), 'yyyy-MM-dd');
      return t.date && t.date >= ws && t.date <= we;
    }
    if (quickFilter === 'no-deadline')   return !t.deadline;
    return true;
  };

  const columnTasks = (hideCompleted ? allColumnTasks.filter(t => !t.completed) : allColumnTasks)
    .filter(quickFilterFn)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  // Completed tasks for collapsible section
  const completedColumnTasks = allColumnTasks.filter(t => t.completed).filter(quickFilterFn)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const completedCount = completedColumnTasks.length;

  // Expandable completed section state
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const completedSectionRef = useRef<HTMLDivElement>(null);

  // Must be computed before suggestedTaskId useMemo which depends on it
  const isCurrent = today >= startDate && today <= endDate;

  // Suggested next task — only for today's column, among incomplete tasks
  const suggestedTaskId = useMemo(() => {
    if (!isCurrent) return null;
    const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const tomorrowStr = format(addDays(today, 1), 'yyyy-MM-dd');
    let bestId: string | null = null;
    let bestScore = -1;
    for (const t of columnTasks) {
      if (t.completed) continue;
      let score = 0;
      if (t.priority === 'High') score += 30;
      else if (t.priority === 'Medium') score += 15;
      if (t.deadline) {
        if (t.deadline === todayStr) score += 25;
        else if (t.deadline === tomorrowStr) score += 20;
        else if (t.deadline >= weekStart && t.deadline <= weekEnd) score += 10;
      }
      if (t.estimatedMinutes != null && t.estimatedMinutes <= 30) score += 15;
      if (t.date) {
        const age = differenceInDays(today, parseISO(t.date));
        if (age >= 3) score += 10;
      }
      if (score > bestScore) { bestScore = score; bestId = t.id; }
    }
    return bestScore > 0 ? bestId : null;
  }, [isCurrent, columnTasks, todayStr, today]);

  // Ghost tasks: deadline falls in this column, but work date is elsewhere
  const ghostTasks = tasks.filter(t =>
    !t.completed &&
    t.deadline && t.deadline >= startDateStr && t.deadline <= endDateStr &&
    !(t.date && t.date >= startDateStr && t.date <= endDateStr) &&
    (!filterProjectIds || filterProjectIds.includes(t.projectId ?? ''))
  );
  const deadlineProjects = projects.filter(p => p.deadline && p.deadline >= startDateStr && p.deadline <= endDateStr);

  // Register task counts and click handlers for keyboard navigation
  useEffect(() => {
    if (index === 0) {
      _columnTaskCounts = new Array(totalColumns).fill(0);
      _columnTaskClickHandlers = new Array(totalColumns).fill(null).map(() => []);
    }
    _columnTaskCounts[index] = columnTasks.length;
    _columnTaskClickHandlers[index] = columnTasks.map(task => () => {
      // Simulate clicking on the task — trigger the popup via DOM
      const el = document.querySelector(`[data-task-id="${task.id}"]`) as HTMLElement | null;
      el?.click();
    });
  }, [index, totalColumns, columnTasks]);

  // Auto-scroll focused column into view
  const columnRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isFocused && columnRef.current) {
      columnRef.current.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    }
  }, [isFocused]);

  const { setNodeRef, isOver } = useDroppable({
    id: startDateStr,
  });

  const { active } = useDndContext();
  const activeTask = active?.id ? tasks.find(t => t.id === active.id) : null;
  const isPastDeadline = isOver && activeTask?.deadline && activeTask.deadline < startDateStr;

  const isWeekend = startDate.getDay() === 0 || startDate.getDay() === 6;

  // Capacity heatmap tint for header (daily/weekly only)
  const activeCount = columnTasks.filter(t => !t.completed).length;
  const capacityBg = (mode === 'daily' || mode === 'weekly')
    ? activeCount >= 7 ? 'rgba(239, 68, 68, 0.07)'
      : activeCount >= 4 ? 'rgba(234, 179, 8, 0.06)'
      : activeCount >= 1 ? 'rgba(74, 222, 128, 0.05)'
      : undefined
    : undefined;

  // Capacity indicator: estimated work hours vs available hours
  const activeTasks = columnTasks.filter(t => !t.completed);
  const totalEstimatedMinutes = activeTasks.reduce((s, t) => s + (t.estimatedMinutes ?? 0), 0);
  const hasEstimates = activeTasks.some(t => t.estimatedMinutes != null && t.estimatedMinutes > 0);
  const availableMinutes = (() => {
    let mins = 0;
    const d = new Date(startDate);
    while (d <= endDate) {
      if (d.getDay() !== 0 && d.getDay() !== 6) mins += 480;
      d.setDate(d.getDate() + 1);
    }
    return mins;
  })();
  const estLabel = totalEstimatedMinutes >= 60
    ? `~${Math.floor(totalEstimatedMinutes / 60)}h ${totalEstimatedMinutes % 60}m`
    : totalEstimatedMinutes > 0 ? `~${totalEstimatedMinutes}m` : '';
  const capacityPct = availableMinutes > 0
    ? totalEstimatedMinutes / availableMinutes
    : (totalEstimatedMinutes > 0 ? 2 : 0); // treat weekend with tasks as overloaded
  const isOverloaded = capacityPct > 1;
  const capacityBarColor = isOverloaded ? '#a855f7' : capacityPct > 0.9 ? '#ef4444' : capacityPct > 0.6 ? '#eab308' : '#4ade80';
  const capacityFill = Math.min(capacityPct, 1);

  // Combined ref: droppable + keyboard nav scroll
  const setColumnRefs = (el: HTMLDivElement | null) => {
    setNodeRef(el);
    (columnRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
  };

  return (
    <div 
      ref={setColumnRefs}
      {...(isCurrent ? { 'data-today': '' } : undefined)}
      className={cn(
        "border-r border-[#1E1E1E] flex flex-col h-full min-h-0 transition-colors duration-150 relative",
        isOver && !isPastDeadline && "bg-white/[0.02]",
        isPastDeadline && "bg-[#ef4444]/10",
        isWeekend && !isOver && "bg-[#0A0A0A]/50",
      )}
      style={{
        flex: `1 0 ${colWidth}px`,
        transition: 'opacity 0.3s, box-shadow 0.2s',
        ...(focusMode && !isCurrent ? { opacity: 0.2, pointerEvents: 'none' as const } : undefined),
        ...(isCurrent ? { borderLeft: '2px solid var(--accent)', background: 'color-mix(in srgb, var(--accent) 5%, transparent)' } : undefined),
        ...(isFocused ? { boxShadow: 'inset 0 0 0 2px color-mix(in srgb, var(--accent) 40%, transparent)' } : undefined),
      }}
    >
      {/* Drag-to-resize handle on right edge */}
      <div
        className="absolute top-0 right-0 w-1.5 h-full z-20 cursor-col-resize group/resize"
        onMouseDown={e => {
          e.preventDefault();
          const startX = e.clientX;
          const startWidth = colWidth;
          const onMove = (ev: MouseEvent) => onResizeCol(ev.clientX - startX + startWidth);
          const onUp = (ev: MouseEvent) => {
            onResizeCol(ev.clientX - startX + startWidth);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
          };
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
        }}
      >
        <div className="absolute right-0 top-0 w-px h-full opacity-0 group-hover/resize:opacity-100 transition-opacity" style={{ background: 'var(--accent)' }} />
      </div>
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-[#1E1E1E] shrink-0 relative"
        style={{
          ...(isCurrent ? {} : undefined),
        }}>
        {isCurrent && (
          <span className="text-[10px] font-medium" style={{ color: 'var(--accent)' }}>
            Today
          </span>
        )}
        {mode === 'daily' && (
          <>
            <div className="flex justify-between items-baseline">
              <span className="text-[10px] uppercase tracking-wider font-medium"
                style={{ color: '#555' }}>
                {format(startDate, 'EEE')}
              </span>
              <span className="text-[13px] font-semibold"
                style={{ color: 'var(--text-1)' }}>
                {format(startDate, 'dd')}
              </span>
            </div>
            <div className="text-[12px] text-[#aaa] font-mono mt-1">
              {format(startDate, 'MMM yyyy')}
              {estLabel && <span className="ml-2 text-[#666]">{estLabel}</span>}
            </div>
          </>
        )}
        {mode === 'weekly' && (
          <>
            <div className="text-sm font-bold uppercase tracking-wider"
              style={{ color: isCurrent ? 'var(--accent)' : '#8E9299' }}>
              Week of {format(startDate, 'MMM d')}
            </div>
            <div className="text-[12px] text-[#aaa] font-mono mt-1">
              {format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}
              {estLabel && <span className="ml-2 text-[#666]">{estLabel}</span>}
            </div>
          </>
        )}
        {mode === 'monthly' && (
          <>
            <div className="text-lg font-bold uppercase tracking-wider"
              style={{ color: isCurrent ? 'var(--accent)' : '#8E9299' }}>
              {format(startDate, 'MMMM')}
            </div>
            <div className="text-[12px] text-[#aaa] font-mono mt-1">
              {format(startDate, 'yyyy')}
              {estLabel && <span className="ml-2 text-[#666]">{estLabel}</span>}
            </div>
          </>
        )}
        {mode === 'yearly' && (
          <>
            <div className="text-lg font-bold uppercase tracking-wider"
              style={{ color: isCurrent ? 'var(--accent)' : '#8E9299' }}>
              {format(startDate, 'yyyy')}
            </div>
            <div className="text-[12px] text-[#aaa] font-mono mt-1">
              Jan – Dec
              {estLabel && <span className="ml-2 text-[#666]">{estLabel}</span>}
            </div>
          </>
        )}
      </div>
      {deadlineProjects.length > 0 && (
        <div className="p-2 border-b border-[#1E1E1E] bg-[#1A1A1A]/80 flex flex-col gap-1.5">
          {deadlineProjects.map(p => {
            const isDueToday = p.deadline === format(today, 'yyyy-MM-dd');
            const remaining = tasks.filter(t => t.projectId === p.id && !t.completed).length;
            return (
              <div
                key={p.id}
                className={cn(
                  'px-2 py-1.5 rounded text-xs font-bold uppercase tracking-wider flex items-center justify-between',
                  isDueToday && 'deadline-alarm'
                )}
                style={{ backgroundColor: `${p.color}18`, color: p.color, border: `1px solid ${isDueToday ? p.color + 'cc' : p.color + '40'}` }}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {isDueToday && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: p.color }} />}
                  <span className="truncate" title={p.name}>{p.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {remaining > 0 && (
                    <span className="text-[10px] font-mono opacity-80">{remaining} left</span>
                  )}
                  <span>DUE</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tasks Area */}
      <div className="flex-1 px-2.5 py-2 overflow-y-auto flex flex-col gap-2.5">
        {isOver && (
          <div className="flex justify-center px-2">
            <div className="w-full h-[2px] rounded-full opacity-40" style={{ background: 'var(--accent)' }} />
          </div>
        )}

        {/* Overdue tasks — only shown in today's column */}
        {isCurrent && (() => {
          const overdueTasks = tasks.filter(t =>
            !t.completed && t.date && t.date < todayStr &&
            (!filterProjectIds || filterProjectIds.includes(t.projectId ?? ''))
          );
          if (overdueTasks.length === 0) return null;
          return (
            <>
              <div className="flex items-center gap-2 select-none">
                <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#ef4444' }}>● Overdue · {overdueTasks.length}</span>
                <button
                  onClick={() => overdueTasks.forEach(t => updateTask(t.id, { date: todayStr }))}
                  className="text-[10px] font-mono text-[#666] hover:text-[#ef4444] transition-colors ml-auto"
                  title="Move all overdue to today"
                >→ today</button>
                <div className="h-px flex-1" style={{ background: '#ef444430' }} />
              </div>
              {overdueTasks.map(t => {
                return (
                  <div key={`overdue-${t.id}`} style={{ opacity: 0.85 }}>
                    <DraggableTask task={t} showDate={mode !== 'daily'} isSelected={selectedTaskIds.has(t.id)} onToggleSelect={onToggleTaskSelection} />
                  </div>
                );
              })}
              <div className="h-px" style={{ background: '#ef444420' }} />
            </>
          );
        })()}
        <SortableContext items={columnTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {columnTasks.map((task, taskIdx) => {
            const isPastUnfinished = !task.completed && task.date && task.date < format(today, 'yyyy-MM-dd');
            return (
              <div key={task.id} style={isPastUnfinished ? { opacity: 0.6 } : undefined}>
                <DraggableTask task={task} showDate={mode !== 'daily'} isFocused={isFocused && focusedTaskIndex === taskIdx} isSelected={selectedTaskIds.has(task.id)} onToggleSelect={onToggleTaskSelection} isSuggested={task.id === suggestedTaskId} />
              </div>
            );
          })}
        </SortableContext>
        {ghostTasks.length > 0 && (
          <div className="flex items-center gap-2 mt-1 mb-0.5 select-none">
            <div className="h-px flex-1 border-t border-dashed border-[#333]" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#444]">Due here</span>
            <div className="h-px flex-1 border-t border-dashed border-[#333]" />
          </div>
        )}
        {ghostTasks.map(task => {
          const project = projects.find(p => p.id === task.projectId);
          const daysLeft = differenceInDays(parseISO(task.deadline!), today);
          const overdue = daysLeft < 0;
          const urgent = daysLeft >= 0 && daysLeft <= 3;
          const accent = overdue ? '#ef4444' : urgent ? '#F27D26' : daysLeft <= 10 ? '#eab308' : '#555';
          const label = overdue ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'due today' : `due in ${daysLeft}d`;
          return (
            <div key={`ghost-${task.id}`}
              className="relative flex items-center gap-2 px-2 py-1.5 rounded border border-dashed select-none pointer-events-none"
              style={{ background: accent + '0A', borderColor: accent + '55' }}>
              {project && <div className="shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: project.color }} />}
              <Flag size={9} style={{ color: accent, flexShrink: 0 }} />
              <span className="flex-1 text-sm truncate" style={{ color: accent + 'CC' }} title={task.title}>{task.title}</span>
              <span className="text-[11px] font-mono font-bold shrink-0" style={{ color: accent }}>{label}</span>
            </div>
          );
        })}
        {/* Quick-add input — hidden for past columns */}
        {!isPastColumn && (
          <input
            type="text"
            className="quick-add-input"
            value={quickAddValue}
            onChange={e => setQuickAddValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && quickAddValue.trim()) {
                const { title, date } = parseDateKeyword(quickAddValue, startDate);
                addTask({
                  title,
                  date: format(date, 'yyyy-MM-dd'),
                  projectId: filterProjectId ?? null,
                  deadline: null,
                  deadlineHistory: [],
                  startedAt: null,
                });
                setQuickAddValue('');
              }
              if (e.key === 'Escape') {
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="Add task..."
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid transparent',
              outline: 'none',
              color: '#444',
              fontSize: 12,
              padding: '4px 4px 3px',
              width: '100%',
              caretColor: 'var(--accent)',
            }}
            onFocus={e => { e.currentTarget.style.borderBottomColor = '#333'; }}
            onBlur={e => { e.currentTarget.style.borderBottomColor = 'transparent'; }}
          />
        )}
        {/* Collapsible completed tasks section */}
        {hideCompleted && completedCount > 0 && (
          <div className="mt-1">
            <button
              onClick={() => setCompletedExpanded(prev => !prev)}
              className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded text-[11px] font-mono transition-colors hover:bg-[#1A1A1A] group select-none"
              style={{ color: '#666' }}
            >
              <span style={{ fontSize: 8, transition: 'transform 200ms', transform: completedExpanded ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>▶</span>
              <span>{completedCount} completed</span>
            </button>
            <div
              ref={completedSectionRef}
              style={{
                maxHeight: completedExpanded ? `${completedColumnTasks.length * 60 + 20}px` : '0px',
                overflow: 'hidden',
                transition: 'max-height 300ms ease, opacity 300ms ease',
                opacity: completedExpanded ? 1 : 0,
              }}
            >
              <div className="flex flex-col gap-1 pt-1">
                {completedColumnTasks.map(task => (
                  <div key={`done-${task.id}`} style={{ opacity: 0.5 }}>
                    <DraggableTask task={task} showDate={mode !== 'daily'} isSelected={selectedTaskIds.has(task.id)} onToggleSelect={onToggleTaskSelection} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {columnTasks.length === 0 && !isOver && (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-[12px] text-[#333]">
              {startDate < today ? '—' : 'No tasks'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
