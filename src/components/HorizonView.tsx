import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { addDays, differenceInDays, format, startOfToday, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, addMonths, parseISO, startOfYear, endOfYear, addYears, subDays, subWeeks, subMonths, subYears } from 'date-fns';
import { useDroppable } from '@dnd-kit/core';
import { DraggableTask } from './DraggableTask';
import { cn } from '../lib/utils';
import { MacroGoalsPanel } from './MacroGoalsPanel';
import { ChevronLeft, ChevronRight, Eye, EyeOff, LayoutGrid, AlertTriangle, Clock, Flag, AppWindow } from 'lucide-react';

type ViewMode = 'daily' | 'weekly' | 'monthly' | 'yearly';

function Carousel({ items, accentFn }: {
  items: { label: string; sublabel: string; accent: string; urgent: boolean }[];
  accentFn?: (i: number) => string;
}) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % items.length), 2500);
    return () => clearInterval(t);
  }, [items.length]);

  if (items.length === 0) return <div className="flex items-center justify-center h-full text-[10px] text-[#333] italic">none</div>;

  const item = items[idx];
  return (
    <div className="relative flex flex-col justify-center h-full overflow-hidden">
      {/* Cycling item */}
      <div key={idx} className="flex flex-col gap-0.5 animate-fade">
        <div className="flex items-baseline gap-1.5">
          {item.urgent && <AlertTriangle size={10} style={{ color: item.accent }} className="shrink-0 mb-0.5" />}
          <span className="text-2xl font-mono font-black leading-none" style={{ color: item.accent }}>
            {item.label}
          </span>
        </div>
        <span className="text-[10px] font-semibold text-[#C8C7C4] leading-tight truncate max-w-[150px]" title={item.sublabel}>{item.sublabel}</span>
      </div>
      {/* Dot indicators */}
      {items.length > 1 && (
        <div className="flex gap-0.5 mt-1.5">
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
    <div className="border-b border-[#1E1E1E] bg-[#0A0A0A] flex items-stretch px-3 gap-3 overflow-x-auto shrink-0 py-2.5" style={{ scrollbarWidth: 'none' }}>
      {topLevel.map(p => {
        const days = p.deadline ? differenceInDays(parseISO(p.deadline), today) : null;
        const overdue = days !== null && days < 0;
        const urgent = days !== null && days >= 0 && days <= 7;
        const soon = days !== null && days > 7 && days <= 30;
        const accent = overdue ? '#ef4444' : urgent ? '#F27D26' : soon ? '#eab308' : '#3B82F6';
        const noDeadline = days === null;

        // subprojects carousel items
        const subs = projects.filter(sp => sp.parentId === p.id);
        const subItems = subs.map(sp => {
          const d = sp.deadline ? differenceInDays(parseISO(sp.deadline), today) : null;
          const ov = d !== null && d < 0;
          const urg = d !== null && d >= 0 && d <= 7;
          const so = d !== null && d > 7 && d <= 30;
          const a = ov ? '#ef4444' : urg ? '#F27D26' : so ? '#eab308' : '#3B82F6';
          return {
            label: d === null ? '—' : String(Math.abs(d)),
            sublabel: sp.name,
            accent: d === null ? '#444' : a,
            urgent: ov || urg,
          };
        });

        // tasks carousel items (all descendants) — use deadline if set, else work date
        const ids = descendantIds(p.id);
        const upcomingTasks = tasks
          .filter(t => ids.includes(t.projectId ?? '') && t.deadline && !t.completed)
          .map(t => ({ ...t, d: differenceInDays(parseISO(t.deadline!), today) }))
          .sort((a, b) => a.d - b.d);
        const taskItems = upcomingTasks.map(t => {
          const ov = t.d < 0; const urg = t.d >= 0 && t.d <= 3; const so = t.d > 3 && t.d <= 10;
          const a = ov ? '#ef4444' : urg ? '#F27D26' : so ? '#eab308' : '#3B82F6';
          const lbl = ov ? `${Math.abs(t.d)}d over` : t.d === 0 ? 'today' : `${t.d}d`;
          const shifts = t.deadlineHistory?.length ?? 0;
          return { label: lbl, sublabel: `${shifts > 0 ? `↻${shifts} ` : ''}${t.title}`, accent: a, urgent: ov || urg };
        });

        return (
          <button key={p.id} onClick={onOpenGoals}
            className="flex items-stretch gap-0 rounded-lg shrink-0 hover:brightness-110 transition-all text-left overflow-hidden"
            style={{ background: `${p.color}12`, border: `1px solid ${noDeadline ? '#252525' : accent + '45'}` }}>

            {/* Left urgency bar */}
            <div className="w-1 self-stretch shrink-0" style={{ background: noDeadline ? '#222' : accent }} />

            {/* Project deadline */}
            <div className="flex flex-col justify-center gap-0.5 px-3 py-1 min-w-[110px]">
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#555]">Goal</span>
              <span className="text-xs font-bold text-white truncate max-w-[110px]" title={p.name}>{p.name}</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                {(overdue || urgent) && <AlertTriangle size={10} style={{ color: accent }} />}
                <span className="text-2xl font-mono font-black leading-none" style={{ color: noDeadline ? '#333' : accent }}>
                  {noDeadline ? '—' : Math.abs(days!)}
                </span>
                <span className="text-[9px] font-mono uppercase" style={{ color: noDeadline ? '#333' : accent }}>
                  {noDeadline ? 'no date' : overdue ? 'over' : 'left'}
                </span>
              </div>
            </div>

            {/* Divider */}
            <div className="w-px self-stretch bg-[#1E1E1E]" />

            {/* Subprojects carousel */}
            {subs.length > 0 && (
              <>
                <div className="flex flex-col justify-center px-3 py-1 min-w-[130px]">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[#555] mb-1">Subprojects</span>
                  <Carousel items={subItems} />
                </div>
                <div className="w-px self-stretch bg-[#1E1E1E]" />
              </>
            )}

            {/* Tasks carousel */}
            <div className="flex flex-col justify-center px-3 py-1 min-w-[150px]">
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#555] mb-1">Tasks</span>
              <Carousel items={taskItems} />
            </div>

          </button>
        );
      })}
    </div>
  );
}

export function HorizonView() {
  const { projects, tasks, hideCompleted, toggleHideCompleted } = useStore();
  const today = startOfToday();
  const [viewMode, setViewMode] = useState<ViewMode>('weekly');
  const [baseDate, setBaseDate] = useState<Date>(today);
  const [showProjects, setShowProjects] = useState(false);
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
    <div className="flex flex-col h-full w-full bg-[#141414]">
      {/* Toolbar */}
      <div className="h-10 border-b border-[#1E1E1E] shrink-0 flex items-center gap-0 bg-[#0D0D0D] px-4">
        {/* Logo */}
        <img src="/logo.svg" alt="Horizon" className="w-5 h-5 shrink-0 mr-5 opacity-60" />

        {/* Nav */}
        <div className="flex items-center gap-0 mr-4">
          <button onClick={() => navigate(-1)}
            className="w-6 h-6 flex items-center justify-center text-[#555] hover:text-[#C8C7C4] transition-colors">
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => setBaseDate(today)}
            className="h-6 px-2 text-[10px] font-mono tracking-widest uppercase text-[#555] hover:text-[#C8C7C4] transition-colors">
            now
          </button>
          <button onClick={() => navigate(1)}
            className="w-6 h-6 flex items-center justify-center text-[#555] hover:text-[#C8C7C4] transition-colors">
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Date range */}
        <span className="text-[11px] text-[#444] font-mono mr-auto tracking-wider">
          {format(columns[0].startDate, 'MMM d')} – {format(columns[columns.length - 1].endDate, 'MMM d, yyyy')}
        </span>

        {/* View mode */}
        <div className="flex items-center gap-0 mr-4">
          {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)}
              className={cn('w-7 h-6 text-[10px] font-mono uppercase tracking-widest transition-colors rounded',
                viewMode === mode ? 'text-[#F27D26]' : 'text-[#555] hover:text-[#C8C7C4]'
              )}>
              {mode[0]}
            </button>
          ))}
        </div>

        {/* Length control */}
        <div className="flex items-center gap-1 mr-4">
          <input type="number" value={horizonLengths[viewMode]}
            onChange={e => {
              const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
              setHorizonLengths(prev => ({ ...prev, [viewMode]: val }));
            }}
            className="bg-transparent border-b border-[#333] text-[#888] text-[11px] font-mono w-8 text-center focus:outline-none focus:border-[#F27D26] transition-colors"
            min="1" max="365"
          />
          <span className="text-[10px] text-[#444] font-mono">
            {viewMode === 'daily' ? 'd' : viewMode === 'weekly' ? 'wk' : viewMode === 'monthly' ? 'mo' : 'yr'}
          </span>
        </div>

        {/* Hide done */}
        <button onClick={toggleHideCompleted}
          className={cn('w-6 h-6 flex items-center justify-center transition-colors mr-1',
            hideCompleted ? 'text-[#F27D26]' : 'text-[#555] hover:text-[#C8C7C4]'
          )}
          title={hideCompleted ? 'Show completed' : 'Hide completed'}>
          {hideCompleted ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>

        {/* Projects toggle */}
        <button onClick={() => setShowProjects(p => !p)}
          className={cn('h-6 px-2 flex items-center gap-1.5 rounded text-[10px] font-mono uppercase tracking-widest transition-colors',
            showProjects ? 'text-[#F27D26]' : 'text-[#555] hover:text-[#C8C7C4]'
          )}>
          <LayoutGrid size={12} />
          <span>goals</span>
          {projects.filter(p => !p.parentId).length > 0 && (
            <span className="font-mono">{projects.filter(p => !p.parentId).length}</span>
          )}
        </button>

        {/* Widget toggle */}
        <button
          onClick={() => {
            try { (window as any).chrome.webview.postMessage({ type: 'toggleWidget' }); } catch { }
          }}
          title="Toggle Widget"
          className="w-6 h-6 flex items-center justify-center text-[#555] hover:text-[#C8C7C4] transition-colors ml-1">
          <AppWindow size={13} />
        </button>
      </div>

      {/* Goals overlay panel — floats over calendar, doesn't push it */}
      {showProjects && (
        <div ref={projectsPanelRef} className="absolute top-11 left-0 right-0 z-40 border-b border-[#2A2A2A] shadow-2xl" style={{ background: '#0A0A0A' }}>
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
        isCurrent && "bg-[#F27D26]/5 border-l-2 border-l-[#F27D26]"
      )}
    >
      {/* Header */}
      <div className={cn(
        "p-3 border-b border-[#2A2A2A] shrink-0 relative",
        isCurrent && "bg-[#F27D26]/10"
      )}>
        {isCurrent && (
          <div className="absolute top-0 right-0 bg-[#F27D26] text-black text-[9px] font-bold px-1.5 py-0.5 rounded-bl-md uppercase tracking-wider">
            {format(today, 'MMM d, yyyy')}
          </div>
        )}
        {mode === 'daily' && (
          <>
            <div className="flex justify-between items-baseline">
              <span className={cn(
                "text-sm font-bold uppercase tracking-wider",
                isCurrent ? "text-[#F27D26]" : "text-[#8E9299]"
              )}>
                {format(startDate, 'EEE')}
              </span>
              <span className={cn(
                "text-lg font-mono",
                isCurrent ? "text-white" : "text-[#555]"
              )}>
                {format(startDate, 'dd')}
              </span>
            </div>
            <div className="text-[10px] text-[#555] font-mono mt-1">
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
            <div className="text-[10px] text-[#555] font-mono mt-1">
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
            <div className="text-[10px] text-[#555] font-mono mt-1">
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
            <div className="text-[10px] text-[#555] font-mono mt-1">
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
                  <span className="text-[9px] opacity-80">{p.deadline ? format(parseISO(p.deadline), 'MMM d') : ''}</span>
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
              className="relative flex items-center gap-2 px-2 py-1.5 rounded border border-dashed select-none opacity-50 pointer-events-none"
              style={{ background: accent + '08', borderColor: accent + '40' }}>
              {project && <div className="shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: project.color }} />}
              <span className="flex-1 text-sm text-[#888] truncate italic" title={task.title}>{task.title}</span>
              <Flag size={9} style={{ color: accent }} />
              <span className="text-[10px] font-mono" style={{ color: accent }}>{label}</span>
            </div>
          );
        })}
        {columnTasks.length === 0 && ghostTasks.length === 0 && (
          <div className={cn(
            'flex-1 flex items-center justify-center text-[#333] text-xs italic select-none border border-dashed rounded transition-colors',
            isOver ? 'border-[#F27D26]/40 text-[#F27D26]/40' : 'border-[#222]'
          )}>
            {isOver ? 'Drop here' : '+ task'}
          </div>
        )}
      </div>
    </div>
  );
}
