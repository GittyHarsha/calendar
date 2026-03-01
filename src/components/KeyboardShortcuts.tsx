import { useEffect } from 'react';

interface Props {
  onClose: () => void;
}

const SHORTCUTS = [
  { key: 'Ctrl+Z', desc: 'Undo' },
  { key: 'N', desc: 'New task' },
  { key: 'P', desc: 'New project' },
  { key: '/', desc: 'Search inbox' },
  { key: 'Esc', desc: 'Close / cancel' },
  { key: '?', desc: 'Show shortcuts' },
];

export function KeyboardShortcuts({ onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-1)',
          border: '1px solid var(--border-1)',
          color: 'var(--text-1)',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          minWidth: '320px',
          maxWidth: '420px',
          width: '90vw',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '0.75rem', right: '0.75rem',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-2)', fontSize: '1.25rem', lineHeight: 1,
            padding: '0.25rem 0.5rem', borderRadius: '0.25rem',
          }}
          aria-label="Close"
        >
          ×
        </button>

        <h2 style={{ margin: '0 0 1.25rem', fontSize: '1rem', fontWeight: 600 }}>
          Keyboard Shortcuts
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.6rem 1rem', alignItems: 'center' }}>
          {SHORTCUTS.map(({ key, desc }) => (
            <>
              <kbd
                key={key}
                style={{
                  display: 'inline-block',
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  padding: '0.2rem 0.5rem',
                  border: '1px solid var(--border-1)',
                  borderRadius: '0.3rem',
                  background: 'var(--bg-2, var(--bg-1))',
                  color: 'var(--text-1)',
                  whiteSpace: 'nowrap',
                  justifySelf: 'start',
                }}
              >
                {key}
              </kbd>
              <span style={{ color: 'var(--text-2)', fontSize: '0.875rem' }}>{desc}</span>
            </>
          ))}
        </div>
      </div>
    </div>
  );
}
