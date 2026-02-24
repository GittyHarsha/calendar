import React from 'react';
import { differenceInDays, format, parseISO, startOfToday } from 'date-fns';
import { CheckCircle2, Circle, ArrowRight, ExternalLink } from 'lucide-react';
import { useStore, Task } from '../store';

function urgencyColor(days: number) {
  if (days < 0)  return '#ef4444';
  if (days === 0) return '#F27D26';
  if (days <= 3)  return '#f97316';
  if (days <= 7)  return '#eab308';
  return '#3B82F6';
}

function DeadlineBadge({ days }: { days: number }) {
  const color = urgencyColor(days);
  const label = days < 0 ? `${Math.abs(days)}d over` : days === 0 ? 'today' : days === 1 ? 'tmrw' : `${days}d`;
  return <span className="text-[10px] font-mono font-bold shrink-0" style={{ color }}>{label}</span>;
}

function TaskRow({ task, onComplete, onMoveToday }: {
  key?: React.Key;
  task: Task & { days?: number };
  onComplete: () => void;
  onMoveToday?: () => void;
}) {
  const { projects } = useStore();
  const project = projects.find(p => p.id === task.projectId);
  const today = format(startOfToday(), 'yyyy-MM-dd');
  const isToday = task.date === today;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.03] group rounded transition-colors">
      <button onClick={onComplete} className="shrink-0 text-[#444] hover:text-[#F27D26] transition-colors">
        {task.completed ? <CheckCircle2 size={14} className="text-[#F27D26]" /> : <Circle size={14} />}
      </button>
      {project && <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />}
      <span className="flex-1 text-[13px] text-[#C8C7C4] truncate">{task.title}</span>
      {task.days !== undefined && <DeadlineBadge days={task.days} />}
      {!isToday && onMoveToday && (
        <button onClick={onMoveToday}
          className="hidden group-hover:flex items-center gap-0.5 text-[10px] text-[#F27D26] hover:underline shrink-0">
          <ArrowRight size={10} />today
        </button>
      )}
    </div>
  );
}

export function WidgetView() {
  const { tasks, projects, updateTask } = useStore();
  const today = startOfToday();
  const todayStr = format(today, 'yyyy-MM-dd');

  // Categorise
  const overdue = tasks.filter(t =>
    !t.completed && t.deadline && differenceInDays(parseISO(t.deadline), today) < 0
  ).map(t => ({ ...t, days: differenceInDays(parseISO(t.deadline!), today) }))
    .sort((a, b) => a.days - b.days);

  const dueToday = tasks.filter(t =>
    !t.completed && t.deadline &&
    differenceInDays(parseISO(t.deadline), today) === 0 &&
    !overdue.find(o => o.id === t.id)
  ).map(t => ({ ...t, days: 0 }));

  const workToday = tasks.filter(t =>
    !t.completed && t.date === todayStr &&
    !overdue.find(o => o.id === t.id) &&
    !dueToday.find(d => d.id === t.id)
  );

  const upNext = tasks.filter(t => {
    if (t.completed || !t.deadline) return false;
    const d = differenceInDays(parseISO(t.deadline), today);
    return d > 0 && d <= 3;
  }).map(t => ({ ...t, days: differenceInDays(parseISO(t.deadline!), today) }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 4);

  // Project pulse
  const topProjects = projects.filter(p => !p.parentId).slice(0, 5);

  const completeTask = (id: string) => updateTask(id, { completed: true });
  const moveToToday = (id: string) => updateTask(id, { date: todayStr });

  const openApp = () => {
    // postMessage to C# host to focus main window
    if ((window as any).chrome?.webview) {
      (window as any).chrome.webview.postMessage(JSON.stringify({ type: 'focusMain' }));
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0A0A0A] text-[#C8C7C4] select-none overflow-hidden"
      style={{ fontFamily: 'ui-monospace, monospace' }}>

      {/* Header — drag handle */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1A1A1A] cursor-move widget-drag shrink-0">
        <span className="text-[11px] font-bold uppercase tracking-widest text-[#444]">Horizon</span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#333] font-mono">{format(today, 'MMM d')}</span>
          <button onClick={openApp} className="text-[#333] hover:text-[#888] transition-colors" title="Open Horizon">
            <ExternalLink size={11} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>

        {/* Overdue */}
        {overdue.length > 0 && (
          <section className="mt-2">
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-[#ef4444]/60">
              Overdue · {overdue.length}
            </div>
            {overdue.map(t => (
              <TaskRow key={t.id} task={t} onComplete={() => completeTask(t.id)} onMoveToday={() => moveToToday(t.id)} />
            ))}
          </section>
        )}

        {/* Due today */}
        {dueToday.length > 0 && (
          <section className="mt-2">
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-[#F27D26]/60">
              Due today · {dueToday.length}
            </div>
            {dueToday.map(t => (
              <TaskRow key={t.id} task={t} onComplete={() => completeTask(t.id)} />
            ))}
          </section>
        )}

        {/* Scheduled today */}
        {workToday.length > 0 && (
          <section className="mt-2">
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-[#555]">
              Today's work · {workToday.length}
            </div>
            {workToday.map(t => (
              <TaskRow key={t.id} task={t} onComplete={() => completeTask(t.id)} />
            ))}
          </section>
        )}

        {/* Up next */}
        {upNext.length > 0 && (
          <section className="mt-2">
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-[#555]">
              Up next
            </div>
            {upNext.map(t => (
              <TaskRow key={t.id} task={t} onComplete={() => completeTask(t.id)} />
            ))}
          </section>
        )}

        {overdue.length === 0 && dueToday.length === 0 && workToday.length === 0 && upNext.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-[#333] text-xs">
            <span>nothing due soon</span>
            <span className="text-[10px] mt-1 text-[#252525]">you're clear 👌</span>
          </div>
        )}

        {/* Project pulse */}
        {topProjects.length > 0 && (
          <section className="mt-3 mx-3 pt-3 border-t border-[#1A1A1A]">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#333] mb-2">Projects</div>
            <div className="flex flex-col gap-1.5">
              {topProjects.map(p => {
                const days = p.deadline ? differenceInDays(parseISO(p.deadline), today) : null;
                const overdue = days !== null && days < 0;
                const urgent = days !== null && days >= 0 && days <= 7;
                const accent = overdue ? '#ef4444' : urgent ? '#F27D26' : p.color;
                const pTasks = tasks.filter(t => t.projectId === p.id && !t.completed);
                const done = tasks.filter(t => t.projectId === p.id && t.completed).length;
                const total = done + pTasks.length;
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                return (
                  <div key={p.id} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: accent }} />
                    <span className="flex-1 text-[11px] truncate text-[#555]" title={p.name}>{p.name}</span>
                    <div className="w-16 h-1 rounded-full bg-[#1A1A1A] shrink-0">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: accent }} />
                    </div>
                    {days !== null && (
                      <span className="text-[10px] font-mono shrink-0" style={{ color: accent }}>
                        {overdue ? `${Math.abs(days)}d` : `${days}d`}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div className="h-4" />
      </div>
    </div>
  );
}
