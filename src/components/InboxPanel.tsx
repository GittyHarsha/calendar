import React, { useState, useRef, useCallback } from 'react';
import { useStore } from '../store';
import type { Task, Project } from '../store';
import { differenceInDays, format, parseISO, startOfToday } from 'date-fns';
import { Flag, ArrowRight, Inbox, MoreHorizontal } from 'lucide-react';
import { TaskPopup } from './DraggableTask';
import { TaskNotesModal } from './TaskNotesModal';

function deadlineColor(days: number | null): string {
  if (days === null) return '#555';
  if (days < 0) return '#ef4444';
  if (days === 0) return '#F27D26';
  if (days <= 3) return '#F27D26';
  if (days <= 7) return '#eab308';
  return '#3B82F6';
}

function deadlineLabel(days: number | null): string | null {
  if (days === null) return null;
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'due today';
  if (days === 1) return 'due tmrw';
  return `due ${days}d`;
}

export function InboxPanel({ onClose }: { onClose: () => void }) {
  const { tasks, projects, updateTask, addTask } = useStore();
  const today = startOfToday();
  const todayStr = format(today, 'yyyy-MM-dd');

  const [newTitle, setNewTitle] = useState('');

  const inboxTasks = tasks.filter(t => t.date === null && !t.completed);
  const overdueTasks = tasks.filter(t => t.date !== null && t.date < todayStr && !t.completed);

  // Group inbox by urgency
  const withDeadline = inboxTasks
    .filter(t => t.deadline)
    .map(t => ({ ...t, days: differenceInDays(parseISO(t.deadline!), today) }))
    .sort((a, b) => a.days - b.days);
  const noDeadline = inboxTasks.filter(t => !t.deadline);

  const scheduleToday = (id: string) => updateTask(id, { date: todayStr });
  const scheduleTomorrow = (id: string) => {
    const tomorrow = format(new Date(today.getTime() + 86400000), 'yyyy-MM-dd');
    updateTask(id, { date: tomorrow });
  };

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    addTask({ title: newTitle.trim(), projectId: null, date: null, deadline: null, deadlineHistory: [], priority: 'Medium' });
    setNewTitle('');
  };

  const total = inboxTasks.length + overdueTasks.length;

  return (
    <div className="flex flex-col max-h-[70vh] overflow-hidden" style={{ background: 'var(--bg-0)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1E1E1E] shrink-0">
        <div className="flex items-center gap-2">
          <Inbox size={13} style={{ color: 'var(--accent)' }} />
          <span className="text-[12px] font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Inbox</span>
          {total > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: total > 10 ? '#ef444422' : 'color-mix(in srgb, var(--accent) 15%, transparent)', color: total > 10 ? '#ef4444' : 'var(--accent)' }}>
              {total}
            </span>
          )}
        </div>
        {total === 0 && (
          <span className="text-[11px] text-[#3B82F6] font-mono">✓ clear</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Overdue */}
        {overdueTasks.length > 0 && (
          <Section label={`Overdue · ${overdueTasks.length}`} accent="#ef4444" urgent>
            {overdueTasks.map(t => (
              <TaskRow key={t.id} task={t} onToday={scheduleToday} onTomorrow={scheduleTomorrow} projects={projects} updateTask={updateTask} />
            ))}
          </Section>
        )}

        {/* Inbox with deadline — needs a decision */}
        {withDeadline.length > 0 && (
          <Section label={`Deadline pending · ${withDeadline.length}`} accent="#F27D26">
            {withDeadline.map(t => (
              <TaskRow key={t.id} task={t} onToday={scheduleToday} onTomorrow={scheduleTomorrow} projects={projects} updateTask={updateTask} />
            ))}
          </Section>
        )}

        {/* No deadline inbox */}
        {noDeadline.length > 0 && (
          <Section label={`Unscheduled · ${noDeadline.length}`} accent="#555">
            {noDeadline.map(t => (
              <TaskRow key={t.id} task={t} onToday={scheduleToday} onTomorrow={scheduleTomorrow} projects={projects} updateTask={updateTask} />
            ))}
          </Section>
        )}

        {total === 0 && (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <span className="text-3xl">✓</span>
            <span className="text-[13px] text-[#555] font-mono">Nothing pending.</span>
          </div>
        )}
      </div>

      {/* Quick-add at bottom */}
      <form onSubmit={handleQuickAdd} className="shrink-0 flex items-center gap-2 px-3 py-2 border-t border-[#1E1E1E]">
        <input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          placeholder="Quick add to inbox…"
          className="flex-1 bg-transparent text-[12px] text-[#ccc] placeholder-[#444] focus:outline-none font-mono"
        />
        {newTitle && (
          <button type="submit" className="text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded"
            style={{ background: 'color-mix(in srgb, var(--accent) 20%, transparent)', color: 'var(--accent)' }}>
            Add
          </button>
        )}
      </form>
    </div>
  );
}

