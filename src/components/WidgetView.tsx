import React, { useState, useEffect, useRef } from 'react';
import { differenceInCalendarDays, format, parseISO, startOfToday } from 'date-fns';
import { useStore, Task, Project, THEMES, WORK_DURATION, BREAK_DURATION, fmtDuration } from '../store';

const today = startOfToday();
const todayStr = format(today, 'yyyy-MM-dd');

function pad(n: number) { return String(n).padStart(2, '0'); }
function fmtCountdown(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

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

function TaskRow({ task, projects, fading, accent, isActive, onComplete, onFocus }: {
  task: Task; projects: Project[]; fading: boolean; accent: string;
  isActive: boolean; onComplete: () => void; onFocus: () => void;
}) {
  const proj = projects.find(p => p.id === task.projectId);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderBottom: '1px solid var(--border-1)',
        opacity: fading ? 0 : 1, transition: 'opacity 0.25s',
        background: isActive ? `${accent}10` : hovered ? 'var(--bg-2)' : 'transparent',
      }}>
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px' }}>
        <button onClick={onComplete} style={{
          width: 15, height: 15, borderRadius: '50%', border: `1.5px solid ${hovered ? accent : 'var(--border-1)'}`,
          background: 'none', cursor: 'pointer', flexShrink: 0, padding: 0, transition: 'border-color 0.15s',
        }} />
        {proj && <span style={{ width: 6, height: 6, borderRadius: '50%', background: proj.color, flexShrink: 0 }} />}
        <span title={task.title} style={{ flex: 1, fontSize: 13, color: hovered ? 'var(--text-1)' : 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'color 0.15s' }}>
          {task.title}
        </span>
        {task.deadline && (
          <span style={{ fontSize: 11, fontWeight: 700, color: daysColor(task.deadline), flexShrink: 0 }}>
            {daysLabel(task.deadline)}
          </span>
        )}
        {isActive && <span style={{ fontSize: 9, color: accent, flexShrink: 0 }}>▶</span>}
      </div>

      {/* Inline expansion on hover */}
      {hovered && (
        <div style={{ padding: '0 12px 8px 35px', display: 'flex', gap: 6 }}>
          <button onClick={onFocus} style={{
            flex: 1, padding: '4px 0', borderRadius: 5,
            border: `1px solid ${accent}55`, background: `${accent}15`,
            color: accent, fontSize: 11, cursor: 'pointer',
            fontFamily: 'Consolas, monospace', fontWeight: 600,
          }}>
            {isActive ? '▶ focusing' : '⏱ focus 25m'}
          </button>
          <button onClick={onComplete} style={{
            flex: 1, padding: '4px 0', borderRadius: 5,
            border: '1px solid var(--border-1)', background: 'transparent',
            color: 'var(--text-2)', fontSize: 11, cursor: 'pointer',
            fontFamily: 'Consolas, monospace',
          }}>
            ✓ done
          </button>
        </div>
      )}
    </div>
  );
}

