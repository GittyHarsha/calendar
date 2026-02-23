import React, { useState } from 'react';
import { useStore } from '../store';
import { addDays, format, startOfToday, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, addMonths, parseISO, startOfYear, endOfYear, addYears } from 'date-fns';
import { useDroppable } from '@dnd-kit/core';
import { DraggableTask } from './DraggableTask';
import { cn } from '../lib/utils';
import { MacroGoalsPanel } from './MacroGoalsPanel';

type ViewMode = 'daily' | 'weekly' | 'monthly' | 'yearly';

export function HorizonView() {
  const { projects, tasks, hideCompleted, toggleHideCompleted } = useStore();
  const today = startOfToday();
  const [viewMode, setViewMode] = useState<ViewMode>('weekly');
  const [baseDate, setBaseDate] = useState<Date>(today);
  const [horizonLengths, setHorizonLengths] = useState<Record<ViewMode, number | ''>>({
    daily: 90,
    weekly: 14,
    monthly: 12,
    yearly: 5
  });

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

  return (
    <div className="flex flex-col h-full w-full bg-[#141414]">
      {/* Header */}
      <div className="p-6 border-b border-[#2A2A2A] shrink-0 flex justify-between items-center bg-[#050505]">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="Horizon" className="w-8 h-8 shrink-0" />
          <p className="text-sm text-[#8E9299] font-mono">
            {format(columns[0].startDate, 'MMMM do, yyyy')} — {format(columns[columns.length - 1].endDate, 'MMMM do, yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-6">
          {/* Date Filter */}
          <div className="flex items-center gap-2">
            <input 
              type="month" 
              value={format(baseDate, 'yyyy-MM')}
              onChange={(e) => {
                if (e.target.value) {
                  setBaseDate(parseISO(e.target.value + '-01'));
                }
              }}
              className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-md px-2 py-1.5 text-xs text-[#8E9299] focus:outline-none focus:border-[#F27D26]"
            />
            <button 
              onClick={() => setBaseDate(today)} 
              className="text-xs font-bold uppercase tracking-wider text-[#8E9299] hover:text-white transition-colors px-2 py-1.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-md"
            >
              {format(today, 'MMM d, yyyy')}
            </button>
          </div>

          {/* View Toggle */}
          <div className="flex bg-[#1A1A1A] rounded-md p-1 border border-[#2A2A2A]">
            {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  "px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-sm transition-colors",
                  viewMode === mode ? "bg-[#2A2A2A] text-white shadow-sm" : "text-[#8E9299] hover:text-[#E4E3E0]"
                )}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Horizon Length Control */}
          <div className="flex items-center gap-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-md px-2 py-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-[#8E9299]">Show</span>
            <input
              type="number"
              value={horizonLengths[viewMode]}
              onChange={(e) => {
                const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                setHorizonLengths(prev => ({ ...prev, [viewMode]: val }));
              }}
              className="bg-transparent text-white text-xs font-mono w-12 text-center focus:outline-none"
              min="1"
              max="365"
            />
            <span className="text-xs font-bold uppercase tracking-wider text-[#8E9299]">
              {viewMode === 'daily' ? 'Days' : viewMode === 'weekly' ? 'Weeks' : viewMode === 'monthly' ? 'Months' : 'Years'}
            </span>
          </div>

          <div className="text-right border-l border-[#2A2A2A] pl-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#8E9299]">Active Goals</div>
            <div className="text-2xl font-mono text-white leading-none mt-1">{projects.length}</div>
          </div>
          <button
            onClick={toggleHideCompleted}
            className={cn(
              'text-xs font-semibold uppercase tracking-wider px-3 py-1.5 rounded-md border transition-colors',
              hideCompleted
                ? 'bg-[#F27D26]/10 border-[#F27D26]/40 text-[#F27D26]'
                : 'bg-[#1A1A1A] border-[#2A2A2A] text-[#8E9299] hover:text-white'
            )}
          >
            {hideCompleted ? 'Show Done' : 'Hide Done'}
          </button>
        </div>
      </div>

      {/* Macro Goals Panel */}
      <MacroGoalsPanel />

      {/* Timeline Scroll Container */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden flex relative">
        <div className="flex h-full min-w-max">
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
        "border-r border-[#2A2A2A] flex flex-col h-full transition-colors relative",
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
              <span className="truncate mr-2">{p.name}</span>
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
        {columnTasks.length === 0 && (
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
