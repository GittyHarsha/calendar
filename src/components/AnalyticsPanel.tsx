import React, { useMemo } from 'react';
import { useStore, fmtDuration } from '../store';
import { startOfWeek, endOfWeek, subDays, format, parseISO, isWithinInterval } from 'date-fns';
import { X } from 'lucide-react';

interface AnalyticsPanelProps {
  onClose: () => void;
}

export function AnalyticsPanel({ onClose }: AnalyticsPanelProps) {
  const { tasks, projects, timeEntries, pomodoro, getProjectTime } = useStore();

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  // ── Weekly Summary ──────────────────────────────────────────────────────────
  const weekEntries = useMemo(
    () => timeEntries.filter(e => {
      const d = parseISO(e.startedAt);
      return isWithinInterval(d, { start: weekStart, end: weekEnd });
    }),
    [timeEntries, weekStart, weekEnd]
  );

  const totalFocusMs = weekEntries.reduce((s, e) => s + e.duration, 0);
  const tasksCompletedThisWeek = tasks.filter(t => t.completed && t.date && t.date >= format(weekStart, 'yyyy-MM-dd') && t.date <= format(weekEnd, 'yyyy-MM-dd')).length;
  const sessionsCompleted = pomodoro.sessionsCompleted + weekEntries.length;

  // ── Time per Project ────────────────────────────────────────────────────────
  const projectTimes = useMemo(() => {
    return projects
      .map(p => ({ project: p, ms: getProjectTime(p.id) }))
      .filter(x => x.ms > 0)
      .sort((a, b) => b.ms - a.ms);
  }, [projects, timeEntries]);

  const maxProjectMs = projectTimes[0]?.ms ?? 1;

  // ── Daily Streak Calendar (last 14 days) ────────────────────────────────────
  const days = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const d = subDays(today, 13 - i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const hasEntry = timeEntries.some(e => e.startedAt.startsWith(dateStr));
      return { date: d, dateStr, hasEntry, label: format(d, 'EEE').slice(0, 1) };
    });
  }, [timeEntries, today]);

  // ── Top Tasks ───────────────────────────────────────────────────────────────
  const topTasks = useMemo(() => {
    const taskTimes = tasks.map(t => {
      const ms = timeEntries.filter(e => e.taskId === t.id).reduce((s, e) => s + e.duration, 0);
      return { task: t, ms };
    }).filter(x => x.ms > 0).sort((a, b) => b.ms - a.ms).slice(0, 5);
    return taskTimes;
  }, [tasks, timeEntries]);

  const panel: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    right: 0,
    width: 360,
    height: '100%',
    background: 'var(--bg-0)',
    borderLeft: '1px solid var(--border-1, #252525)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 50,
    fontFamily: 'Consolas, monospace',
    overflowY: 'auto',
    boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
  };

  const header: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-1, #252525)',
    flexShrink: 0,
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--text-2, #686868)',
    marginBottom: 10,
  };

  const section: React.CSSProperties = {
    padding: '14px 16px',
    borderBottom: '1px solid var(--border-1, #252525)',
  };

  const statRow: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 8,
  };

  const statBox: React.CSSProperties = {
    background: 'var(--bg-1, #0F0F0F)',
    borderRadius: 6,
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  };

  const statValue: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 900,
    color: 'var(--accent)',
    lineHeight: 1,
  };

  const statLabel: React.CSSProperties = {
    fontSize: 9,
    color: 'var(--text-2, #686868)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  };

  return (
    <div style={panel}>
      {/* Header */}
      <div style={header}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1, #F0EDEA)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Time Analytics
        </span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2, #686868)', padding: 2, display: 'flex', alignItems: 'center' }}
          title="Close">
          <X size={14} />
        </button>
      </div>

      {/* Weekly Summary */}
      <div style={section}>
        <div style={sectionTitle}>This Week</div>
        <div style={statRow}>
          <div style={statBox}>
            <span style={statValue}>{totalFocusMs > 0 ? fmtDuration(totalFocusMs) : '—'}</span>
            <span style={statLabel}>Focus</span>
          </div>
          <div style={statBox}>
            <span style={statValue}>{tasksCompletedThisWeek}</span>
            <span style={statLabel}>Done</span>
          </div>
          <div style={statBox}>
            <span style={statValue}>{sessionsCompleted}</span>
            <span style={statLabel}>Sessions</span>
          </div>
        </div>
      </div>

      {/* Time per Project */}
      <div style={section}>
        <div style={sectionTitle}>Time per Project</div>
        {projectTimes.length === 0 ? (
          <span style={{ fontSize: 11, color: 'var(--text-2, #686868)', fontStyle: 'italic' }}>No tracked time yet</span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {projectTimes.map(({ project, ms }) => (
              <div key={project.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: project.color, flexShrink: 0, display: 'inline-block' }} />
                  <span style={{ flex: 1, fontSize: 11, color: 'var(--text-1, #F0EDEA)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={project.name}>{project.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-2, #686868)', flexShrink: 0 }}>{fmtDuration(ms)}</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-2, #191919)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    borderRadius: 2,
                    background: project.color,
                    width: `${Math.round((ms / maxProjectMs) * 100)}%`,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Daily Streak Calendar */}
      <div style={section}>
        <div style={sectionTitle}>14-Day Streak</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(14, 1fr)', gap: 3 }}>
          {days.map(({ date, dateStr, hasEntry, label }) => (
            <div key={dateStr} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div
                title={dateStr}
                style={{
                  width: '100%',
                  aspectRatio: '1',
                  borderRadius: 3,
                  background: hasEntry ? 'var(--accent)' : 'var(--bg-2, #191919)',
                  opacity: hasEntry ? 1 : 0.5,
                  transition: 'background 0.2s',
                }}
              />
              <span style={{ fontSize: 8, color: 'var(--text-2, #686868)', lineHeight: 1 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Tasks */}
      <div style={{ ...section, borderBottom: 'none' }}>
        <div style={sectionTitle}>Top Tasks by Time</div>
        {topTasks.length === 0 ? (
          <span style={{ fontSize: 11, color: 'var(--text-2, #686868)', fontStyle: 'italic' }}>No tracked time yet</span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {topTasks.map(({ task, ms }, idx) => (
              <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, color: 'var(--text-2, #686868)', width: 14, flexShrink: 0, textAlign: 'right' }}>{idx + 1}.</span>
                <span style={{ flex: 1, fontSize: 11, color: 'var(--text-1, #F0EDEA)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={task.title}>{task.title}</span>
                <span style={{ fontSize: 11, color: 'var(--accent)', flexShrink: 0, fontWeight: 700 }}>{fmtDuration(ms)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
