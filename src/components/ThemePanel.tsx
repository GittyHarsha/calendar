import { useRef, useEffect } from 'react';
import { useStore, THEMES, ThemeKey } from '../store';

export function ThemePanel({ onClose }: { onClose: () => void }) {
  const { theme, customAccent, setTheme, setCustomAccent } = useStore();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Current accent for the color picker default value
  const pickerValue = customAccent ?? '#FF7B2F';
  const isCustom = !!customAccent;

  return (
    <div
      ref={panelRef}
      style={{
        position: 'absolute', top: 42, right: 8, zIndex: 999,
        background: 'var(--bg-0)', border: '1px solid var(--border-1)', borderRadius: 12,
        padding: '14px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        fontFamily: 'Consolas, monospace', minWidth: 200,
      }}
    >
      <div style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--text-2)', textTransform: 'uppercase', marginBottom: 12 }}>
        Theme
      </div>

      {/* Preset swatches */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(Object.entries(THEMES) as [ThemeKey, typeof THEMES[ThemeKey]][]).map(([key, t]) => (
          <button
            key={key}
            onClick={() => { setTheme(key); onClose(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: !isCustom && theme === key ? `${t.accent}18` : 'transparent',
              outline: !isCustom && theme === key ? `1px solid ${t.accent}55` : '1px solid transparent',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (isCustom || theme !== key) (e.currentTarget as HTMLElement).style.background = '#1a1a1a'; }}
            onMouseLeave={e => { if (isCustom || theme !== key) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: '50%',
              background: `radial-gradient(circle at 35% 35%, ${t.accent}, ${t.bg2})`,
              border: `2px solid ${t.accent}88`, flexShrink: 0,
            }} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 12, color: !isCustom && theme === key ? t.accent : 'var(--text-1)', fontWeight: 600 }}>{t.name}</div>
              <div style={{ fontSize: 9, color: 'var(--text-2)', marginTop: 1 }}>{t.bg1} · {t.accent}</div>
            </div>
            {!isCustom && theme === key && (
              <span style={{ marginLeft: 'auto', fontSize: 10, color: t.accent }}>✓</span>
            )}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border-1)', margin: '12px 0' }} />

      {/* Custom color picker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px' }}>
        <label htmlFor="custom-accent-picker" style={{
          width: 20, height: 20, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
          background: isCustom ? `radial-gradient(circle at 35% 35%, ${customAccent}, #111)` : '#222',
          border: isCustom ? `2px solid ${customAccent}88` : '2px solid #333',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, color: '#666',
        }}>
          {!isCustom && '＋'}
          <input
            id="custom-accent-picker"
            type="color"
            value={pickerValue}
            onChange={e => setCustomAccent(e.target.value)}
            style={{ opacity: 0, position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}
          />
        </label>
        <div style={{ textAlign: 'left', flex: 1 }}>
          <div style={{ fontSize: 12, color: isCustom ? customAccent! : 'var(--text-1)', fontWeight: 600 }}>Custom</div>
          <div style={{ fontSize: 9, color: 'var(--text-2)', marginTop: 1 }}>
            {isCustom ? customAccent : 'Pick any accent color'}
          </div>
        </div>
        {isCustom && (
          <span style={{ fontSize: 10, color: customAccent! }}>✓</span>
        )}
      </div>
    </div>
  );
}
