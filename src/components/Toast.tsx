import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

type ToastData = {
  message: string;
  undoFn: () => void;
};

type ToastContextValue = {
  showToast: (message: string, undoFn: () => void) => void;
};

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const [visible, setVisible] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout>>();
  const cleanupTimer = useRef<ReturnType<typeof setTimeout>>();
  const startTime = useRef(0);

  const clearTimers = () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    if (cleanupTimer.current) clearTimeout(cleanupTimer.current);
  };

  const showToast = useCallback((message: string, undoFn: () => void) => {
    clearTimers();
    setToast({ message, undoFn });
    setVisible(true);
    startTime.current = Date.now();

    dismissTimer.current = setTimeout(() => {
      setVisible(false);
      cleanupTimer.current = setTimeout(() => setToast(null), 300);
    }, 4000);
  }, []);

  const handleUndo = useCallback(() => {
    if (!toast) return;
    toast.undoFn();
    clearTimers();
    setVisible(false);
    cleanupTimer.current = setTimeout(() => setToast(null), 300);
  }, [toast]);

  const handleDismiss = useCallback(() => {
    clearTimers();
    setVisible(false);
    cleanupTimer.current = setTimeout(() => setToast(null), 300);
  }, []);

  useEffect(() => () => clearTimers(), []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <ToastPill
          message={toast.message}
          visible={visible}
          startTime={startTime.current}
          onUndo={handleUndo}
          onDismiss={handleDismiss}
        />
      )}
    </ToastContext.Provider>
  );
}

function ToastPill({
  message,
  visible,
  startTime,
  onUndo,
  onDismiss,
}: {
  message: string;
  visible: boolean;
  startTime: number;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className="fixed bottom-6 left-1/2 z-[99999]"
      style={{
        transform: `translateX(-50%) translateY(${visible ? '0' : '16px'})`,
        opacity: visible ? 1 : 0,
        transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div
        className="flex items-center gap-3 pl-4 pr-2 py-2 rounded-full shadow-2xl text-sm font-medium"
        style={{
          background: '#1a1a2e',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.08)',
          minWidth: 200,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        <span className="whitespace-nowrap">{message}</span>
        <button
          onClick={onUndo}
          className="shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer"
          style={{
            color: 'var(--accent)',
            background: 'rgba(255,255,255,0.06)',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
        >
          Undo
        </button>
        <button
          onClick={onDismiss}
          className="shrink-0 text-[#666] hover:text-[#aaa] transition-colors cursor-pointer text-xs px-1"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
      {/* Shrinking progress bar */}
      <div
        className="mx-4 mt-1 rounded-full overflow-hidden"
        style={{ height: 2, background: 'rgba(255,255,255,0.06)' }}
      >
        <div
          style={{
            height: '100%',
            background: 'var(--accent)',
            borderRadius: 9999,
            animation: 'toast-progress 4s linear forwards',
            animationDelay: `${-(Date.now() - startTime)}ms`,
          }}
        />
      </div>
      <style>{`
        @keyframes toast-progress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
