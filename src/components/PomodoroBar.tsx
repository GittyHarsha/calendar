import { useEffect, useRef, useState } from 'react';
import { useStore, WORK_DURATION, BREAK_DURATION, fmtDuration } from '../store';
import { startOfToday } from 'date-fns';


function pad(n: number) { return String(n).padStart(2, '0'); }

function fmtCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

const BREAK_COLOR = '#22c55e';

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
  const C = 2 * Math.PI * 28;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 99998,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'var(--bg-1)', border: `1px solid ${BREAK_COLOR}33`, borderRadius: 20,
        padding: '36px 44px', maxWidth: 380, width: '100%', textAlign: 'center',
        fontFamily: 'Consolas, monospace', color: 'var(--text-1)',
        boxShadow: `0 30px 80px rgba(0,0,0,0.8), 0 0 0 1px ${BREAK_COLOR}22`,
      }}>
        {/* Ring with countdown */}
        <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 20px' }}>
          <svg width={80} height={80}>
            <circle cx={40} cy={40} r={28} fill="none" stroke="var(--bg-2)" strokeWidth={3} />
            <circle cx={40} cy={40} r={28} fill="none" stroke={BREAK_COLOR} strokeWidth={3}
              strokeDasharray={C} strokeDashoffset={C * (1 - pct)}
              strokeLinecap="round"
              style={{ transform: 'rotate(-90deg)', transformOrigin: '40px 40px', transition: 'stroke-dashoffset 1s linear' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>☕</span>
          </div>
        </div>

        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, letterSpacing: '0.02em' }}>Session complete!</div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 3 }}>
          {sessionsCompleted} {sessionsCompleted === 1 ? 'session' : 'sessions'} today
          {' · '}{TOMATO.repeat(Math.min(sessionsCompleted, 5))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 20, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.7 }}>
          {taskTitle}
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Break suggested</div>
        <div style={{ fontSize: 40, fontWeight: 700, color: BREAK_COLOR, marginBottom: 28, letterSpacing: 3, fontVariantNumeric: 'tabular-nums' }}>
          {fmtCountdown(breakLeft)}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onStartBreak} style={{
            flex: 1, padding: '11px 0',
            background: `${BREAK_COLOR}18`, border: `1px solid ${BREAK_COLOR}55`,
            borderRadius: 10, color: BREAK_COLOR, fontSize: 13, cursor: 'pointer',
            fontFamily: 'Consolas, monospace', fontWeight: 700, transition: 'background 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = `${BREAK_COLOR}30`)}
            onMouseLeave={e => (e.currentTarget.style.background = `${BREAK_COLOR}18`)}
          >
            ☕ Start break
          </button>
          <button onClick={onSkipBreak} style={{
            flex: 1, padding: '11px 0',
            background: 'var(--bg-2)', border: '1px solid var(--border-1)',
            borderRadius: 10, color: 'var(--text-2)', fontSize: 13, cursor: 'pointer',
            fontFamily: 'Consolas, monospace', transition: 'color 0.15s, border-color 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-1)'; e.currentTarget.style.borderColor = 'var(--text-2)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-2)'; e.currentTarget.style.borderColor = 'var(--border-1)'; }}
          >
            Skip → continue
          </button>
        </div>
        <button onClick={onStop} style={{
          marginTop: 12, width: '100%', padding: '8px 0', background: 'transparent',
          border: 'none', color: 'var(--text-2)', fontSize: 12, cursor: 'pointer',
          fontFamily: 'Consolas, monospace', opacity: 0.6, transition: 'opacity 0.15s',
        }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
        >
          Done for now
        </button>
      </div>
    </div>
  );
}

export function PomodoroBar() {
  const { tasks, projects, pomodoro, timeEntries, startPomodoro, pausePomodoro, stopPomodoro,
          completeWorkSession, startBreak, skipBreak, focusGoalMinutes, getTaskTime } = useStore();

  const [elapsed, setElapsed] = useState(0);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [hovered, setHovered] = useState(false);
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
    const todayFocusMin = Math.floor(todayMs / 60000);
    const goalPct = focusGoalMinutes > 0 ? Math.min(1, todayFocusMin / focusGoalMinutes) : 0;
    const ringColor = goalPct >= 1 ? BREAK_COLOR : 'var(--accent)';
    const C = 2 * Math.PI * 10;
    const statsLabel = todaySessions > 0
      ? `◉ ${todaySessions} · ${fmtDuration(todayMs)}`
      : '◉ Start focus';

    return (
      <button
        onClick={() => startPomodoro(null)}
        title={focusGoalMinutes > 0 ? `${todayFocusMin}/${focusGoalMinutes} min goal · Click to start misc timer` : 'Start a focus session'}
        onMouseEnter={e => { setHovered(true); e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text-1)'; }}
        onMouseLeave={e => { setHovered(false); e.currentTarget.style.borderColor = 'var(--border-1)'; e.currentTarget.style.color = 'var(--text-2)'; }}
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
        {focusGoalMinutes > 0 ? (
          <svg width={22} height={22} style={{ flexShrink: 0 }}>
            <circle cx={11} cy={11} r={10} fill="none" stroke="var(--bg-2)" strokeWidth={2.5} />
            <circle cx={11} cy={11} r={10} fill="none" stroke={ringColor} strokeWidth={2.5}
              strokeDasharray={C} strokeDashoffset={C * (1 - goalPct)}
              strokeLinecap="round"
              style={{ transform: 'rotate(-90deg)', transformOrigin: '11px 11px', transition: 'stroke-dashoffset 0.5s' }} />
            {goalPct >= 1 && (
              <text x={11} y={14} textAnchor="middle" fill={ringColor} fontSize={7} fontFamily="Consolas">✓</text>
            )}
          </svg>
        ) : (
          <span style={{ fontSize: 14, lineHeight: 1, color: 'var(--accent)' }}>◉</span>
        )}
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
  const totalTracked = task ? getTaskTime(task.id) : 0;

  return (
    <>
      {!showBreakModal && (
        <div
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            zIndex: 9990, display: 'flex', alignItems: 'center', gap: 14,
            background: 'var(--bg-0)', border: `1px solid ${isPaused ? 'var(--border-1)' : sessionAccent === 'var(--accent)' ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : sessionAccent + '40'}`,
            borderRadius: 40, padding: '10px 20px',
            boxShadow: isPaused
              ? '0 4px 20px rgba(0,0,0,0.5)'
              : `0 4px 32px rgba(0,0,0,0.7), 0 0 20px ${sessionAccent === 'var(--accent)' ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : sessionAccent + '25'}`,
            fontFamily: 'Consolas, monospace', userSelect: 'none',
            minWidth: 380, maxWidth: 520,
            transition: 'box-shadow 0.3s, border-color 0.3s',
            animation: 'pomodoroSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          }}>

          {/* Progress ring */}
          <svg width={38} height={38} style={{ flexShrink: 0, opacity: isPaused ? 0.5 : 1, transition: 'opacity 0.3s' }}>
            <circle cx={19} cy={19} r={R} fill="none" stroke="var(--bg-2)" strokeWidth={3} />
            <circle cx={19} cy={19} r={R} fill="none"
              stroke={sessionAccent}
              strokeWidth={3}
              strokeDasharray={C2}
              strokeDashoffset={C2 * (1 - pct)}
              strokeLinecap="round"
              style={{ transform: 'rotate(-90deg)', transformOrigin: '19px 19px', transition: 'stroke-dashoffset 0.5s linear' }} />
            <text x={19} y={23} textAnchor="middle"
              fill={sessionAccent}
              fontSize={10} fontFamily="Consolas">
              {isPaused ? '⏸' : isWork ? '▶' : '☕'}
            </text>
          </svg>

          {/* Task info */}
          <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
            <div style={{ fontSize: 9, color: 'var(--text-2)', marginBottom: 2, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {isPaused ? '⏸ Paused' : isEyeRest ? 'Misc' : isWork ? `Focus · Session ${pomodoro.sessionsCompleted + 1}` : 'Break'}
              {!isPaused && !isEyeRest && isWork && pomodoro.sessionsCompleted > 0 && (
                <span style={{ marginLeft: 6, opacity: 0.7 }}>{TOMATO.repeat(Math.min(pomodoro.sessionsCompleted, 5))}{pomodoro.sessionsCompleted > 5 ? `+${pomodoro.sessionsCompleted - 5}` : ''}</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {isEyeRest ? (
                <span style={{ fontSize: 13, color: '#22d3ee', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>⏱ Misc timer</span>
              ) : (
                <>
                  {project && <span style={{ width: 7, height: 7, borderRadius: '50%', background: project.color, flexShrink: 0 }} />}
                  <span style={{ fontSize: 13, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {isWork ? (task?.title ?? '—') : 'Time to rest'}
                  </span>
                </>
              )}
            </div>
            {task && totalTracked > 0 && hovered && (
              <div style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 2, opacity: 0.7 }}>
                ⏱ {fmtDuration(totalTracked)} total on this task
              </div>
            )}
          </div>

          {/* Countdown */}
          <div style={{
            fontSize: 28, fontWeight: 700, letterSpacing: 2, flexShrink: 0,
            minWidth: 76, textAlign: 'center', fontVariantNumeric: 'tabular-nums',
            color: isPaused ? 'var(--text-2)' : sessionAccent,
            opacity: isPaused ? 0.5 : 1,
            transition: 'color 0.3s, opacity 0.3s',
          }}>
            {fmtCountdown(remaining)}
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {isWork && (
              <button
                onClick={pausePomodoro}
                title={isPaused ? 'Resume (Space)' : 'Pause (Space)'}
                style={ctrlBtn('var(--bg-2)')}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-1)')}
              >
                {isPaused ? '▶' : '⏸'}
              </button>
            )}
            {!isWork && (
              <button onClick={skipBreak} title="Skip break" style={ctrlBtn('var(--bg-2)')}
                onMouseEnter={e => (e.currentTarget.style.borderColor = BREAK_COLOR)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-1)')}
              >▶</button>
            )}
            <button
              onClick={() => { stopPomodoro(); setShowBreakModal(false); }}
              title="Stop session"
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

function ctrlBtn(bg: string): React.CSSProperties {
  return {
    width: 30, height: 30, borderRadius: '50%',
    border: '1px solid var(--border-1)',
    background: bg, color: 'var(--text-2)', cursor: 'pointer', fontSize: 11,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'Consolas, monospace', transition: 'border-color 0.15s, color 0.15s',
    flexShrink: 0,
  };
}


function btnStyle(bg: string): React.CSSProperties {
  return {
    width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--border-1)',
    background: bg, color: 'var(--text-2)', cursor: 'pointer', fontSize: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'Consolas, monospace',
  };
}
