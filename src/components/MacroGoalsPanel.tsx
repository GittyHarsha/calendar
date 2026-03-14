import React, { useState, useRef } from 'react';
import { useStore, Project } from '../store';
import { differenceInDays, parseISO, startOfToday, addDays, format } from 'date-fns';
import { cn } from '../lib/utils';
import { Clock, AlertTriangle, Plus, X, ChevronDown, ChevronRight, Pencil, FolderPlus } from 'lucide-react';
import { DatePickerPopover } from './DatePickerPopover';

export const newProjectTrigger = { open: () => {} };

/** Collect a project and all its descendants recursively */
function getDescendantIds(projectId: string, projects: Project[]): string[] {
  const result: string[] = [projectId];
  const collect = (pid: string) => {
    projects.filter(p => p.parentId === pid).forEach(c => {
      result.push(c.id);
      collect(c.id);
    });
  };
  collect(projectId);
  return result;
}

/** Returns styling + animation class based on calendar days remaining */
function urgencyStyles(days: number | null) {
  if (days === null) return { border: 'border-[#2A2A2A]',    text: 'text-[#aaa]',      bg: 'bg-[#141414]',     icon: null,                                                                      glow: '' };
  if (days < 0)      return { border: 'border-red-500',       text: 'text-red-400',      bg: 'bg-red-500/10',    icon: <AlertTriangle size={14} className="text-red-400" />,     glow: 'deadline-alarm' };
  if (days === 0)    return { border: 'border-red-500 border-2', text: 'text-red-300',   bg: 'bg-red-500/15',    icon: <AlertTriangle size={14} className="text-red-300" />,     glow: 'deadline-alarm' };
  if (days <= 3)     return { border: 'border-red-500/80 border-2', text: 'text-red-400', bg: 'bg-red-500/10',   icon: <AlertTriangle size={14} className="text-red-400" />,                  glow: 'deadline-alarm' };
  if (days <= 7)     return { border: 'border-[#F27D26] border-2', text: 'text-[#F27D26]', bg: 'bg-[#F27D26]/10', icon: <AlertTriangle size={14} className="text-[#F27D26]" />,               glow: 'deadline-warn' };
  if (days <= 14)    return { border: 'border-yellow-500',    text: 'text-yellow-400',   bg: 'bg-yellow-500/10', icon: <Clock size={14} className="text-yellow-400" />,                       glow: '' };
  return                    { border: 'border-[#3B82F6]',     text: 'text-[#3B82F6]',    bg: 'bg-[#3B82F6]/10',  icon: <Clock size={14} className="text-[#3B82F6]" />,                        glow: '' };
}

function ProgressBar({ projectId }: { projectId: string }) {
  const { tasks, projects } = useStore();
  const ids = getDescendantIds(projectId, projects);
  // Only count tasks that have been scheduled (date !== null)
  const all = tasks.filter(t => ids.includes(t.projectId ?? '') && t.date !== null);
  const done = all.filter(t => t.completed).length;
  const pct = all.length > 0 ? (done / all.length) * 100 : 0;
  return (
    <div className="flex items-center gap-2" title={`${done} of ${all.length} scheduled tasks complete`}>
      <div className="flex-1 h-0.5 bg-[#2A2A2A] rounded-full overflow-hidden">
        <div className="h-full bg-green-500/70 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[13px] font-mono text-[#888] shrink-0">{done}/{all.length}</span>
    </div>
  );
}

