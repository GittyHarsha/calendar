import React, { useMemo, useState, useEffect } from 'react';
import { useStore, fmtDuration } from '../store';
import { startOfWeek, endOfWeek, subWeeks, format, parseISO, isWithinInterval, differenceInDays } from 'date-fns';
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

  // ── Today's focus (must come before any useMemo that references todayEntries) ─
  const todayStr = format(today, 'yyyy-MM-dd');
  const todayEntries = useMemo(
    () => timeEntries.filter(e => e.startedAt.startsWith(todayStr)),
    [timeEntries, todayStr]
  );
  const todayMs = todayEntries.reduce((s, e) => s + e.duration, 0);
  const todayTasksDone = tasks.filter(t => t.completed && t.date === todayStr).length;
  const todaySessions = todayEntries.length;
  const allTimeTasksDone = tasks.filter(t => t.completed).length;

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

  // ── Daily Streak / 30-Day / Heatmap / Session Lengths removed ──────────────

  // ── Top Tasks ───────────────────────────────────────────────────────────────
  const topTasks = useMemo(() => {
    const taskTimes = tasks.map(t => {
      const ms = timeEntries.filter(e => e.taskId === t.id).reduce((s, e) => s + e.duration, 0);
      return { task: t, ms };
    }).filter(x => x.ms > 0).sort((a, b) => b.ms - a.ms).slice(0, 5);
    return taskTimes;
  }, [tasks, timeEntries]);

  // ── Deadline: Per-Task Timeline Data ────────────────────────────────────────
  const taskDeadlineTimelines = useMemo(() => {
    const todayStr2 = format(today, 'yyyy-MM-dd');
    return tasks
      .filter(t => t.deadline || (t.deadlineHistory && t.deadlineHistory.length > 0))
      .map(t => {
        const allDeadlines: string[] = [...(t.deadlineHistory ?? []), ...(t.deadline ? [t.deadline] : [])];
        const original = allDeadlines[0];
        const current = t.deadline ?? allDeadlines[allDeadlines.length - 1];
        const totalSlip = original && current ? differenceInDays(parseISO(current), parseISO(original)) : 0;
        const isOverdue = !t.completed && current && current < todayStr2;
        const status: 'done' | 'overdue' | 'active' = t.completed ? 'done' : isOverdue ? 'overdue' : 'active';
        const project = projects.find(p => p.id === t.projectId);
        return { task: t, allDeadlines, original, current, totalSlip, status, project };
      })
      .sort((a, b) => {
        // Sort: overdue first, then by slip desc, then active, then done
        if (a.status === 'overdue' && b.status !== 'overdue') return -1;
        if (b.status === 'overdue' && a.status !== 'overdue') return 1;
        return b.totalSlip - a.totalSlip;
      });
  }, [tasks, projects, today]);

  // ── Deadline: On-Time Delivery Ring ─────────────────────────────────────────
  const onTimeStats = useMemo(() => {
    const completedWithDeadline = tasks.filter(t => t.completed && t.deadline);
    const onTime = completedWithDeadline.filter(t => {
      // completed on time = date <= deadline (use task.date as completion proxy)
      return t.date && t.date <= t.deadline!;
    });
    const late = completedWithDeadline.length - onTime.length;
    const noDeadline = tasks.filter(t => t.completed && !t.deadline).length;
    const total = completedWithDeadline.length;
    const onTimePct = total > 0 ? Math.round((onTime.length / total) * 100) : 0;
    return { onTime: onTime.length, late, noDeadline, total, onTimePct };
  }, [tasks]);

  // ── Deadline: Project Health ─────────────────────────────────────────────────
  const projectDeadlineHealth = useMemo(() => {
    return projects.map(p => {
      const pts = tasks.filter(t => t.projectId === p.id && t.deadline);
      const todayStr2 = format(today, 'yyyy-MM-dd');
      const onTime = pts.filter(t => t.completed && t.date && t.date <= t.deadline!).length;
      const late = pts.filter(t => t.completed && (!t.date || t.date > t.deadline!)).length;
      const overdue = pts.filter(t => !t.completed && t.deadline! < todayStr2).length;
      const active = pts.filter(t => !t.completed && t.deadline! >= todayStr2).length;
      const slipped = pts.filter(t => t.deadlineHistory && t.deadlineHistory.length > 0);
      const avgSlip = slipped.length > 0
        ? Math.round(slipped.reduce((s, t) => s + differenceInDays(parseISO(t.deadline!), parseISO(t.deadlineHistory![0])), 0) / slipped.length)
        : 0;
      return { project: p, onTime, late, overdue, active, total: pts.length, avgSlip };
    }).filter(x => x.total > 0);
  }, [projects, tasks, today]);

  // ── Deadline: Velocity Trend (weekly slip count, last 8 weeks) ──────────────
  const deadlineVelocity = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => {
      const wStart = startOfWeek(subWeeks(today, 7 - i), { weekStartsOn: 1 });
      const wEnd = endOfWeek(subWeeks(today, 7 - i), { weekStartsOn: 1 });
      const wStartStr = format(wStart, 'yyyy-MM-dd');
      const wEndStr = format(wEnd, 'yyyy-MM-dd');
      const label = format(wStart, 'MMM d');
      // Count deadline changes that happened in this week window
      // We approximate: tasks whose deadline was changed (has history) and current deadline falls in this week
      const count = tasks.filter(t =>
        t.deadlineHistory && t.deadlineHistory.length > 0 &&
        t.deadline && t.deadline >= wStartStr && t.deadline <= wEndStr
      ).length;
      return { label, count, isCurrentWeek: i === 7 };
    });
  }, [tasks, today]);

  const maxVelocityCount = Math.max(...deadlineVelocity.map(w => w.count), 1);

  // ── Deadline Health ─────────────────────────────────────────────────────────
  const deadlineStats = useMemo(() => {
    const tasksWithDeadline = tasks.filter(t => t.deadline);
    const slippedTasks = tasksWithDeadline.filter(t => t.deadlineHistory && t.deadlineHistory.length > 0);
    const slipRate = tasksWithDeadline.length > 0 ? slippedTasks.length / tasksWithDeadline.length : 0;
    const slipDetails = slippedTasks.map(t => {
      const original = parseISO(t.deadlineHistory![0]);
      const current = parseISO(t.deadline!);
      const daysSlipped = differenceInDays(current, original);
      return { task: t, daysSlipped };
    }).sort((a, b) => b.daysSlipped - a.daysSlipped);
    const avgDaysSlipped = slipDetails.length > 0
      ? Math.round(slipDetails.reduce((s, x) => s + x.daysSlipped, 0) / slipDetails.length)
      : 0;
    const buckets = [
      { label: '1–3d', min: 1, max: 3 },
      { label: '4–7d', min: 4, max: 7 },
      { label: '8–14d', min: 8, max: 14 },
      { label: '15d+', min: 15, max: Infinity },
    ].map(b => ({ ...b, count: slipDetails.filter(x => x.daysSlipped >= b.min && x.daysSlipped <= b.max).length }));
    return { tasksWithDeadline, slippedTasks, slipRate, slipDetails: slipDetails.slice(0, 5), avgDaysSlipped, buckets };
  }, [tasks]);

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
    inset: 0,
    background: 'var(--bg-0)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 50,
    fontFamily: 'Consolas, monospace',
    overflowY: 'auto',
  };

  const header: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 40px',
    borderBottom: '1px solid var(--border-1, #252525)',
    flexShrink: 0,
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--text-2, #686868)',
    marginBottom: 14,
  };

  const section: React.CSSProperties = {
    padding: '28px 40px',
    borderBottom: '1px solid var(--border-1, #252525)',
  };

  const statRow: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 16,
  };

  const statBox: React.CSSProperties = {
    background: 'var(--bg-1, #0F0F0F)',
    borderRadius: 10,
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  };

  const statValue: React.CSSProperties = {
    fontSize: 36,
    fontWeight: 900,
    color: 'var(--accent)',
    lineHeight: 1,
  };

  const statLabel: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--text-2, #686868)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  };

  const exportBtnStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '10px 16px',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    borderRadius: 6,
    border: '1px solid var(--border-1, #252525)',
    background: 'var(--bg-1, #0F0F0F)',
    color: 'var(--text-2, #686868)',
    cursor: 'pointer',
    fontFamily: 'Consolas, monospace',
    transition: 'background 0.15s, color 0.15s',
  };

  const exportBtnHover = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = 'var(--bg-2, #1A1A1A)';
    e.currentTarget.style.color = 'var(--text-1, #F0EDEA)';
  };
  const exportBtnLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = 'var(--bg-1, #0F0F0F)';
    e.currentTarget.style.color = 'var(--text-2, #686868)';
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
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1, #F0EDEA)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Time Analytics
        </span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2, #686868)', padding: 6, display: 'flex', alignItems: 'center' }}
          title="Close">
          <X size={22} />
        </button>
      </div>

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: 8, padding: '16px 40px', borderBottom: '1px solid var(--border-1, #252525)', flexShrink: 0, position: 'sticky', top: 0, background: 'var(--bg-0)', zIndex: 1 }}>
        {(['daily', 'weekly', 'alltime'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '10px 16px',
              fontSize: 13,
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

      {/* Global empty state */}
      {timeEntries.length === 0 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-2)', padding: 40, textAlign: 'center' }}>
          <span style={{ fontSize: 32, color: 'var(--accent)' }}>◉</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '0.05em' }}>No data yet</span>
          <span style={{ fontSize: 13, maxWidth: 260, lineHeight: 1.6 }}>Start a focus session on any task to begin tracking your time.</span>
        </div>
      )}

      {/* Main content — 2-column grid */}
      {timeEntries.length > 0 && (
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridAutoRows: 'min-content', overflow: 'auto' }}>

      {/* Stats Summary */}
      <div key={tab} style={{ ...section, gridColumn: '1 / -1' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ ...sectionTitle, marginBottom: 0 }}>
            {tab === 'daily' ? 'Today' : tab === 'weekly' ? 'This Week' : 'All Time'}
          </span>
          {tab === 'weekly' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Goal:</span>
              {editingGoal ? (
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  defaultValue={focusGoalMinutes / 60}
                  autoFocus
                  onBlur={(e) => { setFocusGoal(Math.round(parseFloat(e.target.value || '0') * 60)); setEditingGoal(false); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingGoal(false); }}
                  style={{ width: 60, fontSize: 13, fontFamily: 'Consolas, monospace', background: 'var(--bg-2)', border: '1px solid var(--border-1)', borderRadius: 4, color: 'var(--text-1)', padding: '2px 6px', outline: 'none' }}
                />
              ) : (
                <span
                  onClick={() => setEditingGoal(true)}
                  title="Click to edit daily focus goal"
                  style={{ fontSize: 13, color: 'var(--accent)', cursor: 'pointer', borderBottom: '1px dashed var(--accent)' }}
                >
                  {focusGoalMinutes > 0 ? `${focusGoalMinutes / 60}h` : 'set'}
                </span>
              )}
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>/day</span>
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
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-2)', marginBottom: 6 }}>
              <span>Today: {todayMs > 0 ? fmtDuration(todayMs) : '—'}</span>
              <span>{fmtDuration(focusGoalMinutes * 60000)} goal</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: 'var(--bg-2)', overflow: 'hidden' }}>
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
              <span style={{ ...statValue, fontSize: 22 }}>
                {allTimeStats.mostProductiveDay ? format(parseISO(allTimeStats.mostProductiveDay[0]), 'EEE d') : '—'}
              </span>
              <span style={statLabel}>Best day</span>
            </div>
            <div style={statBox}>
              <span style={{ ...statValue, fontSize: 22 }}>{allTimeStats.longestStreak > 0 ? `${allTimeStats.longestStreak}d` : '—'}</span>
              <span style={statLabel}>Best streak</span>
            </div>
          </div>
        )}
      </div>

      {/* Time per Project */}
      <div style={section}>
        <div style={sectionTitle}>Time per Project</div>
        {(tab === 'daily' ? dailyProjectTimes : projectTimes).length === 0 ? (
          <span style={{ fontSize: 14, color: 'var(--text-2, #686868)', fontStyle: 'italic' }}>No tracked time yet</span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(tab === 'daily' ? dailyProjectTimes : projectTimes).map(({ project, ms }) => {
              const maxMs = tab === 'daily' ? maxDailyProjectMs : maxProjectMs;
              return (
                <div key={project.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, minWidth: 0 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: project.color, flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ flex: 1, fontSize: 14, color: 'var(--text-1, #F0EDEA)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}
                      title={project.name}>{project.name}</span>
                    {tab !== 'daily' && (() => {
                      const rate = projectCompletionRates[project.id];
                      if (!rate || rate.total === 0) return null;
                      const pct = Math.round((rate.completed / rate.total) * 100);
                      return (
                        <span style={{ fontSize: 12, color: project.color, background: project.color + '22', borderRadius: 10, padding: '2px 8px', flexShrink: 0, fontWeight: 700 }}>
                          {pct}%
                        </span>
                      );
                    })()}
                    <span style={{ fontSize: 14, color: 'var(--text-2, #686868)', flexShrink: 0 }}>{fmtDuration(ms)}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-2, #191919)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      borderRadius: 3,
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {projectTrends.map(({ project, thisWeekMs, lastWeekMs }) => {
              const maxMs = Math.max(thisWeekMs, lastWeekMs, 1);
              const diffMs = thisWeekMs - lastWeekMs;
              const diffLabel = diffMs === 0 ? '= same' : diffMs > 0 ? `↑ ${fmtDuration(Math.abs(diffMs))} more` : `↓ ${fmtDuration(Math.abs(diffMs))} less`;
              const diffColor = diffMs > 0 ? '#22c55e' : diffMs < 0 ? '#ef4444' : 'var(--text-2)';
              return (
                <div key={project.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: project.color, flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ flex: 1, fontSize: 14, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</span>
                    <span style={{ fontSize: 13, color: diffColor, flexShrink: 0 }}>{diffLabel}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 3, height: 8 }}>
                    <div style={{ flex: 1, background: 'var(--bg-2)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 3, background: project.color, opacity: 0.4, width: `${Math.round((lastWeekMs / maxMs) * 100)}%` }} />
                    </div>
                    <div style={{ flex: 1, background: 'var(--bg-2)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 3, background: project.color, width: `${Math.round((thisWeekMs / maxMs) * 100)}%` }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
                    <span style={{ flex: 1, fontSize: 11, color: 'var(--text-2)', opacity: 0.6 }}>Last week</span>
                    <span style={{ flex: 1, fontSize: 11, color: 'var(--text-2)' }}>This week</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Tasks */}
      <div style={section}>
        <div style={sectionTitle}>Top Tasks by Time</div>
        {(tab === 'daily' ? dailyTopTasks : topTasks).length === 0 ? (
          <span style={{ fontSize: 14, color: 'var(--text-2, #686868)', fontStyle: 'italic' }}>No tracked time yet</span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(tab === 'daily' ? dailyTopTasks : topTasks).map(({ task, ms }, idx) => (
              <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--text-2, #686868)', width: 18, flexShrink: 0, textAlign: 'right' }}>{idx + 1}.</span>
                <span style={{ flex: 1, fontSize: 14, color: 'var(--text-1, #F0EDEA)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={task.title}>{task.title}</span>
                <span style={{ fontSize: 14, color: 'var(--accent)', flexShrink: 0, fontWeight: 700 }}>{fmtDuration(ms)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── DEADLINE ANALYSIS ── spans full grid width ─────────────────────── */}

      {/* 1. On-Time Delivery Ring */}
      {tab !== 'daily' && onTimeStats.total > 0 && (
        <div style={{ ...section, gridColumn: '1 / -1' }}>
          <div style={sectionTitle}>On-Time Delivery</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
            {/* SVG Ring */}
            <div style={{ flexShrink: 0 }}>
              <svg width={120} height={120} viewBox="0 0 120 120">
                <circle cx={60} cy={60} r={48} fill="none" stroke="var(--bg-2)" strokeWidth={12} />
                <circle cx={60} cy={60} r={48} fill="none"
                  stroke="#22c55e" strokeWidth={12}
                  strokeDasharray={`${2 * Math.PI * 48 * onTimeStats.onTimePct / 100} ${2 * Math.PI * 48}`}
                  strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                  style={{ transition: 'stroke-dasharray 0.8s ease' }}
                />
                <circle cx={60} cy={60} r={48} fill="none"
                  stroke="#ef4444" strokeWidth={12}
                  strokeDasharray={`${2 * Math.PI * 48 * onTimeStats.late / onTimeStats.total} ${2 * Math.PI * 48}`}
                  strokeLinecap="round"
                  strokeDashoffset={-(2 * Math.PI * 48 * onTimeStats.onTimePct / 100)}
                  transform="rotate(-90 60 60)"
                  style={{ transition: 'stroke-dasharray 0.8s ease' }}
                />
                <text x={60} y={55} textAnchor="middle" fill="var(--accent)" fontSize={22} fontWeight={900} fontFamily="Consolas,monospace">{onTimeStats.onTimePct}%</text>
                <text x={60} y={72} textAnchor="middle" fill="var(--text-2)" fontSize={10} fontFamily="Consolas,monospace">on time</text>
              </svg>
            </div>
            {/* Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: '#22c55e', flexShrink: 0, display: 'inline-block' }} />
                <span style={{ fontSize: 14, color: 'var(--text-1)' }}>On time</span>
                <span style={{ fontSize: 20, fontWeight: 900, color: '#22c55e', marginLeft: 8 }}>{onTimeStats.onTime}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: '#ef4444', flexShrink: 0, display: 'inline-block' }} />
                <span style={{ fontSize: 14, color: 'var(--text-1)' }}>Late</span>
                <span style={{ fontSize: 20, fontWeight: 900, color: '#ef4444', marginLeft: 8 }}>{onTimeStats.late}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--bg-2)', flexShrink: 0, display: 'inline-block' }} />
                <span style={{ fontSize: 14, color: 'var(--text-2)' }}>No deadline</span>
                <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-2)', marginLeft: 8 }}>{onTimeStats.noDeadline}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Per-Task Deadline Timeline */}
      {tab !== 'daily' && taskDeadlineTimelines.length > 0 && (
        <div style={{ ...section, gridColumn: '1 / -1' }}>
          <div style={sectionTitle}>Task Deadline Timelines</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {taskDeadlineTimelines.slice(0, 12).map(({ task, allDeadlines, original, current, totalSlip, status, project }) => {
              const statusColor = status === 'done' ? '#22c55e' : status === 'overdue' ? '#ef4444' : 'var(--accent)';
              const statusLabel = status === 'done' ? '✓ Done' : status === 'overdue' ? '⚠ Overdue' : '● Active';
              const slipColor = totalSlip <= 0 ? '#22c55e' : totalSlip <= 3 ? '#f97316' : '#ef4444';
              return (
                <div key={task.id} style={{ background: 'var(--bg-1)', borderRadius: 10, padding: '16px 20px', borderLeft: `3px solid ${statusColor}` }}>
                  {/* Task header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    {project && <span style={{ width: 8, height: 8, borderRadius: '50%', background: project.color, flexShrink: 0, display: 'inline-block' }} />}
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={task.title}>{task.title}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: statusColor, background: statusColor + '18', borderRadius: 20, padding: '2px 10px', flexShrink: 0 }}>{statusLabel}</span>
                    {totalSlip > 0 && (
                      <span style={{ fontSize: 13, fontWeight: 700, color: slipColor, background: slipColor + '18', borderRadius: 6, padding: '2px 8px', flexShrink: 0 }}>+{totalSlip}d</span>
                    )}
                  </div>
                  {/* Timeline dots */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', paddingBottom: 4 }}>
                    {task.startDate && (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--text-2)', border: '2px solid var(--bg-2)' }} />
                          <span style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 4, whiteSpace: 'nowrap' }}>Started</span>
                          <span style={{ fontSize: 11, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{format(parseISO(task.startDate), 'MMM d')}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 24, height: 2, background: 'var(--bg-2)', alignSelf: 'flex-start', marginTop: 4 }} />
                      </>
                    )}
                    {allDeadlines.map((dl, i) => {
                      const isLast = i === allDeadlines.length - 1;
                      const slipFromPrev = i > 0 ? differenceInDays(parseISO(dl), parseISO(allDeadlines[i - 1])) : 0;
                      const dotColor = isLast ? statusColor : '#f97316';
                      return (
                        <React.Fragment key={dl + i}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                            <div style={{ width: isLast ? 14 : 10, height: isLast ? 14 : 10, borderRadius: '50%', background: dotColor, border: `2px solid ${dotColor}33`, flexShrink: 0 }} />
                            {i > 0 && slipFromPrev > 0 && (
                              <span style={{ fontSize: 10, color: '#f97316', marginTop: 2, whiteSpace: 'nowrap' }}>+{slipFromPrev}d</span>
                            )}
                            {i > 0 && slipFromPrev <= 0 && <span style={{ fontSize: 10, color: 'transparent', marginTop: 2 }}>·</span>}
                            {i === 0 && <span style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 2, whiteSpace: 'nowrap' }}>Original</span>}
                            {isLast && i > 0 && <span style={{ fontSize: 10, color: statusColor, marginTop: 2, whiteSpace: 'nowrap' }}>Current</span>}
                            <span style={{ fontSize: 11, color: isLast ? 'var(--text-1)' : 'var(--text-2)', whiteSpace: 'nowrap', fontWeight: isLast ? 700 : 400 }}>{format(parseISO(dl), 'MMM d')}</span>
                          </div>
                          {!isLast && <div style={{ flex: 1, minWidth: 20, height: 2, background: '#f9731644', alignSelf: 'flex-start', marginTop: 4 }} />}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {taskDeadlineTimelines.length > 12 && (
              <span style={{ fontSize: 13, color: 'var(--text-2)', fontStyle: 'italic' }}>+{taskDeadlineTimelines.length - 12} more tasks…</span>
            )}
          </div>
        </div>
      )}

      {/* 3. Project Deadline Health */}
      {tab !== 'daily' && projectDeadlineHealth.length > 0 && (
        <div style={{ ...section, gridColumn: '1 / -1' }}>
          <div style={sectionTitle}>Project Deadline Health</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {projectDeadlineHealth.map(({ project, onTime, late, overdue, active, total, avgSlip }) => (
              <div key={project.id} style={{ background: 'var(--bg-1)', borderRadius: 10, padding: '14px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: project.color, flexShrink: 0, display: 'inline-block' }} />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</span>
                  {avgSlip > 0 && <span style={{ fontSize: 12, color: '#f97316', fontWeight: 700 }}>avg +{avgSlip}d slip</span>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {onTime > 0 && <span style={{ fontSize: 12, color: '#22c55e', background: 'rgba(34,197,94,0.12)', borderRadius: 20, padding: '3px 10px', fontWeight: 700 }}>✓ {onTime} on time</span>}
                  {late > 0 && <span style={{ fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,0.12)', borderRadius: 20, padding: '3px 10px', fontWeight: 700 }}>✗ {late} late</span>}
                  {overdue > 0 && <span style={{ fontSize: 12, color: '#f97316', background: 'rgba(249,115,22,0.12)', borderRadius: 20, padding: '3px 10px', fontWeight: 700 }}>⚠ {overdue} overdue</span>}
                  {active > 0 && <span style={{ fontSize: 12, color: 'var(--accent)', background: 'var(--accent)18', borderRadius: 20, padding: '3px 10px', fontWeight: 700 }}>● {active} active</span>}
                </div>
                {/* Mini bar: on-time | late | overdue | active */}
                <div style={{ display: 'flex', gap: 2, height: 5, marginTop: 10, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ flex: onTime, background: '#22c55e' }} />
                  <div style={{ flex: late, background: '#ef4444' }} />
                  <div style={{ flex: overdue, background: '#f97316' }} />
                  <div style={{ flex: active, background: 'var(--accent)', opacity: 0.5 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Deadline Velocity Trend */}
      {tab !== 'daily' && deadlineVelocity.some(w => w.count > 0) && (
        <div style={{ ...section, gridColumn: '1 / -1', borderBottom: 'none' }}>
          <div style={sectionTitle}>Deadline Extension Trend (8 weeks)</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            {deadlineVelocity.map(({ label, count, isCurrentWeek }) => {
              const barH = count === 0 ? 4 : Math.max(8, Math.round((count / maxVelocityCount) * 80));
              return (
                <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{count > 0 ? count : ''}</span>
                  <div style={{
                    width: '100%', height: barH, borderRadius: 4,
                    background: count === 0 ? 'var(--bg-2)' : isCurrentWeek ? 'var(--accent)' : '#f97316',
                    opacity: count === 0 ? 0.4 : 1,
                    transition: 'height 0.3s ease',
                  }} />
                  <span style={{ fontSize: 11, color: isCurrentWeek ? 'var(--accent)' : 'var(--text-2)', textAlign: 'center' }}>{label}</span>
                </div>
              );
            })}
          </div>
          {(() => {
            const firstHalf = deadlineVelocity.slice(0, 4).reduce((s, w) => s + w.count, 0);
            const secondHalf = deadlineVelocity.slice(4).reduce((s, w) => s + w.count, 0);
            const trend = secondHalf > firstHalf ? '↑ More extensions lately' : secondHalf < firstHalf ? '↓ Fewer extensions lately' : '= Stable';
            const trendColor = secondHalf > firstHalf ? '#ef4444' : secondHalf < firstHalf ? '#22c55e' : 'var(--text-2)';
            return <div style={{ marginTop: 12, fontSize: 13, color: trendColor, fontWeight: 700 }}>{trend}</div>;
          })()}
        </div>
      )}

      </div>
      )}

      {/* Export Toolbar */}
      <div style={{ padding: '16px 40px', borderTop: '1px solid var(--border-1, #252525)', display: 'flex', gap: 10, flexShrink: 0 }}>
        <button
          onClick={() => exportTimeLogCSV(tasks, timeEntries, projects)}
          style={exportBtnStyle}
          onMouseEnter={exportBtnHover} onMouseLeave={exportBtnLeave}
          title="Export CSV">
          <Download size={14} />
          <span>CSV</span>
        </button>
        <button
          onClick={() => exportTimeLogJSON(tasks, timeEntries, projects)}
          style={exportBtnStyle}
          onMouseEnter={exportBtnHover} onMouseLeave={exportBtnLeave}
          title="Export JSON">
          <FileJson size={14} />
          <span>JSON</span>
        </button>
        <button
          onClick={handleCopyMd}
          style={{ ...exportBtnStyle, ...(copied ? { color: 'var(--accent)', borderColor: 'var(--accent)' } : {}) }}
          onMouseEnter={e => !copied && exportBtnHover(e)} onMouseLeave={e => !copied && exportBtnLeave(e)}
          title="Copy Markdown Summary">
          <Copy size={14} />
          <span>{copied ? 'Copied!' : 'Copy MD'}</span>
        </button>
      </div>
    </div>
  );
}
