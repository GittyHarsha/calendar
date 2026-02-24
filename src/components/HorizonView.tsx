import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { addDays, differenceInDays, format, startOfToday, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, addMonths, parseISO, startOfYear, endOfYear, addYears, subDays, subWeeks, subMonths, subYears } from 'date-fns';
import { useDroppable } from '@dnd-kit/core';
import { DraggableTask } from './DraggableTask';
import { cn } from '../lib/utils';
import { MacroGoalsPanel } from './MacroGoalsPanel';
import { ThemePanel } from './ThemePanel';
import { ChevronLeft, ChevronRight, Eye, EyeOff, LayoutGrid, AlertTriangle, Flag, AppWindow, Palette, Timer } from 'lucide-react';

type ViewMode = 'daily' | 'weekly' | 'monthly' | 'yearly';

function ProjectDeadlinesStrip({ onOpenGoals }: { onOpenGoals: () => void }) {
  const { projects, tasks } = useStore();
  const today = startOfToday();
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
    <div className="border-b border-[#1E1E1E] flex items-center px-3 gap-2 overflow-x-auto shrink-0 py-1.5" style={{ background: 'var(--bg-0)', scrollbarWidth: 'none' }}>
      {topLevel.map(p => {
        const days = p.deadline ? differenceInDays(parseISO(p.deadline), today) : null;
        const overdue = days !== null && days < 0;
        const urgent = days !== null && days >= 0 && days <= 7;
        const soon = days !== null && days > 7 && days <= 30;
        const accent = overdue ? '#ef4444' : urgent ? 'var(--accent)' : soon ? '#eab308' : '#3B82F6';
        const noDeadline = days === null;

        const ids = descendantIds(p.id);
        const openTasks = tasks.filter(t => ids.includes(t.projectId ?? '') && !t.completed).length;
        const subs = projects.filter(sp => sp.parentId === p.id);

        const dayLabel = noDeadline ? null : overdue ? `${Math.abs(days!)}d over` : days === 0 ? 'today' : `${days}d`;

        return (
          <button key={p.id} onClick={onOpenGoals}
            className="flex items-center gap-2 rounded-md shrink-0 hover:brightness-110 transition-all text-left px-2.5 py-1"
            style={{ background: `${p.color}14`, border: `1px solid ${noDeadline ? '#252525' : accent + '55'}` }}>
            {/* Color dot */}
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: noDeadline ? '#333' : accent }} />
            {/* Name */}
            <span className="text-[12px] font-bold text-white max-w-[120px] truncate" title={p.name}>{p.name}</span>
            {/* Days */}
            {dayLabel && (
              <>
                <span className="w-px h-3 shrink-0" style={{ background: accent + '55' }} />
                <span className="text-[11px] font-mono font-bold shrink-0" style={{ color: accent }}>
                  {(overdue || urgent) && <AlertTriangle size={9} className="inline mr-0.5 mb-0.5" style={{ color: accent }} />}
                  {dayLabel}
                </span>
              </>
            )}
            {/* Task count */}
            {openTasks > 0 && (
              <>
                <span className="w-px h-3 shrink-0" style={{ background: '#333' }} />
                <span className="text-[11px] font-mono text-[#666]">{openTasks} open</span>
              </>
            )}
            {/* Subproject dots */}
            {subs.length > 0 && (
              <span className="flex gap-0.5 ml-0.5">
                {subs.slice(0, 5).map(s => (
                  <span key={s.id} className="w-1.5 h-1.5 rounded-full opacity-60" style={{ background: s.color }} title={s.name} />
                ))}
                {subs.length > 5 && <span className="text-[10px] text-[#555]">+{subs.length - 5}</span>}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function HorizonView() {
  const { projects, tasks, hideCompleted, toggleHideCompleted, startPomodoro, pomodoro, stopPomodoro } = useStore();
  const today = startOfToday();
  const [viewMode, setViewMode] = useState<ViewMode>('weekly');
  const [baseDate, setBaseDate] = useState<Date>(today);
  const [showProjects, setShowProjects] = useState(false);
  const [showTheme, setShowTheme] = useState(false);
  const [horizonLengths, setHorizonLengths] = useState<Record<ViewMode, number | ''>>({
    daily: 90,
    weekly: 14,
    monthly: 12,
    yearly: 5
  });
  const projectsPanelRef = useRef<HTMLDivElement>(null);

  // Close projects panel when clicking outside
  useEffect(() => {
    if (!showProjects) return;
    const handler = (e: MouseEvent) => {
      if (projectsPanelRef.current && !projectsPanelRef.current.contains(e.target as Node)) {
        setShowProjects(false);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [showProjects]);

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
      <div className="h-10 shrink-0 flex items-center gap-0 px-4" style={{ background: 'var(--bg-0)', borderBottom: '1px solid color-mix(in srgb, var(--accent) 18%, var(--border-1))' }}>
        {/* Logo */}
        <img src="/logo.svg" alt="Horizon" className="w-5 h-5 shrink-0 mr-5" style={{ filter: 'drop-shadow(0 0 4px color-mix(in srgb, var(--accent) 60%, transparent))' }} />

        {/* Nav */}
        <div className="flex items-center gap-0 mr-3">
          <button onClick={() => navigate(-1)} className="w-6 h-6 flex items-center justify-center text-[#bbb] hover:text-[#F0EFEB] transition-colors">
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => setBaseDate(today)} className="h-6 px-2 text-[12px] font-mono tracking-widest uppercase text-[#bbb] hover:text-[#F0EFEB] transition-colors">
            now
          </button>
          <button onClick={() => navigate(1)} className="w-6 h-6 flex items-center justify-center text-[#bbb] hover:text-[#F0EFEB] transition-colors">
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Date range */}
        <span className="text-[13px] text-[#aaa] font-mono mr-auto tracking-wider">
          {format(columns[0].startDate, 'MMM d')} – {format(columns[columns.length - 1].endDate, 'MMM d, yyyy')}
        </span>

        {/* View mode + length — merged into one compact group */}
        <div className="flex items-center gap-0 mr-3 bg-[#0A0A0A] rounded-md border border-[#222] px-1" style={{ height: 26 }}>
          {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)}
              className={cn('w-6 h-5 text-[11px] font-mono uppercase tracking-widest transition-colors rounded',
                viewMode === mode ? '' : 'text-[#666] hover:text-[#bbb]'
              )}
              style={viewMode === mode ? { color: 'var(--accent)' } : undefined}>
              {mode[0]}
            </button>
          ))}
          <span className="w-px h-3 bg-[#2A2A2A] mx-1" />
          <input type="number" value={horizonLengths[viewMode]}
            onChange={e => {
              const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
              setHorizonLengths(prev => ({ ...prev, [viewMode]: val }));
            }}
            className="bg-transparent text-[#888] text-[11px] font-mono w-6 text-center focus:outline-none"
            min="1" max="365"
          />
        </div>

        {/* Right icon cluster */}
        <div className="flex items-center gap-0.5 ml-1">
          {/* Hide done */}
          <button onClick={toggleHideCompleted}
            className={cn('w-7 h-7 flex items-center justify-center rounded transition-colors',
              hideCompleted ? '' : 'text-[#bbb] hover:text-[#F0EFEB]'
            )}
            style={hideCompleted ? { color: 'var(--accent)' } : undefined}
            title={hideCompleted ? 'Show completed' : 'Hide completed'}>
            {hideCompleted ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>

          {/* Goals */}
          <button onClick={() => setShowProjects(p => !p)}
            className={cn('h-7 px-1.5 flex items-center gap-1 rounded text-[11px] font-mono uppercase tracking-widest transition-colors',
              showProjects ? '' : 'text-[#bbb] hover:text-[#F0EFEB]'
            )}
            style={showProjects ? { color: 'var(--accent)' } : undefined}
            title="Goals">
            <LayoutGrid size={12} />
            {projects.filter(p => !p.parentId).length > 0 && (
              <span className="text-[10px]">{projects.filter(p => !p.parentId).length}</span>
            )}
          </button>

          <span className="w-px h-4 bg-[#222] mx-0.5" />

          {/* Eye rest */}
          <button
            onClick={() => pomodoro.phase !== 'idle' && pomodoro.taskId === null ? stopPomodoro() : startPomodoro(null)}
            title={pomodoro.phase !== 'idle' && pomodoro.taskId === null ? 'Stop eye rest' : '25m eye rest'}
            className="w-7 h-7 flex items-center justify-center rounded transition-colors text-[13px]"
            style={{ color: pomodoro.taskId === null && pomodoro.phase !== 'idle' ? '#22d3ee' : '#555' }}>
            👁
          </button>

          {/* Widget */}
          <button
            onClick={() => { try { (window as any).chrome.webview.postMessage({ type: 'toggleWidget' }); } catch { } }}
            title="Toggle Widget"
            className="w-7 h-7 flex items-center justify-center text-[#555] hover:text-[#bbb] transition-colors rounded">
            <AppWindow size={13} />
          </button>

          {/* Theme */}
          <div className="relative">
            <button onClick={() => setShowTheme(p => !p)} title="Theme"
              className={cn('w-7 h-7 flex items-center justify-center rounded transition-colors',
                showTheme ? '' : 'text-[#555] hover:text-[#bbb]'
              )}
              style={showTheme ? { color: 'var(--accent)' } : undefined}>
              <Palette size={13} />
            </button>
            {showTheme && <ThemePanel onClose={() => setShowTheme(false)} />}
          </div>
        </div>
      </div>

      {/* Goals overlay panel — floats over calendar, doesn't push it */}
      {showProjects && (
        <div ref={projectsPanelRef} className="absolute top-11 left-0 right-0 z-40 border-b border-[#2A2A2A] shadow-2xl" style={{ background: 'var(--bg-0)' }}>
          <MacroGoalsPanel />
        </div>
      )}

      {/* Always-visible project deadlines strip */}
      <ProjectDeadlinesStrip onOpenGoals={() => setShowProjects(true)} />

      {/* Timeline Scroll Container */}
      <div className="flex-1 overflow-x-auto flex relative min-h-0">
        <div className="flex min-w-max h-full">
          {columns.map((col, index) => (
            <TimeColumn 
              key={col.startDate.toISOString()} 
              startDate={col.startDate} 
              endDate={col.endDate}
              mode={viewMode}
              index={index}
              hideCompleted={hideCompleted}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TimeColumn({ startDate, endDate, mode, index, hideCompleted }: { key?: React.Key; startDate: Date; endDate: Date; mode: ViewMode; index: number; hideCompleted: boolean }) {
  const { tasks, projects } = useStore();
  const today = startOfToday();
  const startDateStr = format(startDate, 'yyyy-MM-dd');
  const endDateStr = format(endDate, 'yyyy-MM-dd');
  
  const allColumnTasks = tasks.filter(t => t.date && t.date >= startDateStr && t.date <= endDateStr);
  const columnTasks = hideCompleted ? allColumnTasks.filter(t => !t.completed) : allColumnTasks;
  // Ghost tasks: deadline falls in this column, but work date is elsewhere
  const ghostTasks = tasks.filter(t =>
    t.deadline && t.deadline >= startDateStr && t.deadline <= endDateStr &&
    !(t.date && t.date >= startDateStr && t.date <= endDateStr) &&
    (!hideCompleted || !t.completed)
  );
  const deadlineProjects = projects.filter(p => p.deadline && p.deadline >= startDateStr && p.deadline <= endDateStr);

  const { setNodeRef, isOver } = useDroppable({
    id: startDateStr,
  });

  const isCurrent = today >= startDate && today <= endDate;
  const isWeekend = mode === 'daily' && (startDate.getDay() === 0 || startDate.getDay() === 6);

  let widthClass = "w-64";
  if (mode === 'weekly') widthClass = "w-72";
  if (mode === 'monthly') widthClass = "w-80";
  if (mode === 'yearly') widthClass = "w-96";

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        widthClass,
        "border-r border-[#2A2A2A] flex flex-col h-full min-h-0 transition-colors relative",
        isOver && "bg-[#1A1A1A]",
        isWeekend && !isOver && "bg-[#0A0A0A]/50",
      )}
      style={isCurrent ? { borderLeft: '2px solid var(--accent)', background: 'color-mix(in srgb, var(--accent) 5%, transparent)' } : undefined}
    >
      {/* Header */}
      <div className="p-3 border-b border-[#2A2A2A] shrink-0 relative"
        style={isCurrent ? { background: 'color-mix(in srgb, var(--accent) 10%, transparent)' } : undefined}>
        {isCurrent && (
          <div className="absolute top-0 right-0 text-black text-[13px] font-bold px-1.5 py-0.5 rounded-bl-md uppercase tracking-wider"
            style={{ background: 'var(--accent)' }}>
            {format(today, 'MMM d, yyyy')}
          </div>
        )}
        {mode === 'daily' && (
          <>
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-bold uppercase tracking-wider"
                style={{ color: isCurrent ? 'var(--accent)' : '#8E9299' }}>
                {format(startDate, 'EEE')}
              </span>
              <span className={cn(
                "text-lg font-mono",
                isCurrent ? "text-white" : "text-[#aaa]"
              )}>
                {format(startDate, 'dd')}
              </span>
            </div>
            <div className="text-[12px] text-[#aaa] font-mono mt-1">
              {format(startDate, 'MMM yyyy')}
            </div>
          </>
        )}
        {mode === 'weekly' && (
          <>
            <div className={cn(
              "text-sm font-bold uppercase tracking-wider",
              isCurrent ? "text-[#F27D26]" : "text-[#8E9299]"
            )}>
              Week of {format(startDate, 'MMM d')}
            </div>
            <div className="text-[12px] text-[#aaa] font-mono mt-1">
              {format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}
            </div>
          </>
        )}
        {mode === 'monthly' && (
          <>
            <div className={cn(
              "text-lg font-bold uppercase tracking-wider",
              isCurrent ? "text-[#F27D26]" : "text-[#8E9299]"
            )}>
              {format(startDate, 'MMMM')}
            </div>
            <div className="text-[12px] text-[#aaa] font-mono mt-1">
              {format(startDate, 'yyyy')}
            </div>
          </>
        )}
        {mode === 'yearly' && (
          <>
            <div className={cn(
              "text-lg font-bold uppercase tracking-wider",
              isCurrent ? "text-[#F27D26]" : "text-[#8E9299]"
            )}>
              {format(startDate, 'yyyy')}
            </div>
            <div className="text-[12px] text-[#aaa] font-mono mt-1">
              {format(startDate, 'yyyy')}
            </div>
          </>
        )}
      </div>

      {/* Deadlines Section */}
      {deadlineProjects.length > 0 && (
        <div className="p-2 border-b border-[#2A2A2A] bg-[#1A1A1A]/80 flex flex-col gap-2">
          {deadlineProjects.map(p => (
            <div 
              key={p.id} 
              className="px-2 py-1 rounded text-xs font-bold uppercase tracking-wider flex items-center justify-between"
              style={{ backgroundColor: `${p.color}20`, color: p.color, border: `1px solid ${p.color}40` }}
            >
              <span className="truncate mr-2" title={p.name}>{p.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                {mode !== 'daily' && (
                  <span className="text-[13px] opacity-80">{p.deadline ? format(parseISO(p.deadline), 'MMM d') : ''}</span>
                )}
                <span>DUE</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tasks Area */}
      <div className="flex-1 p-2 overflow-y-auto flex flex-col gap-2">
        {columnTasks.map(task => (
          <DraggableTask key={task.id} task={task} showDate={mode !== 'daily'} />
        ))}
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
              <span className="flex-1 text-[12px] truncate" style={{ color: accent + 'CC' }} title={task.title}>{task.title}</span>
              <span className="text-[11px] font-mono font-bold shrink-0" style={{ color: accent }}>{label}</span>
            </div>
          );
        })}
        {columnTasks.length === 0 && ghostTasks.length === 0 && (
          <div className={cn(
            'flex-1 flex items-center justify-center text-[#777] text-xs italic select-none border border-dashed rounded transition-colors',
            isOver ? 'border-[#F27D26]/40 text-[#F27D26]/40' : 'border-[#222]'
          )}>
            {isOver ? 'Drop here' : '+ task'}
          </div>
        )}
      </div>
    </div>
  );
}