function Section({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ padding: '6px 12px 3px', fontSize: 10, letterSpacing: '0.12em', color, textTransform: 'uppercase', fontWeight: 700 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

export function WidgetView() {
  const { tasks, projects, updateTask, addTask, theme, pomodoro,
          startPomodoro, pausePomodoro, stopPomodoro, getTaskTime } = useStore();
  const [fading, setFading] = useState<Set<string>>(new Set());
  const [quickAdd, setQuickAdd] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const thm = THEMES[theme] ?? THEMES.void;
  const accent = thm.accent;

  // Apply CSS vars + data-theme to widget document (no App.tsx here)
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--accent', thm.accent);
    r.style.setProperty('--bg-0', thm.bg0);
    r.style.setProperty('--bg-1', thm.bg1);
    r.style.setProperty('--bg-2', thm.bg2);
    r.style.setProperty('--border-1', thm.border);
    r.style.setProperty('--text-1', thm.text1);
    r.style.setProperty('--text-2', thm.text2);
    r.setAttribute('data-theme', theme);
  }, [theme]);

  // Pomodoro countdown tick
  useEffect(() => {
    if (pomodoro.phase === 'idle' || !pomodoro.sessionStart) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setElapsed(0); return;
    }
    const tick = () => setElapsed(Date.now() - new Date(pomodoro.sessionStart!).getTime());
    tick();
    intervalRef.current = setInterval(tick, 500);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [pomodoro.phase, pomodoro.sessionStart]);

  const active = tasks.filter(t => !t.completed && !fading.has(t.id));

  const overdue   = active.filter(t => t.deadline && t.deadline < todayStr)
                          .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''));
  const overdueIds = new Set(overdue.map(t => t.id));

  const dueToday  = active.filter(t => !overdueIds.has(t.id) && t.deadline === todayStr);
  const dueTodayIds = new Set(dueToday.map(t => t.id));

  const workToday = active.filter(t => !overdueIds.has(t.id) && !dueTodayIds.has(t.id) && t.date === todayStr);
  const workTodayIds = new Set(workToday.map(t => t.id));

  const upNext    = active.filter(t => {
    if (overdueIds.has(t.id) || dueTodayIds.has(t.id) || workTodayIds.has(t.id)) return false;
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

  const rowProps = (t: Task) => ({
    task: t, projects, fading: fading.has(t.id),
    accent, isActive: pomodoro.taskId === t.id && pomodoro.phase === 'work',
    onComplete: () => complete(t.id),
    onFocus: () => startPomodoro(t.id),
  });
  const empty = overdue.length + dueToday.length + workToday.length + upNext.length === 0;

  return (
    <div style={{ fontFamily: 'Consolas, monospace', background: 'var(--bg-0)', color: 'var(--text-1)', height: '100vh', display: 'flex', flexDirection: 'column', fontSize: 13 }}>
      {/* Stats bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', borderBottom: '1px solid var(--border-1)', color: 'var(--text-2)', fontSize: 12 }}>
        <span>{format(today, 'EEE, MMM d')}</span>
        <span style={{ color: doneToday > 0 ? '#4ade80' : 'var(--border-1)' }}>✓ {doneToday} done</span>
      </div>

      {/* Pomodoro mini-bar */}
      {pomodoro.phase !== 'idle' && (() => {
        const isWork = pomodoro.phase === 'work';
        const dur = isWork ? WORK_DURATION : BREAK_DURATION;
        const rem = Math.max(0, dur - elapsed);
        const pct = Math.min(1, elapsed / dur);
        const task = tasks.find(t => t.id === pomodoro.taskId);
        const pColor = isWork ? accent : '#22c55e';
        const tracked = pomodoro.taskId ? getTaskTime(pomodoro.taskId) : 0;
        return (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
            borderBottom: `1px solid ${pColor}33`, background: `${pColor}0D`,
          }}>
            {/* Mini ring */}
            <svg width={22} height={22} style={{ flexShrink: 0 }}>
              <circle cx={11} cy={11} r={9} fill="none" stroke="var(--bg-2)" strokeWidth={2.5} />
              <circle cx={11} cy={11} r={9} fill="none" stroke={pColor} strokeWidth={2.5}
                strokeDasharray={`${2 * Math.PI * 9}`}
                strokeDashoffset={`${2 * Math.PI * 9 * (1 - pct)}`}
                strokeLinecap="round"
                style={{ transform: 'rotate(-90deg)', transformOrigin: '11px 11px' }} />
            </svg>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: 9, color: 'var(--text-2)', marginBottom: 1 }}>{isWork ? 'FOCUS' : 'BREAK'} · {'🍅'.repeat(Math.min(pomodoro.sessionsCompleted, 5))}</div>
              <div style={{ fontSize: 10, color: thm.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {task?.title ?? '—'}{tracked > 0 ? ` · ⏱${fmtDuration(tracked)}` : ''}
              </div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: pColor, fontVariantNumeric: 'tabular-nums', letterSpacing: 1 }}>
              {fmtCountdown(rem)}
            </div>
            {isWork ? (
              <button onClick={pausePomodoro} title="Pause" style={miniBtn('var(--bg-2)')}>⏸</button>
            ) : (
              <button onClick={() => startPomodoro(pomodoro.taskId!)} title="Skip break" style={miniBtn('var(--bg-2)')}>▶</button>
            )}
            <button onClick={stopPomodoro} title="Stop" style={miniBtn('#200')} >✕</button>
          </div>
        );
      })()}

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' }}>
        {overdue.length > 0 && (
          <Section label={`Overdue · ${overdue.length}`} color="#ef4444">
            {overdue.map(t => <TaskRow key={t.id} {...rowProps(t)} />)}
          </Section>
        )}
        {dueToday.length > 0 && (
          <Section label={`Due today · ${dueToday.length}`} color={accent}>
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 120, color: 'var(--border-1)', fontSize: 13 }}>
            <span>you're clear</span>
            <span style={{ fontSize: 9, marginTop: 4 }}>nothing due soon 👌</span>
          </div>
        )}

        {/* Project pulse */}
        {topProjects.length > 0 && (
          <div style={{ margin: '8px 12px 0', paddingTop: 8, borderTop: '1px solid var(--border-1)' }}>
            <div style={{ fontSize: 9, color: 'var(--text-2)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Projects</div>
            {topProjects.map(p => {
              const done = tasks.filter(t => t.projectId === p.id && t.completed).length;
              const total = tasks.filter(t => t.projectId === p.id).length;
              const pct = total > 0 ? (done / total) * 100 : 0;
              const dl = p.deadline ? differenceInCalendarDays(parseISO(p.deadline), today) : null;
              const pAccent = dl !== null && dl < 0 ? '#ef4444' : dl !== null && dl <= 7 ? accent : p.color;
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: pAccent, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  <div style={{ width: 50, height: 2, background: 'var(--bg-2)', borderRadius: 2, flexShrink: 0 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: pAccent, borderRadius: 2 }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ height: 8 }} />
      </div>

      {/* Quick add */}
      <div style={{ borderTop: '1px solid var(--border-1)', padding: '6px 12px' }}>
        <input
          value={quickAdd}
          onChange={e => setQuickAdd(e.target.value)}
          onKeyDown={submitQuickAdd}
          placeholder="+ add task for today…"
          style={{
            width: '100%', background: 'transparent', border: 'none',
            borderBottom: '1px solid var(--border-1)', color: 'var(--text-2)', fontSize: 13,
            fontFamily: 'Consolas, monospace', padding: '3px 0', outline: 'none', boxSizing: 'border-box',
          }}
          onFocus={e => (e.target.style.borderBottomColor = accent)}
          onBlur={e => (e.target.style.borderBottomColor = 'var(--border-1)')}
        />
      </div>
    </div>
  );
}

function miniBtn(bg: string): React.CSSProperties {
  return {
    width: 22, height: 22, borderRadius: '50%', border: '1px solid var(--border-1)',
    background: bg, color: 'var(--text-2)', cursor: 'pointer', fontSize: 9, padding: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  };
}
