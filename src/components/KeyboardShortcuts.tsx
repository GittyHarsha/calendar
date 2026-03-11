import { useEffect, useState } from 'react';

interface Props {
  onClose: () => void;
}

const SHORTCUTS = [
  { key: 'T', desc: 'Complete hovered task' },
  { key: '←→', desc: 'Navigate columns' },
  { key: '↑↓', desc: 'Navigate tasks' },
  { key: 'Enter', desc: 'Open task' },
  { key: 'Escape', desc: 'Clear focus / Close' },
  { key: '⌘K', desc: 'Command palette' },
  { key: 'Shift+Click', desc: 'Select multiple tasks' },
  { key: '?', desc: 'This help' },
];

const backdropStyle: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 9999,
};

const modalStyle: React.CSSProperties = {
  background: '#0d0d1a',
  border: '1px solid var(--border-1)',
  color: 'var(--text-1)',
  borderRadius: '0.75rem',
  padding: '1.5rem 1.75rem',
  maxWidth: 400,
  width: '90vw',
  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)',
  position: 'relative',
};

const kbdStyle: React.CSSProperties = {
  display: 'inline-block',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontSize: 12,
  padding: '2px 8px',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 5,
  background: 'rgba(255,255,255,0.07)',
  color: 'var(--text-1)',
  whiteSpace: 'nowrap',
  justifySelf: 'start',
  lineHeight: '20px',
};

export function KeyboardShortcuts({ onClose }: Props) {
  const [visible, setVisible] = useState(false);

  // Trigger fade-in on mount
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [onClose]);

  return (
    <div onClick={onClose} style={backdropStyle}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          ...modalStyle,
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 150ms ease, transform 150ms ease',
        }}
      >
        <h2 style={{ margin: '0 0 1.25rem', fontSize: '0.95rem', fontWeight: 600, letterSpacing: '0.01em' }}>
          Keyboard Shortcuts
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.55rem 1rem', alignItems: 'center' }}>
          {SHORTCUTS.map(({ key, desc }) => (
            <div key={key} style={{ display: 'contents' }}>
              <kbd style={kbdStyle}>{key}</kbd>
              <span style={{ color: 'var(--text-1)', fontSize: 13, opacity: 0.82 }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