function UpcomingTasks({ projectId, today }: { projectId: string; today: Date }) {
  const { tasks, projects } = useStore();
  const ids = getDescendantIds(projectId, projects);
  const relevant = tasks
    .filter(t => ids.includes(t.projectId ?? '') && t.deadline && !t.completed)
    .map(t => ({ ...t, days: differenceInDays(parseISO(t.deadline!), today) }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 3);
  const [expanded, setExpanded] = useState(false);

  if (relevant.length === 0) return null;

  return (
    <div className="mt-1 pt-1 border-t border-[#1E1E1E]">
      <button onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[#666] hover:text-[#aaa] transition-colors">
        {expanded ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
        {relevant.length} task{relevant.length !== 1 ? 's' : ''} due soon
      </button>
      {expanded && (
        <div className="flex flex-col gap-1 mt-1.5">
          {relevant.map(t => {
            const overdue = t.days < 0;
            const isToday = t.days === 0;
            const urgent = t.days > 0 && t.days <= 3;
            const soon = t.days > 3 && t.days <= 10;
            const accent = overdue ? '#ef4444' : isToday ? '#F27D26' : urgent ? '#f97316' : soon ? '#eab308' : '#555';
            const label = overdue ? `${Math.abs(t.days)}d over` : isToday ? 'today' : t.days === 1 ? 'tmrw' : `${t.days}d`;
            const shifts = t.deadlineHistory?.length ?? 0;
            return (
              <div key={t.id} className="flex items-center gap-2">
                <span className="text-[13px] font-black font-mono shrink-0 w-10 text-right" style={{ color: accent }}>{label}</span>
                <div className="w-px h-2.5 shrink-0 opacity-40" style={{ background: accent }} />
                <span className="text-[12px] truncate" title={t.title} style={{ color: overdue || isToday || urgent ? '#C8C7C4' : '#bbb' }}>{t.title}</span>
                {shifts > 0 && <span className="text-[13px] font-bold font-mono shrink-0" style={{ color: '#ef4444' }}>↻{shifts}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProjectForm({
  label, initial, parentColor, compact = false, onSubmit, onCancel,
}: {
  label: string;
  initial?: { name?: string; deadline?: string | null; color?: string };
  parentColor?: string;
  compact?: boolean;
  onSubmit: (name: string, deadline: string | null, color: string) => void;
  onCancel: () => void;
}) {
  const today = startOfToday();
  const [name, setName] = useState(initial?.name ?? '');
  const [deadline, setDeadline] = useState<string>(initial?.deadline ?? format(new Date(), 'yyyy-MM-dd'));
  const [color, setColor] = useState(initial?.color ?? parentColor ?? '#3B82F6');
  const [showPicker, setShowPicker] = useState(false);
  const deadlineBtnRef = useRef<HTMLButtonElement>(null);

  const handle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim(), deadline || null, color);
  };

  return (
    <form onSubmit={handle} className={cn('flex flex-col gap-2 rounded-lg bg-transparent border border-[#1E1E1E]', compact ? 'p-3' : 'p-4')}>
      <div className="flex justify-between items-center">
        <span className="text-[12px] font-bold uppercase tracking-wider text-[#8E9299]">{label}</span>
        <button type="button" onClick={onCancel} className="text-[#aaa] hover:text-white"><X size={13} /></button>
      </div>
      <input type="text" autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Name…"
        className="bg-transparent border border-[#1E1E1E] rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#333]" />
      <div className="relative flex flex-col gap-1">
        <div className="flex gap-1 items-center">
          <button type="button" ref={deadlineBtnRef}
            onClick={e => { e.stopPropagation(); setShowPicker(p => !p); }}
            className="flex-1 text-left bg-transparent border border-[#1E1E1E] rounded px-2 py-1.5 text-sm text-[#8E9299] hover:border-[#333] transition-colors focus:outline-none">
            {deadline ? format(parseISO(deadline), 'MMM d, yyyy') : 'No deadline'}
          </button>
          {deadline && (
            <button type="button" onClick={() => setDeadline('')} className="text-[#aaa] hover:text-red-400 transition-colors" title="Clear deadline">
              <X size={13} />
            </button>
          )}
        </div>
        {showPicker && (
          <DatePickerPopover value={deadline || null} onChange={d => { setDeadline(d ?? ''); setShowPicker(false); }} onClose={() => setShowPicker(false)} clearable anchorRef={deadlineBtnRef} />
        )}
        <div className="flex gap-1">
          {[30, 60, 90, 180].map(d => (
            <button key={d} type="button" onClick={() => setDeadline(format(addDays(today, d), 'yyyy-MM-dd'))}
              className="flex-1 text-[12px] bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[#8E9299] rounded py-1 transition-colors">+{d}d</button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 items-center">
        <input type="color" value={color} onChange={e => setColor(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent" title="Pick color" />
      </div>
      <button type="submit" className="bg-[#1A1A1A] hover:bg-[#252525] text-white text-xs font-bold uppercase tracking-wider py-1.5 rounded transition-colors">
        {initial?.name ? 'Save Changes' : 'Create'}
      </button>
    </form>
  );
}

// Compact tree row for subprojects — no card-in-card nesting
function SubprojectRow({ project, today, depth }: { project: Project; today: Date; depth: number; key?: React.Key }) {
  const { projects, addProject, deleteProject, updateProject } = useStore();
  const [expanded, setExpanded] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(project.name);
  const [editingDL, setEditingDL] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const deadlineBtnRef = useRef<HTMLButtonElement>(null);

  const children = projects.filter(p => p.parentId === project.id);
  const days = project.deadline ? differenceInDays(parseISO(project.deadline), today) : null;
  const overdue = days !== null && days < 0;
  const urgent = days !== null && days >= 0 && days <= 7;
  const soon = days !== null && days > 7 && days <= 14;
  const accent = overdue ? '#ef4444' : urgent ? '#F27D26' : soon ? '#eab308' : '#3B82F6';
  const { text } = urgencyStyles(days);

  const saveName = () => {
    if (nameVal.trim()) updateProject(project.id, { name: nameVal.trim() });
    else setNameVal(project.name);
    setEditingName(false);
  };

  return (
    <>
      <div className="group flex flex-col gap-1 px-3 py-2 rounded-md mx-2 mb-1 hover:bg-[#141414] transition-colors border border-transparent hover:border-[#222] relative"
        style={{ marginLeft: 8 + depth * 16 }}>
        {depth > 0 && (
          <div className="absolute top-0 bottom-0 w-px bg-[#2A2A2A]" style={{ left: -8 }} />
        )}
        {/* Top row: name + actions */}
        <div className="flex items-center gap-2">
          {/* Expand */}
          {children.length > 0 && (
            <button onClick={() => setExpanded(e => !e)} className="text-[#888] hover:text-[#888] shrink-0">
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
          )}
          {/* Color dot */}
          <label className="w-2.5 h-2.5 rounded-full shrink-0 cursor-pointer" style={{ backgroundColor: project.color }}>
            <input type="color" value={project.color} onChange={e => updateProject(project.id, { color: e.target.value })} className="sr-only" />
          </label>
          {/* Name */}
          {editingName ? (
            <input autoFocus value={nameVal} onChange={e => setNameVal(e.target.value)} onBlur={saveName}
              onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setNameVal(project.name); setEditingName(false); } }}
              className="flex-1 text-sm font-semibold text-white bg-transparent border border-[#333] rounded px-2 py-0.5 focus:outline-none" />
          ) : (
            <span className="flex-1 text-sm font-semibold text-[#C8C7C4] truncate cursor-pointer hover:text-white"
              title={project.name}
              onClick={() => setEditingName(true)}>{project.name}</span>
          )}
          {/* Hover actions */}
          <div className="hidden group-hover:flex items-center gap-1.5 shrink-0">
            <button onClick={() => setAddingChild(true)} className="text-[#888] hover:text-[#D0CFC7]" title="Add subproject">
              <FolderPlus size={13} />
            </button>
            {confirmDelete
              ? <span className="flex items-center gap-1 text-xs">
                  <button onClick={() => deleteProject(project.id)} className="text-red-400 hover:text-red-300 font-bold">Yes</button>
                  <span className="text-[#888]">/</span>
                  <button onClick={() => setConfirmDelete(false)} className="text-[#aaa] hover:text-white">No</button>
                </span>
              : <button onClick={() => setConfirmDelete(true)} className="text-[#888] hover:text-red-500 transition-colors">
                  <X size={14} />
                </button>
            }
          </div>
        </div>
        {/* Bottom row: deadline + progress */}
        <div className="flex items-center gap-3 pl-5">
          <button ref={deadlineBtnRef} onClick={e => { e.stopPropagation(); setEditingDL(true); }}
            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
            {(overdue || urgent) && <AlertTriangle size={11} style={{ color: accent }} />}
            <span className="text-2xl font-mono font-black leading-none" style={{ color: days === null ? '#555' : accent }}>
              {days === null ? '—' : Math.abs(days)}
            </span>
            <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: days === null ? '#555' : accent }}>
              {days === null ? 'no date' : overdue ? 'over' : 'left'}
            </span>
          </button>
          <div className="flex-1">
            <ProgressBar projectId={project.id} />
          </div>
        </div>
        {editingDL && (
          <DatePickerPopover value={project.deadline} onChange={d => updateProject(project.id, { deadline: d })} onClose={() => setEditingDL(false)} clearable anchorRef={deadlineBtnRef} />
        )}
      </div>
      {addingChild && (
        <div className="mx-3 mb-2" style={{ marginLeft: 24 + depth * 16 }}>
          <ProjectForm label="New Subproject" compact parentColor={project.color}
            onCancel={() => setAddingChild(false)}
            onSubmit={(name, deadline, color) => {
              addProject({ name, color, deadline, parentId: project.id });
              setAddingChild(false);
            }}
          />
        </div>
      )}
      {expanded && children.map(child => (
        <SubprojectRow key={child.id} project={child} today={today} depth={depth + 1} />
      ))}
    </>
  );
}

function MacroGoalCard({ project, today }: { project: Project; today: Date; key?: React.Key }) {
  const { projects, addProject, tasks, hoveredProjectId, deleteProject, updateProject } = useStore();
  const [editing, setEditing] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(project.name);
  const [editingDL, setEditingDL] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [addingSub, setAddingSub] = useState(false);
  const deadlineBtnRef = useRef<HTMLButtonElement>(null);

  const children = projects.filter(p => p.parentId === project.id);
  const daysRemaining = project.deadline ? differenceInDays(parseISO(project.deadline), today) : null;
  const isHovered = hoveredProjectId === project.id;
  const { border, text, bg, icon, glow } = urgencyStyles(daysRemaining);

  // All tasks for this project and its descendants
  const ids = getDescendantIds(project.id, projects);
  const allProjectTasks = tasks.filter(t => ids.includes(t.projectId ?? ''));
  const remainingTasks = allProjectTasks.filter(t => !t.completed).length;
  const totalTasks = allProjectTasks.length;

  const projectTasks = tasks.filter(t => ids.includes(t.projectId ?? '') && t.date !== null);
  let lostDays = 0;
  if (projectTasks.length > 0) {
    const past = projectTasks.map(t => parseISO(t.date!)).filter(d => differenceInDays(today, d) >= 0).sort((a, b) => b.getTime() - a.getTime());
    lostDays = past.length > 0 ? differenceInDays(today, past[0]) : Math.max(0, differenceInDays(today, parseISO(project.createdAt)));
  } else {
    lostDays = Math.max(0, differenceInDays(today, parseISO(project.createdAt)));
  }
  const lostClass = lostDays >= 14
    ? 'text-red-400 bg-red-500/15 border border-red-500/30 lost-pulse'
    : lostDays >= 7
    ? 'text-orange-400 bg-orange-500/10 border border-orange-500/20 lost-pulse'
    : lostDays >= 3
    ? 'text-yellow-500 bg-yellow-500/10 border border-yellow-500/20'
    : 'text-red-400/70 bg-red-500/10';

  const saveName = () => {
    if (nameVal.trim()) updateProject(project.id, { name: nameVal.trim() });
    else setNameVal(project.name);
    setEditingName(false);
  };

  if (editing) {
    return (
      <ProjectForm label="Edit Goal"
        initial={{ name: project.name, deadline: project.deadline, color: project.color }}
        onCancel={() => setEditing(false)}
        onSubmit={(name, deadline, color) => { updateProject(project.id, { name, deadline, color }); setEditing(false); }}
      />
    );
  }

  return (
    <div className={cn('rounded-lg flex flex-col transition-all relative group border overflow-hidden', border, bg, glow, isHovered && 'ring-2 ring-white/10 shadow-xl')}>
      {/* Header */}
      <div className="p-4 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <label className="w-3 h-3 rounded-full shrink-0 cursor-pointer mt-0.5" style={{ backgroundColor: project.color }}>
              <input type="color" value={project.color} onChange={e => updateProject(project.id, { color: e.target.value })} className="sr-only" />
            </label>
            {editingName ? (
              <input autoFocus value={nameVal} onChange={e => setNameVal(e.target.value)} onBlur={saveName}
                onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setNameVal(project.name); setEditingName(false); } }}
                className="text-base font-bold text-white bg-transparent border border-[#333] rounded px-2 py-0.5 focus:outline-none flex-1 min-w-0" />
            ) : (
              <h3 className="text-base font-bold text-white truncate cursor-pointer hover:underline flex-1 min-w-0"
                title={project.name}
                onClick={() => setEditingName(true)}>{project.name}</h3>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setEditing(true)} className="hidden group-hover:flex text-[#888] hover:text-[#D0CFC7]"><Pencil size={11} /></button>
            {confirmDelete
              ? <span className="flex items-center gap-0.5 text-[12px]">
                  <button onClick={() => deleteProject(project.id)} className="text-red-400 font-bold">Yes</button>
                  <span className="text-[#888]">/</span>
                  <button onClick={() => setConfirmDelete(false)} className="text-[#888] hover:text-white">No</button>
                </span>
              : <button onClick={() => setConfirmDelete(true)} className="hidden group-hover:flex text-[#888] hover:text-red-500"><X size={12} /></button>
            }
          </div>
        </div>

        {/* Deadline row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <button ref={deadlineBtnRef} onClick={e => { e.stopPropagation(); setEditingDL(true); }} className={cn('text-4xl font-mono font-black leading-none tracking-tighter', daysRemaining === null ? 'text-[#555]' : text)}>
              {daysRemaining === null ? '—' : Math.abs(daysRemaining)}
            </button>
            <div className="flex flex-col gap-0.5 mt-1">
              <span className={cn('text-[11px] uppercase tracking-wider leading-none', daysRemaining === null ? 'text-[#555]' : text)}>
                {daysRemaining === null ? 'no deadline' : daysRemaining < 0 ? 'days over' : 'days left'}
              </span>
              {remainingTasks > 0 && totalTasks > 0 && (
                <span className={cn('text-[10px] font-mono leading-none', daysRemaining !== null && daysRemaining <= 7 ? 'text-red-400/80' : 'text-[#666]')}>
                  {remainingTasks} task{remainingTasks !== 1 ? 's' : ''} remain
                </span>
              )}
            </div>
          </div>
          {lostDays > 0 && (
            <div
              title={`${lostDays} day${lostDays !== 1 ? 's' : ''} since last task was scheduled`}
              className={cn('text-[13px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded cursor-help', lostClass)}>
              {lostDays}d idle
            </div>
          )}
        </div>

        <ProgressBar projectId={project.id} />
        <UpcomingTasks projectId={project.id} today={today} />

        {editingDL && (
          <DatePickerPopover value={project.deadline} onChange={d => updateProject(project.id, { deadline: d })} onClose={() => setEditingDL(false)} clearable anchorRef={deadlineBtnRef} />
        )}
      </div>

      {/* Subprojects tree section */}
      {(children.length > 0 || addingSub) && (
        <div className="border-t border-[#1E1E1E] bg-[#0D0D0D]">
          <button onClick={() => setExpanded(e => !e)}
            className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-bold uppercase tracking-widest text-[#888] hover:text-[#ccc] transition-colors">
            {expanded ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
            {children.length} Subproject{children.length !== 1 ? 's' : ''}
          </button>
          {expanded && (
            <div className="pb-1">
              {children.map(child => (
                <SubprojectRow key={child.id} project={child} today={today} depth={0} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add subproject */}
      <div className="border-t border-[#1A1A1A] bg-[#0D0D0D]">
        {addingSub ? (
          <div className="p-2">
            <ProjectForm label="New Subproject" compact parentColor={project.color}
              onCancel={() => setAddingSub(false)}
              onSubmit={(name, deadline, color) => {
                addProject({ name, color, deadline, parentId: project.id });
                setAddingSub(false);
              }}
            />
          </div>
        ) : (
          <button onClick={() => setAddingSub(true)}
            className="w-full flex items-center gap-1.5 px-3 py-2 text-[13px] font-bold uppercase tracking-widest text-[#777] hover:text-[#ccc] transition-colors">
            <Plus size={9} /> Add Subproject
          </button>
        )}
      </div>
    </div>
  );
}

export function MacroGoalsPanel() {
  const { projects, addProject } = useStore();
  const today = startOfToday();
  const [isCreating, setIsCreating] = useState(false);

  React.useEffect(() => { newProjectTrigger.open = () => setIsCreating(true); }, []);

  const topLevel = projects
    .filter(p => !p.parentId)
    .sort((a, b) =>
      (a.deadline && b.deadline ? new Date(a.deadline).getTime() - new Date(b.deadline).getTime() : a.deadline ? -1 : 1)
    );

  return (
    <div className="flex gap-4 p-4 border-b border-[#1E1E1E] overflow-x-auto shrink-0 items-start" style={{ background: 'var(--bg-0)' }}>
      {topLevel.map(p => (
        <div key={p.id} className="w-[280px] shrink-0">
          <MacroGoalCard project={p} today={today} />
        </div>
      ))}
      {isCreating ? (
        <div className="w-[280px] shrink-0">
          <ProjectForm label="New Goal"
            onCancel={() => setIsCreating(false)}
            onSubmit={(name, deadline, color) => {
              addProject({ name, color, deadline });
              setIsCreating(false);
            }}
          />
        </div>
      ) : (
        <button onClick={() => setIsCreating(true)}
          className="w-[280px] shrink-0 rounded-lg p-4 flex flex-col items-center justify-center gap-2 border border-dashed border-[#222] text-[#888] hover:text-[#ccc] hover:border-[#444] transition-colors min-h-[100px]">
          <Plus size={20} />
          <span className="text-xs font-bold uppercase tracking-wider">Add Goal</span>
        </button>
      )}
    </div>
  );
}