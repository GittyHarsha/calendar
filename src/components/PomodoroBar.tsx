import { useEffect, useRef, useState } from 'react';
import { useStore, WORK_DURATION, BREAK_DURATION, fmtDuration } from '../store';
import { startOfToday } from 'date-fns';

const TOMATO = '🍅';

function pad(n: number) { return String(n).padStart(2, '0'); }

function fmtCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

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

  // Auto-start break countdown for display only (user still has to click)
  useEffect(() => {
    intervalRef.current = setInterval(() => setBreakLeft(t => Math.max(0, t - 1000)), 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 99998,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 16,
        padding: '32px 40px', maxWidth: 360, width: '100%', textAlign: 'center',
        fontFamily: 'Consolas, monospace', color: 'var(--text-1)', boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
      }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🍅</div>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Session complete!</div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>
          {sessionsCompleted} {sessionsCompleted === 1 ? 'session' : 'sessions'} today
        </div>
        <div style={{ fontSize: 12, color: '#555', marginBottom: 24, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {taskTitle}
        </div>

        <div style={{ fontSize: 14, color: '#aaa', marginBottom: 8 }}>Take a 5-min break</div>
        <div style={{ fontSize: 36, fontWeight: 700, color: '#22c55e', marginBottom: 28, letterSpacing: 2 }}>
          {fmtCountdown(breakLeft)}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={onStartBreak} style={{
            flex: 1, padding: '10px 0', background: '#1a2e1a', border: '1px solid #22c55e',
            borderRadius: 8, color: '#22c55e', fontSize: 13, cursor: 'pointer', fontFamily: 'Consolas, monospace',
          }}>
            Start break
          </button>
          <button onClick={onSkipBreak} style={{
            flex: 1, padding: '10px 0', background: 'var(--bg-2)', border: '1px solid var(--border-1)',
            borderRadius: 8, color: 'var(--text-2)', fontSize: 13, cursor: 'pointer', fontFamily: 'Consolas, monospace',
          }}>
            Skip → continue
          </button>
        </div>
        <button onClick={onStop} style={{
          marginTop: 12, width: '100%', padding: '8px 0', background: 'transparent',
          border: 'none', color: '#555', fontSize: 12, cursor: 'pointer', fontFamily: 'Consolas, monospace',
        }}>
          Done for now
        </button>
      </div>
    </div>
  );
}

export function PomodoroBar() {
  const { tasks, projects, pomodoro, timeEntries, startPomodoro, pausePomodoro, stopPomodoro,
          completeWorkSession, startBreak, skipBreak, focusGoalMinutes } = useStore();

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
      // Frozen — show the paused elapsed time, don't tick
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
        // Fire Windows balloon tip via WebView2 message channel
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
        // Notify break over
        try {
          (window as any).chrome?.webview?.postMessage({ type: 'breakComplete' });
        } catch { /* not in desktop app */ }
      }
    };
    tick();
    intervalRef.current = setInterval(tick, 500);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [pomodoro.phase, pomodoro.sessionStart, pomodoro.paused]);

  if (pomodoro.phase === 'idle' && !showBreakModal) {
    const todayStr = startOfToday().toISOString().slice(0, 10);
    const todayEntries = timeEntries.filter(e => e.startedAt.slice(0, 10) === todayStr);
    const todaySessions = todayEntries.length;
    const todayMs = todayEntries.reduce((s, e) => s + e.duration, 0);
    const todayFocusMin = Math.floor(todayMs / 60000);
    const goalPct = focusGoalMinutes > 0 ? Math.min(1, todayFocusMin / focusGoalMinutes) : 0;
    const ringColor = goalPct >= 1 ? '#22c55e' : 'var(--accent)';
    const C = 2 * Math.PI * 10;
    const statsLabel = todaySessions > 0
      ? `🍅 ${todaySessions} · ${fmtDuration(todayMs)} today`
      : '🍅 Focus';
    return (
      <button
        onClick={() => startPomodoro(null)}
        title="Start a focus session"
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 9990,
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--bg-0)', border: '1px solid var(--border-1)',
          borderRadius: 40, padding: '8px 16px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          fontFamily: 'Consolas, monospace', color: 'var(--text-2)',
          fontSize: 13, cursor: 'pointer', userSelect: 'none',
        }}
      >
        {focusGoalMinutes > 0 && (
          <svg width={24} height={24} style={{ flexShrink: 0 }}>
            <circle cx={12} cy={12} r={10} fill="none" stroke="var(--bg-2)" strokeWidth={2.5} />
            <circle cx={12} cy={12} r={10} fill="none" stroke={ringColor} strokeWidth={2.5}
              strokeDasharray={C}
              strokeDashoffset={C * (1 - goalPct)}
              strokeLinecap="round"
              style={{ transform: 'rotate(-90deg)', transformOrigin: '12px 12px', transition: 'stroke-dashoffset 0.5s' }} />
            {goalPct >= 1 && (
              <text x={12} y={16} textAnchor="middle" fill={ringColor} fontSize={8} fontFamily="Consolas">✓</text>
            )}
          </svg>
        )}
        <span>{statsLabel}</span>
      </button>
    );
  }

  const task = tasks.find(t => t.id === pomodoro.taskId);
  const isEyeRest = pomodoro.taskId === null;
  const project = task ? projects.find(p => p.id === task.projectId) : null;
  const isWork = pomodoro.phase === 'work';
  const duration = isWork ? WORK_DURATION : BREAK_DURATION;
  const remaining = Math.max(0, duration - elapsed);
  const pct = Math.min(1, elapsed / duration);
  const accent = isWork ? (isEyeRest ? '#22d3ee' : '#F27D26') : '#22c55e';

  return (
    <>
      {/* Floating bar */}
      {!showBreakModal && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9990, display: 'flex', alignItems: 'center', gap: 14,
          background: 'var(--bg-0)', border: `1px solid ${accent}33`,
          borderRadius: 40, padding: '10px 20px',
          boxShadow: `0 4px 32px rgba(0,0,0,0.7), 0 0 0 1px ${accent}22`,
          fontFamily: 'Consolas, monospace', userSelect: 'none',
          minWidth: 360, maxWidth: 520,
        }}>
          {/* Progress ring */}
          <svg width={38} height={38} style={{ flexShrink: 0 }}>
            <circle cx={19} cy={19} r={16} fill="none" stroke="#1f1f1f" strokeWidth={3} />
            <circle cx={19} cy={19} r={16} fill="none" stroke={accent} strokeWidth={3}
              strokeDasharray={`${2 * Math.PI * 16}`}
              strokeDashoffset={`${2 * Math.PI * 16 * (1 - pct)}`}
              strokeLinecap="round"
              style={{ transform: 'rotate(-90deg)', transformOrigin: '19px 19px', transition: 'stroke-dashoffset 0.5s' }} />
            <text x={19} y={23} textAnchor="middle" fill={accent} fontSize={9} fontFamily="Consolas">
              {isWork ? '▶' : '☕'}
            </text>
          </svg>

          {/* Task info */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: 10, color: '#555', marginBottom: 1 }}>
              {isEyeRest ? 'MISC' : isWork ? 'FOCUS' : 'BREAK'} · {TOMATO.repeat(Math.min(pomodoro.sessionsCompleted, 6))}
              {pomodoro.sessionsCompleted > 6 ? `+${pomodoro.sessionsCompleted - 6}` : ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {isEyeRest
                ? <span style={{ fontSize: 13, color: '#22d3ee', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>⏱ Misc</span>
                : <>
                    {project && <span style={{ width: 7, height: 7, borderRadius: '50%', background: project.color, display: 'inline-block', flexShrink: 0 }} />}
                    <span style={{ fontSize: 13, color: '#D4D3D0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>
                      {task?.title ?? '—'}
                    </span>
                  </>
              }
            </div>
          </div>

          {/* Countdown */}
          <div style={{ fontSize: 26, fontWeight: 700, color: pomodoro.paused ? '#555' : accent, letterSpacing: 2, flexShrink: 0, minWidth: 72, textAlign: 'center', opacity: pomodoro.paused ? 0.6 : 1 }}>
            {fmtCountdown(remaining)}
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {isWork && (
              <button onClick={pausePomodoro} title={pomodoro.paused ? 'Resume' : 'Pause'} style={btnStyle('#444')}>{pomodoro.paused ? '▶' : '⏸'}</button>
            )}
            {!isWork && (
              <button onClick={skipBreak} title="Skip break" style={btnStyle('#444')}>▶</button>
            )}
            <button onClick={() => { stopPomodoro(); setShowBreakModal(false); }} title="Stop" style={btnStyle('#300')}>✕</button>
          </div>
        </div>
      )}

      {/* Break modal */}
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

function btnStyle(bg: string): React.CSSProperties {
  return {
    width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--border-1)',
    background: bg, color: 'var(--text-2)', cursor: 'pointer', fontSize: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'Consolas, monospace',
  };
}
