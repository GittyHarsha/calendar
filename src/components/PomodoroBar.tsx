import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useStore, WORK_DURATION, BREAK_DURATION, fmtDuration } from '../store';
import { startOfToday } from 'date-fns';


function pad(n: number) { return String(n).padStart(2, '0'); }

function fmtCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

const BREAK_COLOR = '#22c55e';
const TOMATO = '🍅';

/** Modal shown when a 25-min work session finishes */
function BreakModal({ sessionsCompleted, taskTitle, onStartBreak, onSkipBreak, onStop }: {
  sessionsCompleted: number;
  taskTitle: string;
  onStartBreak: () => void;
  onSkipBreak: () => void;
  onStop: () => void;
}) {
  const [breakLeft, setBreakLeft] = useState(BREAK_DURATION);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => setBreakLeft(t => Math.max(0, t - 1000)), 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onSkipBreak(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onSkipBreak]);

  const pct = 1 - (breakLeft / BREAK_DURATION);
  const C = 2 * Math.PI * 44;
  const mins = Math.floor(breakLeft / 60000);
  const secs = Math.floor((breakLeft % 60000) / 1000);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99998,
      background: 'rgba(0,0,0,0.92)',
      backdropFilter: 'blur(12px)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Consolas, monospace',
      animation: 'fadeIn 0.3s ease',
    }}>
      {/* Big heading */}
      <div style={{ fontSize: 13, color: BREAK_COLOR, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 16, opacity: 0.8 }}>
        session {sessionsCompleted} complete
      </div>
      <div style={{ fontSize: 52, fontWeight: 900, color: '#fff', letterSpacing: '0.04em', lineHeight: 1, marginBottom: 8, textAlign: 'center' }}>
        STOP WORKING.
      </div>
      <div style={{ fontSize: 20, color: 'var(--text-2)', marginBottom: 6, letterSpacing: '0.06em' }}>
        step away from the screen.
      </div>
      {taskTitle && (
        <div style={{ fontSize: 12, color: 'var(--text-2)', opacity: 0.5, marginBottom: 48, maxWidth: 400, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {taskTitle}
        </div>
      )}

      {/* Break countdown ring */}
      <div style={{ position: 'relative', width: 120, height: 120, marginBottom: 40 }}>
        <svg width={120} height={120}>
          <circle cx={60} cy={60} r={44} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={4} />
          <circle cx={60} cy={60} r={44} fill="none" stroke={BREAK_COLOR} strokeWidth={4}
            strokeDasharray={C} strokeDashoffset={C * (1 - pct)}
            strokeLinecap="round"
            style={{ transform: 'rotate(-90deg)', transformOrigin: '60px 60px', transition: 'stroke-dashoffset 1s linear' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: BREAK_COLOR, fontVariantNumeric: 'tabular-nums', letterSpacing: 2 }}>
            {String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')}
          </span>
          <span style={{ fontSize: 9, color: 'var(--text-2)', letterSpacing: '0.12em', marginTop: 2 }}>BREAK</span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <button onClick={onStartBreak} style={{
          padding: '13px 32px',
          background: `${BREAK_COLOR}22`, border: `1px solid ${BREAK_COLOR}66`,
          borderRadius: 10, color: BREAK_COLOR, fontSize: 14, cursor: 'pointer',
          fontFamily: 'Consolas, monospace', fontWeight: 700, letterSpacing: '0.05em',
          transition: 'background 0.15s, border-color 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = `${BREAK_COLOR}38`; e.currentTarget.style.borderColor = BREAK_COLOR; }}
          onMouseLeave={e => { e.currentTarget.style.background = `${BREAK_COLOR}22`; e.currentTarget.style.borderColor = `${BREAK_COLOR}66`; }}
        >
          ☕ break
        </button>
        <button onClick={onSkipBreak} style={{
          padding: '13px 32px',
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 10, color: 'rgba(255,255,255,0.4)', fontSize: 14, cursor: 'pointer',
          fontFamily: 'Consolas, monospace', letterSpacing: '0.05em',
          transition: 'color 0.15s, border-color 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
        >
          skip →
        </button>
      </div>
      <button onClick={onStop} style={{
        background: 'transparent', border: 'none',
        color: 'rgba(255,255,255,0.2)', fontSize: 11, cursor: 'pointer',
        fontFamily: 'Consolas, monospace', letterSpacing: '0.08em',
        transition: 'color 0.15s',
      }}
        onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
      >
        done for today
      </button>
    </div>
  );
}

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

  // ── Idle state ──────────────────────────────────────────────────────────────
  if (pomodoro.phase === 'idle' && !showBreakModal) {
    const todayStr = startOfToday().toISOString().slice(0, 10);
    const todayEntries = timeEntries.filter(e => e.startedAt.slice(0, 10) === todayStr);
    const todaySessions = todayEntries.length;
    const todayMs = todayEntries.reduce((s, e) => s + e.duration, 0);
    const statsLabel = todaySessions > 0
      ? `◉ ${todaySessions} · ${fmtDuration(todayMs)}`
      : '◉ Start focus';

    return (
      <button
        onClick={() => startPomodoro(null)}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text-1)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-1)'; e.currentTarget.style.color = 'var(--text-2)'; }}
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 9990,
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
