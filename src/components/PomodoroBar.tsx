import { useEffect, useRef, useState, useCallback, type CSSProperties } from 'react';
import { useStore, WORK_DURATION, BREAK_DURATION, fmtDuration, type Task } from '../store';
import { startOfToday, format } from 'date-fns';


function pad(n: number) { return String(n).padStart(2, '0'); }

function fmtCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

const BREAK_COLOR = '#22c55e';
const TOMATO = '🍅';

export function PomodoroBar() {
  const { tasks, projects, pomodoro, timeEntries, startPomodoro, pausePomodoro, stopPomodoro,
          completeWorkSession, startBreak, skipBreak } = useStore();

  const [elapsed, setElapsed] = useState(0);
  const [showBreakModal, setShowBreakModal] = useState(false);
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
        setShowBreakModal(true);
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
  if (pomodoro.phase === 'idle' && !showBreakModal) {
    const todayStr = startOfToday().toISOString().slice(0, 10);
    const todayEntries = timeEntries.filter(e => e.startedAt.slice(0, 10) === todayStr);
    const todaySessions = todayEntries.length;
    const todayMs = todayEntries.reduce((s, e) => s + e.duration, 0);
    const statsLabel = todaySessions > 0
      ? `◉ ${todaySessions} · ${fmtDuration(todayMs)}`
      : '◉ Start focus';

    const priorityOrder = { High: 0, Medium: 1, Low: 2 } as const;
    const todayTasks = tasks
      .filter(t => !t.completed && t.date === format(startOfToday(), 'yyyy-MM-dd'))
      .sort((a, b) => (priorityOrder[a.priority ?? 'Low'] ?? 2) - (priorityOrder[b.priority ?? 'Low'] ?? 2))
      .slice(0, 5);

    return (
      <div ref={dropdownRef} style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9990 }}>
        {showTaskDropdown && (
          <div style={{
            position: 'absolute', bottom: '100%', right: 0, marginBottom: 6,
            background: 'var(--bg-0)', border: '1px solid var(--border-1)',
            borderRadius: 10, padding: '4px 0',
            boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
            fontFamily: 'Consolas, monospace', fontSize: 12,
            minWidth: 220, maxWidth: 280,
            animation: 'pomodoroSlideUp 0.15s ease-out',
          }}>
            {todayTasks.map(t => {
              const proj = projects.find(p => p.id === t.projectId);
              return (
                <button
                  key={t.id}
                  onClick={() => { startPomodoro(t.id); setShowTaskDropdown(false); }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-2)'; }}
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
              <div style={{ height: 1, background: 'var(--border-1)', margin: '4px 8px' }} />
            )}
            <button
              onClick={() => { startPomodoro(null); setShowTaskDropdown(false); }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-2)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '7px 12px', border: 'none',
                background: 'transparent', color: 'var(--text-2)',
                cursor: 'pointer', textAlign: 'left',
                fontFamily: 'inherit', fontSize: 12,
              }}
            >⏱ Misc timer</button>
          </div>
        )}
        <button
          onClick={() => setShowTaskDropdown(v => !v)}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text-1)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-1)'; e.currentTarget.style.color = 'var(--text-2)'; }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--bg-0)', border: '1px solid var(--border-1)',
            borderRadius: 40, padding: '8px 16px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            fontFamily: 'Consolas, monospace', color: 'var(--text-2)',
            fontSize: 12, cursor: 'pointer', userSelect: 'none',
            transition: 'border-color 0.15s, color 0.15s, box-shadow 0.15s',
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1, color: 'var(--accent)' }}>◉</span>
          <span>{statsLabel}</span>
        </button>
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
  const sessionAccent = isWork ? (isEyeRest ? '#22d3ee' : 'var(--accent)') : BREAK_COLOR;
  const R = 16; const C2 = 2 * Math.PI * R;

  return (
    <>
      {!showBreakModal && (
        <div
          style={{
            position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            zIndex: 9990, display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--bg-0)',
            border: `1px solid ${isPaused ? 'var(--border-1)' : sessionAccent === 'var(--accent)' ? 'color-mix(in srgb, var(--accent) 35%, transparent)' : sessionAccent + '35'}`,
            borderRadius: 40, padding: '8px 14px 8px 10px',
            boxShadow: isPaused ? '0 4px 16px rgba(0,0,0,0.4)' : `0 4px 24px rgba(0,0,0,0.6)`,
            fontFamily: 'Consolas, monospace', userSelect: 'none',
            transition: 'box-shadow 0.3s, border-color 0.3s',
            animation: 'pomodoroSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          }}>

          {/* Progress arc */}
          <svg width={32} height={32} style={{ flexShrink: 0, opacity: isPaused ? 0.45 : 1, transition: 'opacity 0.3s' }}>
            <circle cx={16} cy={16} r={R} fill="none" stroke="var(--bg-2)" strokeWidth={2.5} />
            <circle cx={16} cy={16} r={R} fill="none"
              stroke={sessionAccent}
              strokeWidth={2.5}
              strokeDasharray={C2}
              strokeDashoffset={C2 * (1 - pct)}
              strokeLinecap="round"
              style={{ transform: 'rotate(-90deg)', transformOrigin: '16px 16px', transition: 'stroke-dashoffset 0.5s linear' }} />
          </svg>

          {/* Task name */}
          <div style={{ overflow: 'hidden', maxWidth: 160, minWidth: 0 }}>
            <div style={{
              fontSize: 12, color: isPaused ? 'var(--text-2)' : 'var(--text-1)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              opacity: isPaused ? 0.6 : 1,
            }}>
              {isEyeRest ? 'Misc' : isWork ? (task?.title ?? '—') : 'Break'}
              {project && !isEyeRest && (
                <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: project.color, marginLeft: 5, verticalAlign: 'middle', marginBottom: 1 }} />
              )}
            </div>
          </div>

          {/* Countdown */}
          <div style={{
            fontSize: 20, fontWeight: 700, letterSpacing: 1.5, flexShrink: 0,
            fontVariantNumeric: 'tabular-nums',
            color: isPaused ? 'var(--text-2)' : sessionAccent,
            opacity: isPaused ? 0.5 : 1,
            transition: 'color 0.3s, opacity 0.3s',
          }}>
            {fmtCountdown(remaining)}
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {isWork && (
              <button
                onClick={pausePomodoro}
                style={ctrlBtn('var(--bg-2)')}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-1)')}
              >
                {isPaused ? '▶' : '⏸'}
              </button>
            )}
            {!isWork && (
              <button onClick={skipBreak} style={ctrlBtn('var(--bg-2)')}
                onMouseEnter={e => (e.currentTarget.style.borderColor = BREAK_COLOR)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-1)')}
              >▶</button>
            )}
            <button
              onClick={() => { stopPomodoro(); setShowBreakModal(false); }}
              style={ctrlBtn('var(--bg-2)')}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-1)'; e.currentTarget.style.color = 'var(--text-2)'; }}
            >✕</button>
          </div>
        </div>
      )}

      {showBreakModal && (
        <BreakModal
          sessionsCompleted={pomodoro.sessionsCompleted}
          taskTitle={isEyeRest ? '⏱ Misc' : (task?.title ?? '—')}
          onStartBreak={() => { startBreak(); setShowBreakModal(false); }}
          onSkipBreak={() => { skipBreak(); setShowBreakModal(false); }}
          onStop={() => { stopPomodoro(); setShowBreakModal(false); }}
        />
      )}
    </>
  );
}

function ctrlBtn(bg: string): CSSProperties {
  return {
    width: 30, height: 30, borderRadius: '50%',
    border: '1px solid var(--border-1)',
    background: bg, color: 'var(--text-2)', cursor: 'pointer', fontSize: 11,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'Consolas, monospace', transition: 'border-color 0.15s, color 0.15s',
    flexShrink: 0,
  };
}


function btnStyle(bg: string): CSSProperties {
  return {
    width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--border-1)',
    background: bg, color: 'var(--text-2)', cursor: 'pointer', fontSize: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'Consolas, monospace',
  };
}
