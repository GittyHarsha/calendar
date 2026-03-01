import React, { useEffect, useRef, useState, useCallback } from 'react';
import { startOfToday, parseISO } from 'date-fns';
import { useStore } from '../store';
import { newProjectTrigger } from './MacroGoalsPanel';
import { baseDateTrigger } from './HorizonView';

type ResultItem =
  | { kind: 'task';    id: string; title: string; projectColor: string | null; deadline: string | null }
  | { kind: 'project'; id: string; name: string; taskCount: number; color: string }
  | { kind: 'action';  id: string; label: string };

const ACTIONS: ResultItem[] = [
  { kind: 'action', id: 'today',        label: 'Go to today' },
  { kind: 'action', id: 'new-task',     label: 'New task' },
  { kind: 'action', id: 'new-project',  label: 'New project' },
  { kind: 'action', id: 'misc-timer',   label: 'Start misc timer' },
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
  const results: ResultItem[] = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const matchedTasks: ResultItem[] = tasks
      .filter(t => !q || t.title.toLowerCase().includes(q))
      .map(t => ({
        kind: 'task',
        id: t.id,
        title: t.title,
        projectColor: projects.find(p => p.id === t.projectId)?.color ?? null,
        deadline: t.deadline,
      }));

    const matchedProjects: ResultItem[] = projects
      .filter(p => !q || p.name.toLowerCase().includes(q))
      .map(p => ({
        kind: 'project',
        id: p.id,
        name: p.name,
        taskCount: tasks.filter(t => t.projectId === p.id).length,
        color: p.color,
      }));

    const matchedActions: ResultItem[] = ACTIONS.filter(a =>
      !q || a.label.toLowerCase().includes(q)
    );

    return [...matchedTasks, ...matchedProjects, ...matchedActions];
  }, [query, tasks, projects]);

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
      }
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
      setSelectedIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const item = results[selectedIdx];
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
    background: 'var(--bg-1)',
    border: '1px solid var(--border-1)',
    borderRadius: '0.75rem',
    boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
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
    borderBottom: '1px solid var(--border-1)',
    color: 'var(--text-1)',
    fontSize: '15px',
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
          {results.length === 0 && (
            <div style={{ padding: '12px 10px', color: 'var(--text-2)', fontSize: '13px' }}>
              No results
            </div>
          )}
          {results.map((item, idx) => {
            const isSelected = idx === selectedIdx;
            const rowStyle: React.CSSProperties = {
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              background: isSelected ? 'var(--bg-2)' : 'transparent',
              transition: 'background 0.1s',
            };

            if (item.kind === 'task') {
              return (
                <div
                  key={item.id}
                  style={rowStyle}
                  onClick={() => execute(item)}
                  onMouseEnter={() => setSelectedIdx(idx)}
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
                      {item.deadline}
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
                  onMouseEnter={() => setSelectedIdx(idx)}
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
                onMouseEnter={() => setSelectedIdx(idx)}
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
          borderTop: '1px solid var(--border-1)',
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
