import React from 'react';
import { useStore, fmtDuration } from '../store';
import { format, startOfToday, parseISO, differenceInDays } from 'date-fns';
import { X } from 'lucide-react';

export function DailyBriefing({ onClose }: { onClose: () => void }) {
  const { tasks, projects, timeEntries } = useStore();
  const today = startOfToday();
  const todayStr = format(today, 'yyyy-MM-dd');

  const todayTasks    = tasks.filter(t => t.date === todayStr && !t.completed);
  const completedToday = tasks.filter(t => t.completed && t.date === todayStr);
  const overdueTasks  = tasks
    .filter(t => !t.completed && t.date && t.date < todayStr)
    .sort((a, b) => a.date!.localeCompare(b.date!));
  const upcomingDeadlines = tasks
    .filter(t => !t.completed && t.deadline)
    .map(t => ({ ...t, daysLeft: differenceInDays(parseISO(t.deadline!), today) }))
    .filter(t => t.daysLeft >= 0 && t.daysLeft <= 7)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const todayTimeMs = timeEntries
    .filter(e => e.startedAt.startsWith(todayStr))
    .reduce((s, e) => s + e.duration, 0);

  const totalEstimatedMins = todayTasks.reduce((s, t) => s + (t.estimatedMinutes ?? 0), 0);

  const stat = (label: string, value: React.ReactNode, color: string) => (
    <div style={{ padding: '12px 16px', borderRight: '1px solid #1E1E1E' }}>
      <div style={{ fontSize: 26, fontWeight: 900, fontFamily: 'system-ui', color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>{label}</div>
    </div>
  );

  const TaskRow = ({ title, projectId, badge, badgeColor, bg, border }: {
    title: string; projectId: string | null;
    badge?: string; badgeColor?: string;
    bg?: string; border?: string;
  }) => {
    const p = projects.find(pr => pr.id === projectId);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, background: bg ?? '#0D0D0D', border: `1px solid ${border ?? '#1A1A1A'}` }}>
        {p && <div style={{ width: 6, height: 6, borderRadius: '50%', background: p.color, flexShrink: 0 }} />}
        <span style={{ flex: 1, fontSize: 13, color: '#C8C7C4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        {badge && <span style={{ fontSize: 10, fontFamily: 'monospace', color: badgeColor, flexShrink: 0 }}>{badge}</span>}
      </div>
    );
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#444', marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{children}</div>
    </div>
  );

  const empty = todayTasks.length === 0 && overdueTasks.length === 0 && upcomingDeadlines.length === 0;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg-1)', border: '1px solid #252525', borderRadius: '1rem', width: 520, maxWidth: '90vw', maxHeight: '82vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.7)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #1E1E1E', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#F0EFEB', fontFamily: 'system-ui' }}>{format(today, 'EEEE, MMMM d')}</div>
            <div style={{ fontSize: 11, color: '#444', fontFamily: 'system-ui', marginTop: 3 }}>Daily Briefing</div>
          </div>
          <button onClick={onClose} style={{ color: '#555', background: 'none', border: 'none', cursor: 'pointer', padding: 4, marginTop: -2 }}><X size={18} /></button>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid #1E1E1E' }}>
          {stat('Today', todayTasks.length, 'var(--accent)')}
          {stat('Overdue', overdueTasks.length, overdueTasks.length > 0 ? '#ef4444' : '#333')}
          {stat('Done today', completedToday.length, completedToday.length > 0 ? '#22c55e' : '#333')}
          {stat('Tracked', todayTimeMs > 0 ? fmtDuration(todayTimeMs) : '—', '#3B82F6')}
        </div>

        {/* Content */}
        <div style={{ overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {empty && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#555', fontSize: 14, fontFamily: 'system-ui' }}>
              Nothing on the schedule — clear day 🎉
            </div>
          )}

          {todayTasks.length > 0 && (
            <Section title={`Up next today${totalEstimatedMins > 0 ? ` · ${totalEstimatedMins}m estimated` : ''}`}>
              {todayTasks.slice(0, 8).map(t => {
                const dl = t.deadline ? differenceInDays(parseISO(t.deadline), today) : null;
                const dlColor = dl !== null ? (dl < 0 ? '#ef4444' : dl === 0 ? '#F27D26' : dl <= 2 ? '#f97316' : '#eab308') : undefined;
                const dlLabel = dl !== null && dl <= 3 ? (dl < 0 ? `${Math.abs(dl)}d over` : dl === 0 ? 'due today' : `${dl}d`) : undefined;
                const badge = dlLabel ?? (t.estimatedMinutes ? `${t.estimatedMinutes}m` : undefined);
                const badgeColor = dlColor ?? '#555';
                return <TaskRow key={t.id} title={t.title} projectId={t.projectId} badge={badge} badgeColor={badgeColor} />;
              })}
              {todayTasks.length > 8 && (
                <div style={{ fontSize: 11, color: '#555', paddingLeft: 10 }}>+{todayTasks.length - 8} more</div>
              )}
            </Section>
          )}

          {overdueTasks.length > 0 && (
            <Section title={`Overdue · ${overdueTasks.length} task${overdueTasks.length !== 1 ? 's' : ''}`}>
              {overdueTasks.slice(0, 6).map(t => {
                const age = differenceInDays(today, parseISO(t.date!));
                return <TaskRow key={t.id} title={t.title} projectId={t.projectId} badge={`${age}d ago`} badgeColor="#ef4444" bg="#130606" border="#2a1010" />;
              })}
              {overdueTasks.length > 6 && (
                <div style={{ fontSize: 11, color: '#ef444460', paddingLeft: 10 }}>+{overdueTasks.length - 6} more overdue</div>
              )}
            </Section>
          )}

          {upcomingDeadlines.length > 0 && (
            <Section title="Deadlines in the next 7 days">
              {upcomingDeadlines.map(t => {
                const c = t.daysLeft === 0 ? '#F27D26' : t.daysLeft <= 2 ? '#f97316' : t.daysLeft <= 5 ? '#eab308' : '#3B82F6';
                const lbl = t.daysLeft === 0 ? 'today' : `${t.daysLeft}d`;
                return <TaskRow key={t.id} title={t.title} projectId={t.projectId} badge={lbl} badgeColor={c} bg={c + '0D'} border={c + '30'} />;
              })}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
