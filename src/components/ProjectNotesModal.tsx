import React, { useEffect, useRef, useState } from 'react';
import { Project, useStore } from '../store';
import { X } from 'lucide-react';

interface Props {
  project: Project;
  onClose: () => void;
}

export function ProjectNotesModal({ project, onClose }: Props) {
  const { updateProject } = useStore();
  const [notes, setNotes] = useState(project.notes ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  const handleClose = () => {
    updateProject(project.id, { notes });
    onClose();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [notes]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch bg-[#0A0A0A]/90 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="flex flex-col w-full h-full bg-[#111] border-x border-[#222]">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-4 border-b border-[#222] shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
              <span className="text-[12px] uppercase tracking-widest text-[#aaa] font-semibold">
                {project.parentId ? 'Subproject Notes' : 'Project Notes'}
              </span>
            </div>
            <div className="text-lg font-semibold text-[#E4E3E0] truncate">{project.name}</div>
          </div>
          <button onClick={handleClose} className="ml-4 text-[#aaa] hover:text-white transition-colors shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Notes area */}
        <textarea
          ref={textareaRef}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Write anything about this project…"
          className="flex-1 w-full bg-transparent text-[#C8C7C4] placeholder-[#333] text-base leading-relaxed px-8 py-6 focus:outline-none resize-none font-sans"
        />

        {/* Footer */}
        <div className="flex items-center justify-between px-8 py-3 border-t border-[#222] shrink-0">
          <span className="text-[12px] text-[#888]">Esc to save & close</span>
          <button
            onClick={handleClose}
            className="text-xs font-semibold px-4 py-1.5 text-black rounded transition-colors"
            style={{ background: 'var(--accent)' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
