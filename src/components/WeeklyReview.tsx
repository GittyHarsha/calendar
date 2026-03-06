import React, { useState } from 'react';
import { useStore, fmtDuration } from '../store';
import { format, startOfToday, startOfWeek, endOfWeek, parseISO, differenceInDays } from 'date-fns';
import { X, CheckCircle2, Clock } from 'lucide-react';

export function WeeklyReview({ onClose }: { onClose: () => void }) {
  const { tasks, projects, timeEntries, weeklyIntention, setWeeklyIntention } = useStore();
  const today = startOfToday();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd   = endOfWeek(today,   { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr   = format(weekEnd,   'yyyy-MM-dd');

  const [intentionEdit, setIntentionEdit] = useState(weeklyIntention ?? '');

  const completedThisWeek = tasks.filter(t => t.completed && t.date && t.date >= weekStartStr && t.date <= weekEndStr);
  const pendingThisWeek   = tasks.filter(t => !t.completed && t.date && t.date >= weekStartStr && t.date <= weekEndStr);
  const overdue           = tasks.filter(t => !t.completed && t.date && t.date < weekStartStr);

  const weekTimeMs = timeEntries
    .filter(e => { const d = e.startedAt.split('T')[0]; return d >= weekStartStr && d <= weekEndStr; })
    .reduce((s, e) => s + e.duration, 0);

  const projectStats = projects
    .filter(p => !p.parentId)
    .map(p => {
      const done    = completedThisWeek.filter(t => t.projectId === p.id).length;
      const pending = pendingThisWeek.filter(t => t.projectId === p.id).length;
      return { p, done, pending };
    })
    .filter(ps => ps.done + ps.pending > 0)
    .sort((a, b) => b.done + b.pending - (a.done + a.pending));

  const stat = (label: string, value: React.ReactNode, color: string) => (
    <div style={{ padding: '12px 16px', borderRight: '1px solid #1E1E1E' }}>
      <div style={{ fontSize: 26, fontWeight: 900, fontFamily: 'system-ui', color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>{label}</div>
    </div>
  );

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg-1)', border: '1px solid #252525', borderRadius: '1rem', width: 560, maxWidth: '92vw', maxHeight: '84vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.7)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #1E1E1E', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#F0EFEB', fontFamily: 'system-ui' }}>
              Week of {format(weekStart, 'MMM d')}
            </div>
            <div style={{ fontSize: 11, color: '#444', fontFamily: 'system-ui', marginTop: 3 }}>
              {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')} · Weekly Review
            </div>
          </div>
          <button onClick={onClose} style={{ color: '#555', background: 'none', border: 'none', cursor: 'pointer', padding: 4, marginTop: -2 }}><X size={18} /></button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid #1E1E1E' }}>
          {stat('Completed', completedThisWeek.length, '#22c55e')}
          {stat('Pending', pendingThisWeek.length, pendingThisWeek.length > 0 ? 'var(--accent)' : '#333')}
          {stat('Overdue', overdue.length, overdue.length > 0 ? '#ef4444' : '#333')}
          {stat('Tracked', weekTimeMs > 0 ? fmtDuration(weekTimeMs) : '—', '#3B82F6')}
        </div>

        {/* Content */}
        <div style={{ overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Weekly intention */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#444', marginBottom: 8 }}>Weekly intention</div>
            <textarea
              value={intentionEdit}
              onChange={e => setIntentionEdit(e.target.value)}
              onBlur={() => setWeeklyIntention(intentionEdit)}
              placeholder="What does a great week look like?"
              rows={2}
              style={{ width: '100%', background: '#0D0D0D', border: '1px solid #252525', borderRadius: 6, padding: '8px 10px', color: '#C8C7C4', fontSize: 13, fontFamily: 'system-ui', resize: 'none', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Per-project breakdown */}
          {projectStats.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#444', marginBottom: 8 }}>Goals progress</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {projectStats.map(({ p, done, pending }) => {
                  const total = done + pending;
                  const pct = total > 0 ? done / total : 0;
                  const barColor = pct === 1 ? '#22c55e' : pct > 0.5 ? 'var(--accent)' : '#eab308';
                  return (
                    <div key={p.id} style={{ padding: '8px 12px', borderRadius: 8, background: p.color + '0D', border: `1px solid ${p.color}25` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#C8C7C4' }}>{p.name}</span>
                        </div>
                        <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#555' }}>{done}/{total}</span>
                      </div>
                      <div style={{ height: 3, background: '#1A1A1A', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${pct * 100}%`, background: barColor, borderRadius: 2, transition: 'width 0.4s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Completed tasks */}
          {completedThisWeek.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#444', marginBottom: 8 }}>
                Completed this week · {completedThisWeek.length}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {completedThisWeek.slice(0, 10).map(t => {
                  const p = projects.find(pr => pr.id === t.projectId);
                  return (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderRadius: 6, background: '#0D0D0D', border: '1px solid #1A1A1A' }}>
                      <CheckCircle2 size={11} style={{ color: '#22c55e', flexShrink: 0 }} />
                      {p && <div style={{ width: 5, height: 5, borderRadius: '50%', background: p.color, flexShrink: 0 }} />}
                      <span style={{ flex: 1, fontSize: 12, color: '#666', textDecoration: 'line-through', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                    </div>
                  );
                })}
                {completedThisWeek.length > 10 && (
                  <div style={{ fontSize: 11, color: '#555', paddingLeft: 10 }}>+{completedThisWeek.length - 10} more</div>
                )}
              </div>
            </div>
          )}

          {/* Pending / still to do */}
          {pendingThisWeek.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#444', marginBottom: 8 }}>
                Still pending this week · {pendingThisWeek.length}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {pendingThisWeek.slice(0, 8).map(t => {
                  const p = projects.find(pr => pr.id === t.projectId);
                  const dl = t.deadline ? differenceInDays(parseISO(t.deadline), today) : null;
                  const dlColor = dl !== null ? (dl < 0 ? '#ef4444' : dl <= 2 ? '#f97316' : '#eab308') : undefined;
                  return (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderRadius: 6, background: '#0D0D0D', border: '1px solid #1A1A1A' }}>
                      {p && <div style={{ width: 5, height: 5, borderRadius: '50%', background: p.color, flexShrink: 0 }} />}
                      <span style={{ flex: 1, fontSize: 12, color: '#C8C7C4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                      {dl !== null && dl <= 5 && <span style={{ fontSize: 10, fontFamily: 'monospace', color: dlColor, flexShrink: 0 }}>{dl < 0 ? `${Math.abs(dl)}d over` : dl === 0 ? 'today' : `${dl}d`}</span>}
                    </div>
                  );
                })}
                {pendingThisWeek.length > 8 && (
                  <div style={{ fontSize: 11, color: '#555', paddingLeft: 10 }}>+{pendingThisWeek.length - 8} more</div>
                )}
              </div>
            </div>
          )}

          {completedThisWeek.length === 0 && pendingThisWeek.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#555', fontSize: 14, fontFamily: 'system-ui' }}>
              No tasks scheduled for this week yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
