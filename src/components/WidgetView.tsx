import React, { useState } from 'react';
import { differenceInCalendarDays, format, parseISO, startOfToday } from 'date-fns';
import { useStore, Task, Project } from '../store';

const today = startOfToday();
const todayStr = format(today, 'yyyy-MM-dd');

function daysLabel(dl: string) {
  const d = differenceInCalendarDays(parseISO(dl), today);
  return d < 0 ? `${Math.abs(d)}d over` : d === 0 ? 'today' : d === 1 ? 'tmrw' : `${d}d`;
}
function daysColor(dl: string) {
  const d = differenceInCalendarDays(parseISO(dl), today);
  if (d < 0)  return '#ef4444';
  if (d === 0) return '#F27D26';
  if (d <= 3)  return '#f97316';
  return '#eab308';
}

function TaskRow({ task, projects, fading, onComplete }: {
  task: Task; projects: Project[]; fading: boolean; onComplete: () => void;
}) {
  const proj = projects.find(p => p.id === task.projectId);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px',
      opacity: fading ? 0 : 1, transition: 'opacity 0.25s',
      borderBottom: '1px solid #111',
    }}>
      <button onClick={onComplete} style={{
        width: 15, height: 15, borderRadius: '50%', border: '1.5px solid #2a2a2a',
        background: 'none', cursor: 'pointer', flexShrink: 0, padding: 0,
        transition: 'border-color 0.15s',
      }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = '#F27D26')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = '#2a2a2a')}
      />
      {proj && <span style={{ width: 6, height: 6, borderRadius: '50%', background: proj.color, flexShrink: 0 }} />}
      <span style={{ flex: 1, fontSize: 11, color: '#777', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {task.title}
      </span>
      {task.deadline && (
        <span style={{ fontSize: 10, fontWeight: 700, color: daysColor(task.deadline), flexShrink: 0 }}>
          {daysLabel(task.deadline)}
        </span>
      )}
    </div>
  );
}

function Section({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ padding: '6px 12px 3px', fontSize: 9, letterSpacing: '0.12em', color, textTransform: 'uppercase', fontWeight: 700 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

export function WidgetView() {
  const { tasks, projects, updateTask, addTask } = useStore();
  const [fading, setFading] = useState<Set<string>>(new Set());
  const [quickAdd, setQuickAdd] = useState('');

  const active = tasks.filter(t => !t.completed && !fading.has(t.id));

  const overdue   = active.filter(t => t.deadline && t.deadline < todayStr)
                          .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''));
  const dueToday  = active.filter(t => t.deadline === todayStr && t.date !== todayStr);
  const workToday = active.filter(t => t.date === todayStr);
  const upNext    = active.filter(t => {
    if (!t.deadline || t.deadline <= todayStr) return false;
    return differenceInCalendarDays(parseISO(t.deadline), today) <= 7;
  }).sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? '')).slice(0, 5);

  const doneToday = tasks.filter(t => t.completed && t.date === todayStr).length;
  const topProjects = projects.filter(p => !p.parentId).slice(0, 4);

  function complete(id: string) {
    setFading(s => new Set(s).add(id));
    setTimeout(() => updateTask(id, { completed: true }), 260);
  }

  function submitQuickAdd(e: React.KeyboardEvent) {
    if (e.key !== 'Enter' || !quickAdd.trim()) return;
    addTask({
      projectId: projects[0]?.id ?? null,
      title: quickAdd.trim(),
      date: todayStr,
      deadline: null,
      deadlineHistory: [],
      priority: 'Medium',
      description: '',
    });
    setQuickAdd('');
  }

  const rowProps = (t: Task) => ({ task: t, projects, fading: fading.has(t.id), onComplete: () => complete(t.id) });
  const empty = overdue.length + dueToday.length + workToday.length + upNext.length === 0;

  return (
    <div style={{ fontFamily: 'Consolas, monospace', background: '#0D0D0D', color: '#C8C7C4', height: '100vh', display: 'flex', flexDirection: 'column', fontSize: 12 }}>
      {/* Stats bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', borderBottom: '1px solid #161616', color: '#333', fontSize: 10 }}>
        <span>{format(today, 'EEE, MMM d')}</span>
        <span style={{ color: doneToday > 0 ? '#4ade80' : '#2a2a2a' }}>✓ {doneToday} done</span>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' }}>
        {overdue.length > 0 && (
          <Section label={`Overdue · ${overdue.length}`} color="#ef4444">
            {overdue.map(t => <TaskRow key={t.id} {...rowProps(t)} />)}
          </Section>
        )}
        {dueToday.length > 0 && (
          <Section label={`Due today · ${dueToday.length}`} color="#F27D26">
            {dueToday.map(t => <TaskRow key={t.id} {...rowProps(t)} />)}
          </Section>
        )}
        {workToday.length > 0 && (
          <Section label={`Today's work · ${workToday.length}`} color="#555">
            {workToday.map(t => <TaskRow key={t.id} {...rowProps(t)} />)}
          </Section>
        )}
        {upNext.length > 0 && (
          <Section label="Up next" color="#444">
            {upNext.map(t => <TaskRow key={t.id} {...rowProps(t)} />)}
          </Section>
        )}
        {empty && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 120, color: '#2a2a2a', fontSize: 11 }}>
            <span>you're clear</span>
            <span style={{ fontSize: 9, marginTop: 4, color: '#1e1e1e' }}>nothing due soon 👌</span>
          </div>
        )}

        {/* Project pulse */}
        {topProjects.length > 0 && (
          <div style={{ margin: '8px 12px 0', paddingTop: 8, borderTop: '1px solid #161616' }}>
            <div style={{ fontSize: 9, color: '#2a2a2a', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Projects</div>
            {topProjects.map(p => {
              const done = tasks.filter(t => t.projectId === p.id && t.completed).length;
              const total = tasks.filter(t => t.projectId === p.id).length;
              const pct = total > 0 ? (done / total) * 100 : 0;
              const dl = p.deadline ? differenceInCalendarDays(parseISO(p.deadline), today) : null;
              const accent = dl !== null && dl < 0 ? '#ef4444' : dl !== null && dl <= 7 ? '#F27D26' : p.color;
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 10, color: '#444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  <div style={{ width: 50, height: 2, background: '#1a1a1a', borderRadius: 2, flexShrink: 0 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: accent, borderRadius: 2 }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ height: 8 }} />
      </div>

      {/* Quick add */}
      <div style={{ borderTop: '1px solid #161616', padding: '6px 12px' }}>
        <input
          value={quickAdd}
          onChange={e => setQuickAdd(e.target.value)}
          onKeyDown={submitQuickAdd}
          placeholder="+ add task for today…"
          style={{
            width: '100%', background: 'transparent', border: 'none',
            borderBottom: '1px solid #1e1e1e', color: '#555', fontSize: 11,
            fontFamily: 'Consolas, monospace', padding: '3px 0', outline: 'none', boxSizing: 'border-box',
          }}
          onFocus={e => (e.target.style.borderBottomColor = '#F27D26')}
          onBlur={e => (e.target.style.borderBottomColor = '#1e1e1e')}
        />
      </div>
    </div>
  );
}
