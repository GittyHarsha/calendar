import React, { useMemo, useState, useEffect } from 'react';
import { useStore, fmtDuration } from '../store';
import { startOfWeek, endOfWeek, subDays, subWeeks, format, getHours, parseISO, isWithinInterval } from 'date-fns';
import { X, Download, Copy, FileJson } from 'lucide-react';
import { exportTimeLogCSV, exportTimeLogJSON, copyMarkdownSummary } from '../utils/exportTimeLogs';

interface AnalyticsPanelProps {
  onClose: () => void;
}

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start: number | null = null;
    let frameId: number;
    const to = value;
    const step = (timestamp: number) => {
      if (start === null) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / 600, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(to * eased));
      if (progress < 1) { frameId = requestAnimationFrame(step); }
    };
    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [value]);
  return <span>{display}{suffix}</span>;
}

export function AnalyticsPanel({ onClose }: AnalyticsPanelProps) {
  const { tasks, projects, timeEntries, pomodoro, getProjectTime, focusGoalMinutes, setFocusGoal } = useStore();
  const [editingGoal, setEditingGoal] = useState(false);
  const [tab, setTab] = useState<'daily' | 'weekly' | 'alltime'>('weekly');
  const [copied, setCopied] = useState(false);

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

  const dailyProjectTimes = useMemo(() => {
    const msMap = new Map<string, number>();
    todayEntries.forEach(e => {
      const task = tasks.find(t => t.id === e.taskId);
      if (task?.projectId) msMap.set(task.projectId, (msMap.get(task.projectId) ?? 0) + e.duration);
    });
    return projects
      .filter(p => msMap.has(p.id))
      .map(p => ({ project: p, ms: msMap.get(p.id)! }))
      .sort((a, b) => b.ms - a.ms);
  }, [todayEntries, tasks, projects]);

  const maxDailyProjectMs = dailyProjectTimes[0]?.ms ?? 1;

  const dailyTopTasks = useMemo(() => {
    return tasks.map(t => {
      const ms = todayEntries.filter(e => e.taskId === t.id).reduce((s, e) => s + e.duration, 0);
      return { task: t, ms };
    }).filter(x => x.ms > 0).sort((a, b) => b.ms - a.ms).slice(0, 5);
  }, [tasks, todayEntries]);

  // ── Daily Streak Calendar (last 14 days) ────────────────────────────────────
  const days = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const d = subDays(today, 13 - i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const hasEntry = timeEntries.some(e => e.startedAt.startsWith(dateStr));
      return { date: d, dateStr, hasEntry, label: format(d, 'EEE').slice(0, 1) };
    });
  }, [timeEntries, today]);

  // ── 30-Day Focus Bars ───────────────────────────────────────────────────────
  const thirtyDayBars = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const d = subDays(today, 29 - i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const entries = timeEntries.filter(e => e.startedAt.startsWith(dateStr));
      const totalMin = Math.round(entries.reduce((s, e) => s + e.duration, 0) / 60000);
      const isToday = i === 29;
      const isMonday = format(d, 'EEE') === 'Mon';
      const hh = Math.floor(totalMin / 60);
      const mm = totalMin % 60;
      const durStr = hh > 0 ? `${hh}h ${mm}m` : `${mm}m`;
      const tooltip = `${format(d, 'EEE MMM d')} · ${totalMin > 0 ? durStr : '0m'} · ${entries.length} session${entries.length !== 1 ? 's' : ''}`;
      return { dateStr, totalMin, isToday, isMonday, tooltip };
    });
  }, [timeEntries]);

  const maxDayMin = Math.max(...thirtyDayBars.map(b => b.totalMin), 1);

  // ── Hour-of-Day Heatmap ─────────────────────────────────────────────────────
  const hourHeatmap = useMemo(() => {
    const hourTotals = Array.from({ length: 24 }, (_, h) => {
      const entries = timeEntries.filter(e => getHours(parseISO(e.startedAt)) === h);
      const totalMin = Math.round(entries.reduce((s, e) => s + e.duration, 0) / 60000);
      return { hour: h, totalMin };
    });
    const maxMin = Math.max(...hourTotals.map(h => h.totalMin), 1);
    return hourTotals.map(({ hour, totalMin }) => {
      const intensity = totalMin === 0 ? 0 : totalMin / maxMin;
      const hh = Math.floor(totalMin / 60);
      const mm = totalMin % 60;
      const durStr = hh > 0 ? `${hh}h ${mm}m` : `${mm}m`;
      const label = hour === 0 ? '12am' : hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`;
      const showLabel = hour === 0 || hour === 6 || hour === 12 || hour === 18;
      const tooltip = `${label} · ${totalMin > 0 ? durStr : '0m'} total`;
      return { hour, totalMin, intensity, label, showLabel, tooltip };
    });
  }, [timeEntries]);

  // ── Session Length Distribution ──────────────────────────────────────────────
  const sessionLengths = useMemo(() => {
    const buckets = [
      { label: '<5m',   min: 0,           max: 5 * 60000,   color: '#ef4444' },
      { label: '5–15m', min: 5 * 60000,   max: 15 * 60000,  color: 'var(--accent)' },
      { label: '15–25m',min: 15 * 60000,  max: 25 * 60000,  color: 'var(--accent)' },
      { label: '25m+',  min: 25 * 60000,  max: Infinity,     color: 'var(--accent)' },
    ];
    const counts = buckets.map(b => ({
      ...b,
      count: timeEntries.filter(e => e.duration >= b.min && e.duration < b.max).length,
    }));
    const maxCount = Math.max(...counts.map(c => c.count), 1);
    return counts.map(c => ({ ...c, pct: c.count / maxCount }));
  }, [timeEntries]);

  // ── Top Tasks ───────────────────────────────────────────────────────────────
  const topTasks = useMemo(() => {
    const taskTimes = tasks.map(t => {
      const ms = timeEntries.filter(e => e.taskId === t.id).reduce((s, e) => s + e.duration, 0);
      return { task: t, ms };
    }).filter(x => x.ms > 0).sort((a, b) => b.ms - a.ms).slice(0, 5);
    return taskTimes;
  }, [tasks, timeEntries]);

  // ── Today's focus ───────────────────────────────────────────────────────────
  const todayStr = format(today, 'yyyy-MM-dd');
  const todayEntries = useMemo(
    () => timeEntries.filter(e => e.startedAt.startsWith(todayStr)),
    [timeEntries, todayStr]
  );
  const todayMs = todayEntries.reduce((s, e) => s + e.duration, 0);
  const todayTasksDone = tasks.filter(t => t.completed && t.date === todayStr).length;
  const todaySessions = todayEntries.length;
  const allTimeTasksDone = tasks.filter(t => t.completed).length;

  // ── Last-week entries ───────────────────────────────────────────────────────
  const lastWeekStart = subWeeks(weekStart, 1);
  const lastWeekEnd   = subWeeks(weekEnd,   1);
  const lastWeekEntries = useMemo(
    () => timeEntries.filter(e => {
      const d = parseISO(e.startedAt);
      return isWithinInterval(d, { start: lastWeekStart, end: lastWeekEnd });
    }),
    [timeEntries]
  );

  // ── Project completion rates ────────────────────────────────────────────────
  const projectCompletionRates = useMemo(() => {
    const rates: Record<string, { completed: number; total: number }> = {};
    projects.forEach(p => {
      const pt = tasks.filter(t => t.projectId === p.id);
      rates[p.id] = { completed: pt.filter(t => t.completed).length, total: pt.length };
    });
    return rates;
  }, [projects, tasks]);

  // ── Project week-over-week trends ───────────────────────────────────────────
  const projectTrends = useMemo(() => {
    return projects.map(p => {
      const taskIds = tasks.filter(t => t.projectId === p.id).map(t => t.id);
      const thisWeekMs = weekEntries.filter(e => taskIds.includes(e.taskId)).reduce((s, e) => s + e.duration, 0);
      const lastWeekMs = lastWeekEntries.filter(e => taskIds.includes(e.taskId)).reduce((s, e) => s + e.duration, 0);
      return { project: p, thisWeekMs, lastWeekMs };
    }).filter(x => x.thisWeekMs > 0 || x.lastWeekMs > 0);
  }, [projects, tasks, weekEntries, lastWeekEntries]);

  // ── All-time stats ──────────────────────────────────────────────────────────
  const allTimeStats = useMemo(() => {
    const totalMs       = timeEntries.reduce((s, e) => s + e.duration, 0);
    const totalSessions = timeEntries.length;
    const dayMap: Record<string, number> = {};
    timeEntries.forEach(e => {
      const d = e.startedAt.slice(0, 10);
      dayMap[d] = (dayMap[d] ?? 0) + e.duration;
    });
    const mostProductiveDay = Object.entries(dayMap).sort((a, b) => b[1] - a[1])[0] as [string, number] | undefined;
    const activeDays = [...new Set(timeEntries.map(e => e.startedAt.slice(0, 10)))].sort();
    let maxStreak = 0, curStreak = 0;
    let prevDate: Date | null = null;
    for (const d of activeDays) {
      const cur = new Date(d);
      if (prevDate) {
        const diffDays = Math.round((cur.getTime() - prevDate.getTime()) / 86400000);
        curStreak = diffDays === 1 ? curStreak + 1 : 1;
      } else {
        curStreak = 1;
      }
      maxStreak = Math.max(maxStreak, curStreak);
      prevDate = cur;
    }
    return { totalMs, totalSessions, mostProductiveDay, longestStreak: maxStreak };
  }, [timeEntries]);

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

  const exportBtnStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: '5px 8px',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    borderRadius: 5,
    border: '1px solid var(--border-1, #252525)',
    background: 'var(--bg-1, #0F0F0F)',
    color: 'var(--text-2, #686868)',
    cursor: 'pointer',
    fontFamily: 'Consolas, monospace',
  };

  const handleCopyMd = async () => {
    await copyMarkdownSummary(tasks, timeEntries, projects);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 16px', borderBottom: '1px solid var(--border-1, #252525)', flexShrink: 0, position: 'sticky', top: 0, background: 'var(--bg-0)', zIndex: 1 }}>
        {(['daily', 'weekly', 'alltime'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '5px 8px',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              borderRadius: 20,
              border: tab === t ? '1px solid var(--accent)' : '1px solid var(--border-1, #252525)',
              background: tab === t ? 'color-mix(in srgb, var(--accent) 20%, transparent)' : 'transparent',
              color: tab === t ? 'var(--accent)' : 'var(--text-2, #686868)',
              cursor: 'pointer',
              fontFamily: 'Consolas, monospace',
              transition: 'all 0.15s ease',
            }}>
            {t === 'daily' ? 'Daily' : t === 'weekly' ? 'Weekly' : 'All Time'}
          </button>
        ))}
      </div>

      {/* Stats Summary */}
      <div key={tab} style={section}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ ...sectionTitle, marginBottom: 0 }}>
            {tab === 'daily' ? 'Today' : tab === 'weekly' ? 'This Week' : 'All Time'}
          </span>
          {tab === 'weekly' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--text-2)' }}>Goal:</span>
              {editingGoal ? (
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  defaultValue={focusGoalMinutes / 60}
                  autoFocus
                  onBlur={(e) => { setFocusGoal(Math.round(parseFloat(e.target.value || '0') * 60)); setEditingGoal(false); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingGoal(false); }}
                  style={{ width: 44, fontSize: 10, fontFamily: 'Consolas, monospace', background: 'var(--bg-2)', border: '1px solid var(--border-1)', borderRadius: 4, color: 'var(--text-1)', padding: '1px 4px', outline: 'none' }}
                />
              ) : (
                <span
                  onClick={() => setEditingGoal(true)}
                  title="Click to edit daily focus goal"
                  style={{ fontSize: 10, color: 'var(--accent)', cursor: 'pointer', borderBottom: '1px dashed var(--accent)' }}
                >
                  {focusGoalMinutes > 0 ? `${focusGoalMinutes / 60}h` : 'set'}
                </span>
              )}
              <span style={{ fontSize: 10, color: 'var(--text-2)' }}>/day</span>
            </div>
          )}
        </div>
        <div style={statRow}>
          <div style={statBox}>
            <span style={statValue}>
              {(tab === 'daily' ? todayMs : tab === 'weekly' ? totalFocusMs : allTimeStats.totalMs) > 0
                ? fmtDuration(tab === 'daily' ? todayMs : tab === 'weekly' ? totalFocusMs : allTimeStats.totalMs)
                : '—'}
            </span>
            <span style={statLabel}>Focus</span>
          </div>
          <div style={statBox}>
            <span style={statValue}>
              <AnimatedNumber value={tab === 'daily' ? todayTasksDone : tab === 'weekly' ? tasksCompletedThisWeek : allTimeTasksDone} />
            </span>
            <span style={statLabel}>Done</span>
          </div>
          <div style={statBox}>
            <span style={statValue}>
              <AnimatedNumber value={tab === 'daily' ? todaySessions : tab === 'weekly' ? sessionsCompleted : allTimeStats.totalSessions} />
            </span>
            <span style={statLabel}>Sessions</span>
          </div>
        </div>
        {tab === 'weekly' && focusGoalMinutes > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-2)', marginBottom: 3 }}>
              <span>Today: {todayMs > 0 ? fmtDuration(todayMs) : '—'}</span>
              <span>{fmtDuration(focusGoalMinutes * 60000)} goal</span>
            </div>
            <div style={{ height: 3, borderRadius: 2, background: 'var(--bg-2)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 2,
                background: todayMs >= focusGoalMinutes * 60000 ? '#22c55e' : 'var(--accent)',
                width: `${Math.min(100, (todayMs / (focusGoalMinutes * 60000)) * 100)}%`,
                transition: 'width 0.3s',
              }} />
            </div>
          </div>
        )}
        {tab === 'alltime' && (
          <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={statBox}>
              <span style={{ ...statValue, fontSize: 14 }}>
                {allTimeStats.mostProductiveDay ? format(parseISO(allTimeStats.mostProductiveDay[0]), 'EEE d') : '—'}
              </span>
              <span style={statLabel}>Best day</span>
            </div>
            <div style={statBox}>
              <span style={{ ...statValue, fontSize: 14 }}>{allTimeStats.longestStreak > 0 ? `${allTimeStats.longestStreak}d` : '—'}</span>
              <span style={statLabel}>Best streak</span>
            </div>
          </div>
        )}
      </div>

      {/* Time per Project */}
      <div style={section}>
        <div style={sectionTitle}>Time per Project</div>
        {(tab === 'daily' ? dailyProjectTimes : projectTimes).length === 0 ? (
          <span style={{ fontSize: 11, color: 'var(--text-2, #686868)', fontStyle: 'italic' }}>No tracked time yet</span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(tab === 'daily' ? dailyProjectTimes : projectTimes).map(({ project, ms }) => {
              const maxMs = tab === 'daily' ? maxDailyProjectMs : maxProjectMs;
              return (
                <div key={project.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: project.color, flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ flex: 1, fontSize: 11, color: 'var(--text-1, #F0EDEA)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={project.name}>{project.name}</span>
                    {tab !== 'daily' && (() => {
                      const rate = projectCompletionRates[project.id];
                      if (!rate || rate.total === 0) return null;
                      const pct = Math.round((rate.completed / rate.total) * 100);
                      return (
                        <span style={{ fontSize: 9, color: project.color, background: project.color + '22', borderRadius: 10, padding: '1px 5px', flexShrink: 0, fontWeight: 700 }}>
                          {pct}%
                        </span>
                      );
                    })()}
                    <span style={{ fontSize: 11, color: 'var(--text-2, #686868)', flexShrink: 0 }}>{fmtDuration(ms)}</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-2, #191919)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      borderRadius: 2,
                      background: project.color,
                      width: `${Math.round((ms / maxMs) * 100)}%`,
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Project Trends - weekly only */}
      {tab === 'weekly' && projectTrends.length > 0 && (
        <div style={section}>
          <div style={sectionTitle}>Project Trends</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {projectTrends.map(({ project, thisWeekMs, lastWeekMs }) => {
              const maxMs = Math.max(thisWeekMs, lastWeekMs, 1);
              const diffMs = thisWeekMs - lastWeekMs;
              const diffLabel = diffMs === 0 ? '= same' : diffMs > 0 ? `↑ ${fmtDuration(Math.abs(diffMs))} more` : `↓ ${fmtDuration(Math.abs(diffMs))} less`;
              const diffColor = diffMs > 0 ? '#22c55e' : diffMs < 0 ? '#ef4444' : 'var(--text-2)';
              return (
                <div key={project.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: project.color, flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ flex: 1, fontSize: 11, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</span>
                    <span style={{ fontSize: 10, color: diffColor, flexShrink: 0 }}>{diffLabel}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 2, height: 6 }}>
                    <div style={{ flex: 1, background: 'var(--bg-2)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 2, background: project.color, opacity: 0.4, width: `${Math.round((lastWeekMs / maxMs) * 100)}%` }} />
                    </div>
                    <div style={{ flex: 1, background: 'var(--bg-2)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 2, background: project.color, width: `${Math.round((thisWeekMs / maxMs) * 100)}%` }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
                    <span style={{ flex: 1, fontSize: 8, color: 'var(--text-2)', opacity: 0.6 }}>Last week</span>
                    <span style={{ flex: 1, fontSize: 8, color: 'var(--text-2)' }}>This week</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Daily Streak Calendar - hidden for alltime tab */}
      {tab !== 'alltime' && (
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
      )}

      {/* 30-Day Focus Bar Chart - hidden for alltime tab */}
      {tab !== 'alltime' && (
        <div style={section}>
          <div style={sectionTitle}>30-Day Focus</div>
          <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, minWidth: thirtyDayBars.length * 10 }}>
              {thirtyDayBars.map(({ dateStr, totalMin, isToday, isMonday, tooltip }) => {
                const barH = totalMin === 0 ? 2 : Math.max(3, Math.round((totalMin / maxDayMin) * 60));
                return (
                  <div key={dateStr} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div
                      title={tooltip}
                      style={{
                        width: 8,
                        height: barH,
                        borderRadius: 2,
                        background: totalMin === 0 ? 'var(--bg-2)' : 'var(--accent)',
                        opacity: totalMin === 0 ? 1 : isToday ? 1 : 0.6,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 7, color: 'var(--text-2)', lineHeight: 1, visibility: isMonday ? 'visible' : 'hidden' }}>M</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Hour-of-Day Heatmap - hidden for alltime tab */}
      {tab !== 'alltime' && (
        <div style={section}>
          <div style={sectionTitle}>Peak Hours</div>
          <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 2, minWidth: 24 * 22 }}>
              {hourHeatmap.map(({ hour, intensity, showLabel, label, tooltip }) => (
                <div key={hour} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <div
                    title={tooltip}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 3,
                      background: intensity === 0 ? 'var(--bg-2)' : 'var(--accent)',
                      opacity: intensity === 0 ? 1 : Math.max(0.15, intensity),
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 7, color: 'var(--text-2)', lineHeight: 1, visibility: showLabel ? 'visible' : 'hidden' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Session Length Distribution - hidden for alltime tab */}
      {tab !== 'alltime' && (
        <div style={section}>
          <div style={sectionTitle}>Session Lengths</div>
          {timeEntries.length === 0 ? (
            <span style={{ fontSize: 11, color: 'var(--text-2)', fontStyle: 'italic' }}>No tracked time yet</span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sessionLengths.map(({ label, count, pct, color }) => (
                <div key={label}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-1)', width: 46, flexShrink: 0 }}>{label}</span>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--bg-2)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 2, background: color, width: `${Math.round(pct * 100)}%`, transition: 'width 0.3s ease' }} />
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-2)', flexShrink: 0, width: 58, textAlign: 'right' }}>{count} session{count !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Top Tasks */}
      <div style={{ ...section, borderBottom: 'none' }}>
        <div style={sectionTitle}>Top Tasks by Time</div>
        {(tab === 'daily' ? dailyTopTasks : topTasks).length === 0 ? (
          <span style={{ fontSize: 11, color: 'var(--text-2, #686868)', fontStyle: 'italic' }}>No tracked time yet</span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(tab === 'daily' ? dailyTopTasks : topTasks).map(({ task, ms }, idx) => (
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

      {/* Export Toolbar */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-1, #252525)', display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          onClick={() => exportTimeLogCSV(tasks, timeEntries, projects)}
          style={exportBtnStyle}
          title="Export CSV">
          <Download size={11} />
          <span>CSV</span>
        </button>
        <button
          onClick={() => exportTimeLogJSON(tasks, timeEntries, projects)}
          style={exportBtnStyle}
          title="Export JSON">
          <FileJson size={11} />
          <span>JSON</span>
        </button>
        <button
          onClick={handleCopyMd}
          style={{ ...exportBtnStyle, ...(copied ? { color: 'var(--accent)', borderColor: 'var(--accent)' } : {}) }}
          title="Copy Markdown Summary">
          <Copy size={11} />
          <span>{copied ? 'Copied!' : 'Copy MD'}</span>
        </button>
      </div>
    </div>
  );
}
