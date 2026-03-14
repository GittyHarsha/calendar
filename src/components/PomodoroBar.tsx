import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useStore, WORK_DURATION, BREAK_DURATION, fmtDuration } from '../store';
import { startOfToday, format } from 'date-fns';


function pad(n: number) { return String(n).padStart(2, '0'); }

function fmtCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

export function PomodoroBar() {
  const { tasks, projects, pomodoro, timeEntries, startPomodoro, pausePomodoro, stopPomodoro,
          completeWorkSession, startBreak, skipBreak } = useStore();

  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick
  useEffect(() => {
    if (pomodoro.phase !== 'work' && pomodoro.phase !== 'break') {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setElapsed(0);
      return;
    }
    if (pomodoro.paused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setElapsed(pomodoro.pausedElapsed);
      return;
    }
    if (!pomodoro.sessionStart) return;

    const tick = () => {
      const e = Date.now() - new Date(pomodoro.sessionStart!).getTime();
      setElapsed(e);

      if (pomodoro.phase === 'work' && e >= WORK_DURATION) {
        completeWorkSession();
        if (intervalRef.current) clearInterval(intervalRef.current);
        try {
          const taskTitle = tasks.find(t => t.id === pomodoro.taskId)?.title ?? null;
          (window as any).chrome?.webview?.postMessage({
            type: 'pomodoroComplete',
            isEyeRest: pomodoro.taskId === null,
            taskTitle,
            sessionsCompleted: pomodoro.sessionsCompleted + 1,
          });
        } catch { /* not in desktop app */ }
      }

      if (pomodoro.phase === 'break' && e >= BREAK_DURATION) {
        skipBreak();
        if (intervalRef.current) clearInterval(intervalRef.current);
        try { (window as any).chrome?.webview?.postMessage({ type: 'breakComplete' }); } catch { /* not in desktop app */ }
      }
    };
    tick();
    intervalRef.current = setInterval(tick, 500);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [pomodoro.phase, pomodoro.sessionStart, pomodoro.paused]);

  const [showTaskDropdown, setShowTaskDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on Escape or click outside
  useEffect(() => {
    if (!showTaskDropdown) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowTaskDropdown(false); };
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowTaskDropdown(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick); };
  }, [showTaskDropdown]);

  // ── Idle state ──────────────────────────────────────────────────────────────
  if (pomodoro.phase === 'idle') {
    const todayStr = startOfToday().toISOString().slice(0, 10);
    const todayEntries = timeEntries.filter(e => e.startedAt.slice(0, 10) === todayStr);
    const todaySessions = todayEntries.length;
    const todayMs = todayEntries.reduce((s, e) => s + e.duration, 0);
    const statsLabel = todaySessions > 0
      ? `${todaySessions} · ${fmtDuration(todayMs)}`
      : null;

    const priorityOrder = { High: 0, Medium: 1, Low: 2 } as const;
    const todayTasks = tasks
      .filter(t => !t.completed && t.date === format(startOfToday(), 'yyyy-MM-dd'))
      .sort((a, b) => (priorityOrder[a.priority ?? 'Low'] ?? 2) - (priorityOrder[b.priority ?? 'Low'] ?? 2))
      .slice(0, 5);

    return (
      <div ref={dropdownRef} style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9990,
        height: 40, background: 'var(--bg-0)', borderTop: '1px solid #1E1E1E',
        display: 'flex', alignItems: 'center', padding: '0 12px',
        fontFamily: 'Consolas, monospace',
      }}>
        {showTaskDropdown && (
          <div style={{
            position: 'absolute', bottom: '100%', left: 12, marginBottom: 4,
            background: 'var(--bg-0)', border: '1px solid #1E1E1E',
            borderRadius: 8, padding: '4px 0',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            fontSize: 12, minWidth: 220, maxWidth: 280,
          }}>
            {todayTasks.map(t => {
              const proj = projects.find(p => p.id === t.projectId);
              return (
                <button
                  key={t.id}
                  onClick={() => { startPomodoro(t.id); setShowTaskDropdown(false); }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#1A1A1A'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '7px 12px', border: 'none',
                    background: 'transparent', color: 'var(--text-1)',
                    cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'inherit', fontSize: 12,
                  }}
                >
                  {proj && (
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: proj.color, flexShrink: 0,
                    }} />
                  )}
                  <span style={{
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap', flex: 1,
                  }}>{t.title}</span>
                </button>
              );
            })}
            {todayTasks.length > 0 && (
              <div style={{ height: 1, background: '#1E1E1E', margin: '4px 8px' }} />
            )}
            <button
              onClick={() => { startPomodoro(null); setShowTaskDropdown(false); }}
              onMouseEnter={e => { e.currentTarget.style.background = '#1A1A1A'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '7px 12px', border: 'none',
                background: 'transparent', color: '#888',
                cursor: 'pointer', textAlign: 'left',
                fontFamily: 'inherit', fontSize: 12,
              }}
            >⏱ Misc timer</button>
          </div>
        )}
        <button
          onClick={() => setShowTaskDropdown(v => !v)}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-1)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#666'; }}
          style={{
            ...ctrlBtn(),
            gap: 6, width: 'auto', padding: '0 8px',
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1, color: 'var(--accent)' }}>◉</span>
          <span>Start focus</span>
        </button>
        {statsLabel && (
          <span style={{ fontSize: 10, color: '#555', marginLeft: 10 }}>{statsLabel}</span>
        )}
      </div>
    );
  }

  // ── Active session bar ───────────────────────────────────────────────────────
  const task = tasks.find(t => t.id === pomodoro.taskId);
  const isEyeRest = pomodoro.taskId === null;
  const project = task ? projects.find(p => p.id === task.projectId) : null;
  const isWork = pomodoro.phase === 'work';
  const duration = isWork ? WORK_DURATION : BREAK_DURATION;
  const remaining = Math.max(0, duration - elapsed);
  const pct = Math.min(1, elapsed / duration);
  const isPaused = pomodoro.paused;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9990,
      height: 40, background: 'var(--bg-0)', borderTop: '1px solid #1E1E1E',
      fontFamily: 'Consolas, monospace', userSelect: 'none',
    }}>
      {/* Progress bar — 2px at very top of bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: '#1A1A1A',
      }}>
        <div style={{
          height: '100%', width: `${pct * 100}%`,
          background: 'var(--accent)', opacity: 0.6,
          transition: 'width 0.5s linear',
        }} />
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', height: '100%',
        padding: '0 12px', gap: 10,
      }}>
        {/* Task name */}
        <div style={{
          fontSize: 12, color: '#888',
          overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap', maxWidth: 200,
        }}>
          {isEyeRest ? 'Misc' : isWork ? (task?.title ?? '—') : 'Break'}
          {project && !isEyeRest && (
            <span style={{
              display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
              background: project.color, marginLeft: 5, verticalAlign: 'middle', marginBottom: 1,
            }} />
          )}
        </div>

        {/* Countdown */}
        <div style={{
          fontSize: 14, fontFamily: 'Consolas, monospace', fontWeight: 500,
          color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums', flexShrink: 0,
        }}>
          {fmtCountdown(remaining)}
        </div>

        {/* Session indicator */}
        {pomodoro.sessionsCompleted > 0 && (
          <span style={{ fontSize: 10, color: '#555', flexShrink: 0 }}>
            Focus {pomodoro.sessionsCompleted}
          </span>
        )}

        {/* Controls */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {isWork && (
            <button onClick={pausePomodoro} style={ctrlBtn()}
              onMouseEnter={e => { e.currentTarget.style.background = '#1A1A1A'; e.currentTarget.style.color = 'var(--text-1)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#666'; }}
            >
              {isPaused ? '▶' : '⏸'}
            </button>
          )}
          {!isWork && (
            <button onClick={skipBreak} style={ctrlBtn()}
              onMouseEnter={e => { e.currentTarget.style.background = '#1A1A1A'; e.currentTarget.style.color = 'var(--text-1)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#666'; }}
            >▶</button>
          )}
          <button onClick={() => { stopPomodoro(); }} style={ctrlBtn()}
            onMouseEnter={e => { e.currentTarget.style.background = '#1A1A1A'; e.currentTarget.style.color = 'var(--text-1)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#666'; }}
          >✕</button>
        </div>
      </div>
    </div>
  );
}

function ctrlBtn(): CSSProperties {
  return {
    width: 28, height: 28, borderRadius: 6,
    border: 'none', background: 'transparent',
    color: '#666', cursor: 'pointer', fontSize: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'Consolas, monospace', transition: 'background 0.15s, color 0.15s',
    flexShrink: 0,
  };
}

