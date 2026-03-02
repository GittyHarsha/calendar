import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { DayPicker } from 'react-day-picker';
import { format, parseISO } from 'date-fns';
import 'react-day-picker/style.css';

interface Props {
  value: string | null | undefined;
  onChange: (date: string | null) => void;
  onClose: () => void;
  clearable?: boolean;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

export function DatePickerPopover({ value, onChange, onClose, clearable, anchorRef }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const selected = value ? parseISO(value) : undefined;
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Position relative to anchor before paint (no flash)
  useLayoutEffect(() => {
    if (anchorRef?.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      const pickerW = 280;
      const pickerH = 320;
      let top = rect.bottom + 4;
      let left = rect.left;
      if (top + pickerH > window.innerHeight - 8) top = rect.top - pickerH - 4;
      if (left + pickerW > window.innerWidth - 8) left = window.innerWidth - pickerW - 8;
      if (left < 8) left = 8;
      setPos({ top, left });
    }
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  const content = (
    <div
      ref={ref}
      style={{
        background: '#161616',
        border: '1px solid #2A2A2A',
        borderRadius: 12,
        boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
        zIndex: 9999,
        position: 'fixed',
        ...(pos ? { top: pos.top, left: pos.left } : { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }),
      }}
    >
      <style>{`
        .rdp-root {
          --rdp-accent-color: #F27D26;
          --rdp-accent-background-color: rgba(242,125,38,0.15);
          --rdp-day-width: 36px;
          --rdp-day-height: 36px;
          --rdp-selected-border: none;
          --rdp-background-color: #161616;
          color: #C8C7C4 !important;
          background: #161616 !important;
          padding: 12px;
          font-family: inherit;
        }
        .rdp-month_caption { padding-bottom: 8px; }
        .rdp-caption_label { font-size: 13px; font-weight: 700; color: #E4E3E0 !important; text-transform: uppercase; letter-spacing: 0.06em; }
        .rdp-nav button { color: #555 !important; background: none !important; border: none; cursor: pointer; border-radius: 6px; padding: 4px 6px; }
        .rdp-nav button:hover { color: #E4E3E0 !important; background: #222 !important; }
        .rdp-weekday { font-size: 10px; font-weight: 600; color: #444 !important; text-transform: uppercase; letter-spacing: 0.08em; padding-bottom: 4px; }
        .rdp-day button { width: 36px; height: 36px; border-radius: 8px; font-size: 12px; color: #8E9299 !important; background: none !important; border: none; cursor: pointer; transition: background 0.1s, color 0.1s; font-weight: 500; }
        .rdp-day button:hover { background: #222 !important; color: #E4E3E0 !important; }
        .rdp-today button { color: #F27D26 !important; font-weight: 700; }
        .rdp-selected button { background: #F27D26 !important; color: #000 !important; font-weight: 700; }
        .rdp-outside button { color: #2A2A2A !important; }
        .rdp-disabled button { opacity: 0.2; cursor: not-allowed; }
      `}</style>

      <DayPicker
        mode="single"
        selected={selected}
        onSelect={(date) => {
          onChange(date ? format(date, 'yyyy-MM-dd') : null);
          onClose();
        }}
        defaultMonth={selected ?? new Date()}
        showOutsideDays
      />

      {clearable && value && (
        <div style={{ borderTop: '1px solid #1E1E1E', padding: '6px 12px 10px' }}>
          <button
            onClick={() => { onChange(null); onClose(); }}
            style={{ width: '100%', fontSize: 11, color: '#555', background: 'none', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
            onMouseLeave={e => (e.currentTarget.style.color = '#555')}
          >
            Clear date
          </button>
        </div>
      )}
    </div>
  );

  // Always portal to body to avoid overflow clipping
  return ReactDOM.createPortal(content, document.body);
}
