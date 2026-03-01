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

function TaskCarousel({ items }: { items: { label: string; sublabel: string; accent: string; urgent: boolean }[] }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % items.length), 2500);
    return () => clearInterval(t);
  }, [items.length]);

  if (items.length === 0) return (
    <div className="flex items-center justify-center h-full text-[11px] text-[#555] italic">none due</div>
  );

  const item = items[idx];
  return (
    <div className="relative flex flex-col justify-center h-full overflow-hidden">
      <div key={idx} className="flex flex-col gap-0.5">
        <div className="flex items-baseline gap-1.5">
          {item.urgent && <AlertTriangle size={9} style={{ color: item.accent }} className="shrink-0 mb-0.5" />}
          <span className="text-[22px] font-mono font-black leading-none" style={{ color: item.accent }}>{item.label}</span>
        </div>
        <span className="text-[11px] font-semibold leading-tight truncate max-w-[140px]" style={{ color: '#C8C7C4' }} title={item.sublabel}>{item.sublabel}</span>
      </div>
      {items.length > 1 && (
        <div className="flex gap-0.5 mt-1">
          {items.map((_, i) => (
            <button key={i} onClick={e => { e.stopPropagation(); setIdx(i); }}
              className="w-1 h-1 rounded-full transition-all"
              style={{ background: i === idx ? item.accent : '#333' }} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectDeadlinesStrip({ onOpenGoals }: { onOpenGoals: () => void }) {
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
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-bold uppercase tracking-widest text-[#3A3A3A] z-10 pointer-events-none select-none">Projects</span>
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
      <div ref={scrollRef} className="flex items-stretch pl-16 pr-8 gap-2 overflow-x-auto py-2" style={{ scrollbarWidth: 'none' }}>
        {topLevel.map(p => {
          const days = p.deadline ? differenceInDays(parseISO(p.deadline), today) : null;
          const overdue = days !== null && days < 0;
          const urgent = days !== null && days >= 0 && days <= 7;
          const soon = days !== null && days > 7 && days <= 30;
          const accent = overdue ? '#ef4444' : urgent ? 'var(--accent)' : soon ? '#eab308' : '#3B82F6';
          const noDeadline = days === null;

          const ids = descendantIds(p.id);
          const upcomingTasks = tasks
            .filter(t => ids.includes(t.projectId ?? '') && t.deadline && !t.completed)
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
            <button key={p.id} onClick={onOpenGoals}
              className="flex items-stretch gap-0 rounded-lg shrink-0 hover:brightness-110 transition-all text-left overflow-hidden"
              style={{ background: `${p.color}12`, border: `1px solid ${noDeadline ? '#252525' : accent + '50'}` }}>
              {/* Left accent bar */}
              <div className="w-1 self-stretch shrink-0" style={{ background: noDeadline ? '#222' : accent }} />
              {/* Project deadline */}
              <div className="flex flex-col justify-center gap-0.5 px-3 py-2 min-w-[110px]">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#666]">Goal</span>
                <span className="text-[12px] font-bold text-white truncate max-w-[110px]" title={p.name}>{p.name}</span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  {(overdue || urgent) && <AlertTriangle size={9} style={{ color: accent }} />}
                  <span className="text-[22px] font-mono font-black leading-none" style={{ color: noDeadline ? '#333' : accent }}>
                    {noDeadline ? '—' : Math.abs(days!)}
                  </span>
                  <span className="text-[10px] font-mono uppercase" style={{ color: noDeadline ? '#333' : accent }}>
                    {noDeadline ? 'no date' : overdue ? 'over' : 'left'}
                  </span>
                </div>
              </div>
              {/* Divider */}
              <div className="w-px self-stretch bg-[#1E1E1E]" />
              {/* Tasks carousel */}
              <div className="flex flex-col justify-center px-3 py-2 min-w-[150px]">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#666] mb-1">Tasks</span>
                <TaskCarousel items={taskItems} />
              </div>
            </button>
          );
        })}
      </div>
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
          <button onClick={() => navigate(-1)} aria-label="Previous period" className="w-6 h-6 flex items-center justify-center text-[#bbb] hover:text-[#F0EFEB] transition-colors">
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => setBaseDate(today)} title="Go to today" className="h-6 px-2 text-[12px] font-mono tracking-widest uppercase text-[#bbb] hover:text-[#F0EFEB] transition-colors">
            now
          </button>
          <button onClick={() => navigate(1)} aria-label="Next period" className="w-6 h-6 flex items-center justify-center text-[#bbb] hover:text-[#F0EFEB] transition-colors">
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
        <div className="flex items-center bg-[#0A0A0A] rounded-lg border border-[#252525] p-0.5 gap-0.5">
          {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(mode => {
            const labels: Record<string, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };
            const active = viewMode === mode;
            return (
              <button key={mode} onClick={() => setViewMode(mode)}
                aria-label={`${labels[mode]} view`}
                title={labels[mode]}
                className={cn(
                  'h-7 px-3 text-[12px] font-medium rounded-md transition-all duration-150 select-none',
                  active ? 'text-[#F0EFEB]' : 'text-[#555] hover:text-[#999]'
                )}
                style={active ? { background: 'color-mix(in srgb, var(--accent) 22%, #1a1a1a)', color: 'var(--accent)', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' } : undefined}>
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
            className="bg-transparent text-[#ccc] text-[12px] font-mono w-7 text-center focus:outline-none"
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
            className={cn('h-7 px-2 flex items-center gap-1.5 rounded text-[11px] transition-colors',
              hideCompleted ? '' : 'text-[#bbb] hover:text-[#F0EFEB]'
            )}
            style={hideCompleted ? { color: 'var(--accent)' } : undefined}
            title={hideCompleted ? 'Show completed tasks' : 'Hide completed tasks'}>
            {hideCompleted ? <EyeOff size={13} /> : <Eye size={13} />}
            <span className="font-mono uppercase tracking-widest text-[10px]">Done</span>
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

          {/* Eye rest / break timer */}
          <button
            onClick={() => pomodoro.phase !== 'idle' && pomodoro.taskId === null ? stopPomodoro() : startPomodoro(null)}
            title={pomodoro.phase !== 'idle' && pomodoro.taskId === null ? 'Stop misc timer' : 'Start misc (untracked) timer'}
            className={cn('h-7 px-2 flex items-center gap-1.5 rounded transition-colors text-[11px]')}
            style={{ color: pomodoro.taskId === null && pomodoro.phase !== 'idle' ? '#22d3ee' : '#555' }}>
            <Timer size={13} />
            <span className="font-mono uppercase tracking-widest text-[10px]"
              style={{ color: pomodoro.taskId === null && pomodoro.phase !== 'idle' ? '#22d3ee' : undefined }}>
              {pomodoro.taskId === null && pomodoro.phase !== 'idle' ? 'Stop' : 'Misc'}
            </span>
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
        <div ref={projectsPanelRef} className="absolute top-11 left-0 right-0 z-40 border-b border-[#2A2A2A] shadow-2xl animate-slide-down" style={{ background: 'var(--bg-0)' }}>
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
          <div className="absolute top-0 right-0 text-black text-[13px] font-bold px-1.5 py-0.5 rounded-bl-md uppercase tracking-wider flex items-center gap-1.5"
            style={{ background: 'var(--accent)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-black/40 animate-pulse inline-block" />
            {format(today, 'MMM d, yyyy')}
          </div>
        )}
        {/* Task count badge */}
        {columnTasks.length > 0 && (
          <div className="absolute bottom-2 right-2 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' }}>
            {columnTasks.length}
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
            <div className="text-sm font-bold uppercase tracking-wider"
              style={{ color: isCurrent ? 'var(--accent)' : '#8E9299' }}>
              Week of {format(startDate, 'MMM d')}
            </div>
            <div className="text-[12px] text-[#aaa] font-mono mt-1">
              {format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}
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
              <Flag size={9} style={{ color: accent, flexShrink: 0 }} className={overdue || urgent ? 'animate-pulse' : ''} />
              <span className="flex-1 text-[12px] truncate" style={{ color: accent + 'CC' }} title={task.title}>{task.title}</span>
              <span className="text-[11px] font-mono font-bold shrink-0" style={{ color: accent }}>{label}</span>
            </div>
          );
        })}
        {columnTasks.length === 0 && ghostTasks.length === 0 && (
          <div className={cn(
            'flex-1 flex flex-col items-center justify-center gap-2 select-none border border-dashed rounded-lg transition-all duration-200 min-h-[60px] px-3',
            isOver
              ? 'border-[var(--accent)]/50 bg-[color-mix(in_srgb,var(--accent)_5%,transparent)] text-[var(--accent)]/60 scale-[1.01]'
              : 'border-[#282828] text-[#444] bg-[#0A0A0A]/40'
          )}>
            <span className="text-base leading-none">{isOver ? '↓' : '+'}</span>
            <span className="text-[11px] font-mono text-center leading-tight">{isOver ? 'drop here' : 'Drop a task or click +'}</span>
          </div>
        )}
      </div>
    </div>
  );
}
