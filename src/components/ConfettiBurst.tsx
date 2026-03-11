import React, { useEffect, useState } from 'react';

const PARTICLE_COUNT = 8;
const COLORS = ['#ef4444', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#f97316', '#ec4899', '#14b8a6'];

// Pre-computed angles so each dot scatters in a different direction
const ANGLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => (360 / PARTICLE_COUNT) * i + Math.random() * 20 - 10);

export function ConfettiBurst({ x, y, onDone }: { x: number; y: number; onDone: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); onDone(); }, 650);
    return () => clearTimeout(t);
  }, [onDone]);

  if (!visible) return null;

  return (
    <div
      className="confetti-burst"
      style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 9999 }}
    >
      {ANGLES.map((angle, i) => (
        <span
          key={i}
          className="confetti-dot"
          style={{
            '--angle': `${angle}deg`,
            '--distance': `${18 + Math.random() * 14}px`,
            backgroundColor: COLORS[i % COLORS.length],
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
