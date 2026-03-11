import React from 'react';
import { useStore } from '../store';
import { format, startOfToday, parseISO, differenceInDays, subDays } from 'date-fns';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function MorningBriefingCard({ onDismiss }: { onDismiss: () => void }) {
  const { tasks } = useStore();
  const today = startOfToday();
  const todayStr = format(today, 'yyyy-MM-dd');
  const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd');

  const todayTaskCount = tasks.filter(t => t.date === todayStr && !t.completed).length;
  const overdueCount = tasks.filter(t => !t.completed && t.date && t.date < todayStr).length;
  const yesterdayCompleted = tasks.filter(t => t.completedAt === yesterdayStr).length;

  const topDeadlines = tasks
    .filter(t => !t.completed && t.deadline)
    .map(t => ({ title: t.title, daysLeft: differenceInDays(parseISO(t.deadline!), today) }))
    .filter(d => d.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 3);

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, var(--bg-1)), color-mix(in srgb, var(--accent) 5%, var(--bg-1)))',
        border: '1px solid color-mix(in srgb, var(--accent) 25%, var(--border-1))',
        borderRadius: 10,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        animation: 'fade-in 0.3s ease',
        maxHeight: 150,
        overflow: 'hidden',
      }}
    >
      {/* Header + dismiss */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1, #F0EFEB)' }}>
          {getGreeting()} ☀️
        </span>
        <button
          onClick={onDismiss}
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--accent)',
            background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
            borderRadius: 6,
            padding: '2px 8px',
            cursor: 'pointer',
            lineHeight: '18px',
          }}
        >
          Got it ✓
        </button>
      </div>

      {/* Summary line */}
      <div style={{ fontSize: 11, color: 'var(--text-2, #999)', lineHeight: 1.5 }}>
        <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{todayTaskCount}</span> task{todayTaskCount !== 1 ? 's' : ''} today
        {overdueCount > 0 && (
          <>, <span style={{ color: '#ef4444', fontWeight: 700 }}>{overdueCount}</span> overdue</>
        )}
        {yesterdayCompleted > 0 && (
          <span style={{ opacity: 0.7 }}> · {yesterdayCompleted} done yesterday</span>
        )}
      </div>

      {/* Deadlines */}
      {topDeadlines.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2, #666)' }}>
            Upcoming deadlines
          </span>
          {topDeadlines.map((d, i) => {
            const urgencyColor = d.daysLeft === 0 ? '#F27D26' : d.daysLeft <= 2 ? '#f97316' : d.daysLeft <= 5 ? '#eab308' : 'var(--text-2, #888)';
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <span style={{ color: urgencyColor, fontFamily: 'monospace', fontWeight: 700, fontSize: 10, flexShrink: 0, width: 28, textAlign: 'right' }}>
                  {d.daysLeft === 0 ? 'today' : `${d.daysLeft}d`}
                </span>
                <span style={{ color: 'var(--text-1, #ccc)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.title}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
