import React, { useEffect, useRef, useState } from 'react';
import { Task, useStore } from '../store';
import { X } from 'lucide-react';

interface Props {
  task: Task;
  onClose: () => void;
}

export function TaskNotesModal({ task, onClose }: Props) {
  const { updateTask } = useStore();
  const [notes, setNotes] = useState(task.description ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus textarea
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Save on close
  const handleClose = () => {
    updateTask(task.id, { description: notes });
    onClose();
  };

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [notes]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch bg-[#0A0A0A]/90 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="flex flex-col w-full h-full max-w-3xl mx-auto bg-[#111] border-x border-[#222]">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-4 border-b border-[#222] shrink-0">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-[#555] font-semibold mb-1">Notes</div>
            <div className="text-lg font-semibold text-[#E4E3E0] truncate">{task.title}</div>
          </div>
          <button
            onClick={handleClose}
            className="ml-4 text-[#555] hover:text-white transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Notes area */}
        <textarea
          ref={textareaRef}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Write anything…"
          className="flex-1 w-full bg-transparent text-[#C8C7C4] placeholder-[#333] text-base leading-relaxed px-8 py-6 focus:outline-none resize-none font-mono"
        />

        {/* Footer */}
        <div className="flex items-center justify-between px-8 py-3 border-t border-[#222] shrink-0">
          <span className="text-[10px] text-[#444]">Esc to save & close</span>
          <button
            onClick={handleClose}
            className="text-xs font-semibold px-4 py-1.5 bg-[#F27D26] hover:bg-[#E06D16] text-black rounded transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
