import React, { useEffect, useRef, useState, useCallback } from 'react';
import { startOfToday, parseISO, differenceInDays, format } from 'date-fns';
import { useStore } from '../store';
import { newProjectTrigger } from './MacroGoalsPanel';
import { baseDateTrigger, inboxTrigger } from './HorizonView';

type ResultItem =
  | { kind: 'task';    id: string; title: string; projectColor: string | null; deadline: string | null }
  | { kind: 'project'; id: string; name: string; taskCount: number; color: string }
  | { kind: 'action';  id: string; label: string }
  | { kind: 'deadline'; id: string; title: string; projectColor: string | null; projectName: string | null; deadline: string; daysLeft: number; date: string | null };

const ACTIONS: ResultItem[] = [
  { kind: 'action', id: 'today',        label: 'Go to today' },
  { kind: 'action', id: 'new-task',     label: 'New task' },
  { kind: 'action', id: 'new-project',  label: 'New project' },
  { kind: 'action', id: 'misc-timer',   label: 'Start free timer' },
];

export function CommandPalette() {
  const { tasks, projects, startPomodoro } = useStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Open on Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Auto-focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  // Build filtered results
  const { deadlineItems, results } = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const today = startOfToday();

    // Deadline section: 5 nearest-deadline incomplete tasks
    const nearestDeadlines: (ResultItem & { kind: 'deadline' })[] = tasks
      .filter(t => !t.completed && t.deadline != null)
      .map(t => {
        const daysLeft = differenceInDays(parseISO(t.deadline!), today);
        const project = projects.find(p => p.id === t.projectId);
        return {
          kind: 'deadline' as const,
          id: t.id,
          title: t.title,
          projectColor: project?.color ?? null,
          projectName: project?.name ?? null,
          deadline: t.deadline!,
          daysLeft,
          date: t.date,
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 5);

    const filteredDeadlines: ResultItem[] = q
      ? nearestDeadlines.filter(d =>
          d.title.toLowerCase().includes(q) ||
          (d.projectName?.toLowerCase().includes(q) ?? false)
        )
      : nearestDeadlines;

    const matchedTasks: ResultItem[] = tasks
      .filter(t => !q || t.title.toLowerCase().includes(q))
      .map(t => ({
        kind: 'task' as const,
        id: t.id,
        title: t.title,
        projectColor: projects.find(p => p.id === t.projectId)?.color ?? null,
        deadline: t.deadline,
      }));

    const matchedProjects: ResultItem[] = projects
      .filter(p => !q || p.name.toLowerCase().includes(q))
      .map(p => ({
        kind: 'project' as const,
        id: p.id,
        name: p.name,
        taskCount: tasks.filter(t => t.projectId === p.id).length,
        color: p.color,
      }));

    const matchedActions: ResultItem[] = ACTIONS.filter(a =>
      !q || a.label.toLowerCase().includes(q)
    );

    return {
      deadlineItems: filteredDeadlines,
      results: [...matchedTasks, ...matchedProjects, ...matchedActions],
    };
  }, [query, tasks, projects]);

  const allItems = React.useMemo(
    () => [...deadlineItems, ...results],
    [deadlineItems, results],
  );

  // Keep selectedIdx in bounds
  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  const execute = useCallback((item: ResultItem) => {
    if (item.kind === 'task') {
      const task = tasks.find(t => t.id === item.id);
      if (task?.date) {
        baseDateTrigger.setDate(parseISO(task.date));
        setTimeout(() => {
          document.getElementById(`task-${task.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
      } else {
        // No date — open Inbox panel where unscheduled tasks live
        inboxTrigger.open();
      }
      close();
    } else if (item.kind === 'deadline') {
      const task = tasks.find(t => t.id === item.id);
      const targetDate = task?.date ? parseISO(task.date) : parseISO(item.deadline);
      baseDateTrigger.setDate(targetDate);
      setTimeout(() => {
        document.getElementById(`task-${item.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      close();
    } else if (item.kind === 'project') {
      close();
    } else if (item.kind === 'action') {
      close();
      if (item.id === 'today') {
        baseDateTrigger.setDate(startOfToday());
      } else if (item.id === 'new-task') {
        setTimeout(() => document.getElementById('new-task-input')?.focus(), 50);
      } else if (item.id === 'new-project') {
        newProjectTrigger.open();
      } else if (item.id === 'misc-timer') {
        startPomodoro(null);
      }
    }
  }, [tasks, close, startPomodoro]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const item = allItems[selectedIdx];
      if (item) execute(item);
    }
  };

  if (!open) return null;

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '15vh',
    zIndex: 99999,
  };

  const panelStyle: React.CSSProperties = {
    background: 'var(--bg-0)',
    border: '1px solid #1E1E1E',
    borderRadius: '0.5rem',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    width: '560px',
    maxWidth: '90vw',
    overflow: 'hidden',
    fontFamily: 'Consolas, monospace',
    color: 'var(--text-1)',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 16px',
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid #1E1E1E',
    color: 'var(--text-1)',
    fontSize: '14px',
    fontFamily: 'Consolas, monospace',
    outline: 'none',
  };

  const listStyle: React.CSSProperties = {
    maxHeight: '380px',
    overflowY: 'auto',
    padding: '6px',
  };

  return (
    <div style={overlayStyle} onClick={close}>
      <div style={panelStyle} onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          style={inputStyle}
          placeholder="Search tasks, projects, actions…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div style={listStyle}>
          {allItems.length === 0 && (
            <div style={{ padding: '12px 10px', color: '#666', fontSize: '13px' }}>
              No results
            </div>
          )}
          {deadlineItems.length > 0 && (
            <div style={{ padding: '8px 10px 4px', fontSize: '11px', fontWeight: 600, color: '#888', letterSpacing: '0.5px' }}>
              🔥 Upcoming Deadlines
            </div>
          )}
          {deadlineItems.map((item, idx) => {
            const isSelected = idx === selectedIdx;
            const dl = item as ResultItem & { kind: 'deadline' };
            const badgeColor = dl.daysLeft < 0 ? '#ef4444'
              : dl.daysLeft <= 3 ? '#f97316'
              : dl.daysLeft <= 7 ? '#eab308'
              : '#3b82f6';
            const badgeLabel = dl.daysLeft < 0 ? `${Math.abs(dl.daysLeft)}d overdue`
              : dl.daysLeft === 0 ? 'today'
              : `${dl.daysLeft}d left`;
            const rowStyle: React.CSSProperties = {
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              background: isSelected ? '#1A1A1A' : 'transparent',
              transition: 'background 0.1s',
            };
            return (
              <div
                key={`dl-${dl.id}`}
                style={rowStyle}
                onClick={() => execute(dl)}
                onMouseEnter={() => setSelectedIdx(idx)}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: dl.projectColor ?? 'var(--text-2)',
                }} />
                <span style={{ flex: 1, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {dl.title}
                </span>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: badgeColor,
                  border: `1px solid ${badgeColor}`,
                  borderRadius: '4px',
                  padding: '1px 6px',
                  flexShrink: 0,
                }}>
                  {badgeLabel}
                </span>
                {dl.projectName && (
                  <span style={{ fontSize: '10px', color: 'var(--text-2)', flexShrink: 0 }}>
                    {dl.projectName}
                  </span>
                )}
              </div>
            );
          })}
          {results.map((item, idx) => {
            const globalIdx = deadlineItems.length + idx;
            const isSelected = globalIdx === selectedIdx;
            const rowStyle: React.CSSProperties = {
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              background: isSelected ? '#1A1A1A' : 'transparent',
              transition: 'background 0.1s',
            };

            if (item.kind === 'task'){
              return (
                <div
                  key={item.id}
                  style={rowStyle}
                  onClick={() => execute(item)}
                  onMouseEnter={() => setSelectedIdx(globalIdx)}
                >
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: item.projectColor ?? 'var(--text-2)',
                  }} />
                  <span style={{ flex: 1, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title}
                  </span>
                  {item.deadline && (
                    <span style={{ fontSize: '11px', color: 'var(--text-2)', flexShrink: 0 }}>
                      {(() => {
                        const d = parseISO(item.deadline);
                        const diff = differenceInDays(d, startOfToday());
                        if (diff === 0) return 'today';
                        if (diff === 1) return 'tmrw';
                        if (diff > 0 && diff <= 6) return `in ${diff}d`;
                        return format(d, 'MMM d');
                      })()}
                    </span>
                  )}
                  <span style={{ fontSize: '10px', color: 'var(--text-2)', flexShrink: 0 }}>task</span>
                </div>
              );
            }

            if (item.kind === 'project') {
              return (
                <div
                  key={item.id}
                  style={rowStyle}
                  onClick={() => execute(item)}
                  onMouseEnter={() => setSelectedIdx(globalIdx)}
                >
                  <span style={{
                    width: 8, height: 8, borderRadius: '2px', flexShrink: 0,
                    background: item.color,
                  }} />
                  <span style={{ flex: 1, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-2)', flexShrink: 0 }}>
                    {item.taskCount} task{item.taskCount !== 1 ? 's' : ''}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-2)', flexShrink: 0 }}>project</span>
                </div>
              );
            }

            // action
            return (
              <div
                key={item.id}
                style={rowStyle}
                onClick={() => execute(item)}
                onMouseEnter={() => setSelectedIdx(globalIdx)}
              >
                <span style={{
                  width: 8, height: 8, flexShrink: 0,
                  borderRadius: '50%',
                  border: '1px solid var(--text-2)',
                }} />
                <span style={{ flex: 1, fontSize: '13px' }}>{item.label}</span>
                <span style={{ fontSize: '10px', color: 'var(--text-2)', flexShrink: 0 }}>action</span>
              </div>
            );
          })}
        </div>
        <div style={{
          padding: '6px 16px',
          borderTop: '1px solid #1E1E1E',
          fontSize: '10px',
          color: 'var(--text-2)',
          display: 'flex',
          gap: '16px',
        }}>
          <span>↑↓ navigate</span>
          <span>↵ execute</span>
          <span>Esc close</span>
        </div>
      </div>
    </div>
  );
}