function Section({ label, accent, urgent, children }: { label: string; accent: string; urgent?: boolean; children: React.ReactNode }) {
  return (
    <div className="border-b border-[#111]">
      <div className="flex items-center gap-2 px-4 py-1.5 sticky top-0" style={{ background: 'var(--bg-0)' }}>
        {urgent && <span className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ background: accent }} />}
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>{label}</span>
      </div>
      <div className="flex flex-col">
        {children}
      </div>
    </div>
  );
}

function TaskRow({ task, onToday, onTomorrow, projects, updateTask }: {
  key?: React.Key;
  task: Task & { days?: number };
  onToday: (id: string) => void;
  onTomorrow: (id: string) => void;
  projects: Project[];
  updateTask: (id: string, patch: Partial<Task>) => void;
}) {
  const today = startOfToday();
  const deadlineDays = task.deadline ? differenceInDays(parseISO(task.deadline), today) : null;
  const dlColor = deadlineColor(deadlineDays);
  const dlLabel = deadlineLabel(deadlineDays);
  const project = projects.find((p: any) => p.id === task.projectId);
  const isOverdue = task.date && task.date < format(today, 'yyyy-MM-dd');

  const moreRef = useRef<HTMLButtonElement>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const cancelClose = useCallback(() => {}, []);
  const scheduleClose = useCallback(() => setShowPopup(false), []);

  return (
    <>
      <div className="group flex items-center gap-2 px-4 py-1.5 hover:bg-[#111] transition-colors">
        {/* Complete button */}
        <button
          onClick={() => updateTask(task.id, { completed: true })}
          title="Mark complete"
          className="shrink-0 w-3.5 h-3.5 rounded-full border border-[#444] hover:border-[var(--accent)] transition-colors"
        />

        {/* Project dot */}
        {project
          ? <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: project.color }} />
          : <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-[#333]" />
        }

        {/* Title */}
        <span className="flex-1 text-[12px] text-[#C8C7C4] truncate leading-snug" title={task.title}>
          {task.title}
        </span>

        {/* Deadline badge */}
        {dlLabel && (
          <span className="text-[10px] font-mono shrink-0 flex items-center gap-0.5" style={{ color: dlColor }}>
            <Flag size={8} />
            {dlLabel}
          </span>
        )}

        {/* Overdue date */}
        {isOverdue && (
          <span className="text-[10px] font-mono text-[#ef4444] shrink-0">
            {format(parseISO(task.date!), 'MMM d')}
          </span>
        )}

        {/* Actions — visible on hover */}
        <div className="hidden group-hover:flex items-center gap-1 shrink-0">
          <button
            onClick={() => onToday(task.id)}
            className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors"
            style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' }}>
            <ArrowRight size={9} />today
          </button>
          <button
            onClick={() => onTomorrow(task.id)}
            className="flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors text-[#555] hover:text-[#aaa]">
            tmrw
          </button>
          {/* Details popup — click only, no accidental hover */}
          <button
            ref={moreRef}
            onClick={() => setShowPopup(v => !v)}
            className="w-5 h-5 flex items-center justify-center rounded text-[#555] hover:text-[#aaa] transition-colors"
            title="Details">
            <MoreHorizontal size={12} />
          </button>
        </div>
      </div>

      {showPopup && (
        <TaskPopup
          task={task}
          anchorRef={moreRef}
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
