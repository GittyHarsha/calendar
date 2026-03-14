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
  background: 'rgba(0,0,0,0.6)',
  backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 9999,
};

const modalStyle: React.CSSProperties = {
  background: 'var(--bg-0)',
  border: '1px solid #1E1E1E',
  color: 'var(--text-1)',
  borderRadius: '0.5rem',
  padding: '1.5rem 1.75rem',
  maxWidth: 400,
  width: '90vw',
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
  position: 'relative',
};

const kbdStyle: React.CSSProperties = {
  display: 'inline-block',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontSize: 11,
  padding: '2px 6px',
  border: '1px solid #333',
  borderRadius: 4,
  background: '#1A1A1A',
  whiteSpace: 'nowrap',
  justifySelf: 'start',
  lineHeight: '20px',
};

const closeBtnStyle: React.CSSProperties = {
  position: 'absolute', top: 12, right: 12,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, borderRadius: '0.375rem',
  background: 'none', border: 'none', cursor: 'pointer', color: '#666',
};

export function KeyboardShortcuts({ onClose }: Props) {
  const [visible, setVisible] = useState(false);
  const [closeBtnHover, setCloseBtnHover] = useState(false);

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
          transform: visible ? 'scale(1)' : 'scale(0.98)',
          transition: 'opacity 150ms ease, transform 150ms ease',
        }}
      >
        <button
          onClick={onClose}
          onMouseEnter={() => setCloseBtnHover(true)}
          onMouseLeave={() => setCloseBtnHover(false)}
          style={{ ...closeBtnStyle, background: closeBtnHover ? '#1A1A1A' : 'none' }}
          aria-label="Close"
        >
          ✕
        </button>

        <h2 style={{ margin: '0 0 1.25rem', fontSize: 13, fontWeight: 600, letterSpacing: '0.01em' }}>
          Keyboard Shortcuts
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.55rem 1rem', alignItems: 'center' }}>
          {SHORTCUTS.map(({ key, desc }) => (
            <div key={key} style={{ display: 'contents' }}>
              <kbd style={kbdStyle}>{key}</kbd>
              <span style={{ fontSize: 12, color: '#888' }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
