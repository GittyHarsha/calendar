import React, { useState } from 'react';
import { useStore, Project, Priority } from '../store';
import { differenceInDays, parseISO, startOfToday, addDays, format } from 'date-fns';
import { cn } from '../lib/utils';
import { Clock, AlertTriangle, Plus, X, ChevronDown, ChevronRight, Pencil } from 'lucide-react';

export const newProjectTrigger = { open: () => {} };

function urgencyStyles(days: number | null) {
  if (days === null) return { border: 'border-[#2A2A2A]', text: 'text-[#555]', bg: 'bg-[#141414]', icon: null };
  if (days < 0)   return { border: 'border-red-500',     text: 'text-red-500',     bg: 'bg-red-500/10',    icon: <AlertTriangle size={14} className="text-red-500" /> };
  if (days <= 7)  return { border: 'border-[#F27D26] border-2 shadow-[0_0_12px_rgba(242,125,38,0.2)]', text: 'text-[#F27D26]', bg: 'bg-[#F27D26]/10', icon: <AlertTriangle size={14} className="text-[#F27D26]" /> };
  if (days <= 30) return { border: 'border-yellow-500',  text: 'text-yellow-500',  bg: 'bg-yellow-500/10', icon: <Clock size={14} className="text-yellow-500" /> };
  return                 { border: 'border-[#3B82F6]',   text: 'text-[#3B82F6]',   bg: 'bg-[#3B82F6]/10',  icon: <Clock size={14} className="text-[#3B82F6]" /> };
}

const PRIORITY_NEXT: Record<Priority, Priority> = { High: 'Medium', Medium: 'Low', Low: 'High' };
const PRIORITY_CLASS: Record<Priority, string> = {
  High: 'bg-red-500/20 text-red-500',
  Medium: 'bg-yellow-500/20 text-yellow-500',
  Low: 'bg-blue-500/20 text-blue-500',
};

function ProgressBar({ projectId }: { projectId: string }) {
  const { tasks } = useStore();
  const all = tasks.filter(t => t.projectId === projectId);
  const done = all.filter(t => t.completed).length;
  const pct = all.length > 0 ? (done / all.length) * 100 : 0;
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1 bg-[#2A2A2A] rounded-full overflow-hidden">
        <div className="h-full bg-green-500/70 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-[#555] shrink-0">{done}/{all.length}</span>
    </div>
  );
}

function ProjectForm({
  label, initial, parentColor, compact = false, onSubmit, onCancel,
}: {
  label: string;
  initial?: { name?: string; deadline?: string | null; color?: string; priority?: Priority };
  parentColor?: string;
  compact?: boolean;
  onSubmit: (name: string, deadline: string | null, color: string, priority: Priority) => void;
  onCancel: () => void;
}) {
  const today = startOfToday();
  const [name, setName] = useState(initial?.name ?? '');
  const [deadline, setDeadline] = useState<string>(initial?.deadline ?? format(new Date(), 'yyyy-MM-dd'));
  const [color, setColor] = useState(initial?.color ?? parentColor ?? '#3B82F6');
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? 'Medium');

  const handle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim(), deadline || null, color, priority);
  };

  return (
    <form onSubmit={handle} className={cn('flex flex-col gap-2 rounded-lg bg-[#141414] border border-[#2A2A2A]', compact ? 'p-3' : 'p-4')}>
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E9299]">{label}</span>
        <button type="button" onClick={onCancel} className="text-[#555] hover:text-white"><X size={13} /></button>
      </div>
      <input type="text" autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Name…"
        className="bg-[#0A0A0A] border border-[#2A2A2A] rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#F27D26]" />
      <div className="flex flex-col gap-1">
        <div className="flex gap-1 items-center">
          <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
            placeholder="No deadline"
            className="flex-1 bg-[#0A0A0A] border border-[#2A2A2A] rounded px-2 py-1.5 text-sm text-[#8E9299] focus:outline-none focus:border-[#F27D26]" />
          {deadline && (
            <button type="button" onClick={() => setDeadline('')} className="text-[#555] hover:text-red-400 transition-colors" title="Clear deadline">
              <X size={13} />
            </button>
          )}
        </div>
        <div className="flex gap-1">
          {[30, 60, 90, 180].map(d => (
            <button key={d} type="button" onClick={() => setDeadline(format(addDays(today, d), 'yyyy-MM-dd'))}
              className="flex-1 text-[10px] bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[#8E9299] rounded py-1 transition-colors">+{d}d</button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 items-center">
        <select value={priority} onChange={e => setPriority(e.target.value as Priority)}
          className="flex-1 bg-[#0A0A0A] border border-[#2A2A2A] rounded px-2 py-1.5 text-xs text-[#8E9299] focus:outline-none">
          <option value="High">High Priority</option>
          <option value="Medium">Medium Priority</option>
          <option value="Low">Low Priority</option>
        </select>
        <input type="color" value={color} onChange={e => setColor(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent" title="Pick color" />
      </div>
      <button type="submit" className="bg-[#2A2A2A] hover:bg-[#3A3A3A] text-white text-xs font-bold uppercase tracking-wider py-1.5 rounded transition-colors">
        {initial?.name ? 'Save Changes' : 'Create'}
      </button>
    </form>
  );
}

function SubProjectCard({ project, today }: { project: Project; today: Date; key?: React.Key }) {
  const { deleteProject, updateProject, hoveredProjectId } = useStore();
  const [editing, setEditing] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(project.name);
  const [editingDL, setEditingDL] = useState(false);

  const days = project.deadline ? differenceInDays(parseISO(project.deadline), today) : null;
  const { border, text, bg, icon } = urgencyStyles(days);
  const isHovered = hoveredProjectId === project.id;

  const saveName = () => {
    if (nameVal.trim()) updateProject(project.id, { name: nameVal.trim() });
    else setNameVal(project.name);
    setEditingName(false);
  };

  if (editing) {
    return (
      <ProjectForm label="Edit Subproject" compact
        initial={{ name: project.name, deadline: project.deadline, color: project.color, priority: project.priority }}
        onCancel={() => setEditing(false)}
        onSubmit={(name, deadline, color, priority) => { updateProject(project.id, { name, deadline, color, priority }); setEditing(false); }}
      />
    );
  }

  return (
    <div className={cn('flex items-center gap-2 rounded-md px-3 py-2 border group transition-all', border, bg, isHovered && 'ring-1 ring-white/30')}>
      <label className="w-2.5 h-2.5 rounded-full shrink-0 cursor-pointer block" style={{ backgroundColor: project.color }} title="Click to change color">
        <input type="color" value={project.color} onChange={e => updateProject(project.id, { color: e.target.value })} className="sr-only" />
      </label>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn('text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded shrink-0 cursor-pointer hover:opacity-70', PRIORITY_CLASS[project.priority])}
            onClick={() => updateProject(project.id, { priority: PRIORITY_NEXT[project.priority] })} title="Click to change priority">
            {project.priority}
          </span>
          {editingName ? (
            <input autoFocus value={nameVal} onChange={e => setNameVal(e.target.value)} onBlur={saveName}
              onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setNameVal(project.name); setEditingName(false); } }}
              className="text-sm font-semibold text-white bg-[#0A0A0A] border border-[#F27D26] rounded px-1 focus:outline-none flex-1 min-w-0" />
          ) : (
            <span className="text-sm font-semibold text-white truncate cursor-pointer hover:underline"
              onClick={() => setEditingName(true)} title="Click to edit name">{project.name}</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {icon}
          {editingDL ? (
            <input type="date" autoFocus value={project.deadline ?? ''}
              onChange={e => updateProject(project.id, { deadline: e.target.value || null })}
              onBlur={() => setEditingDL(false)}
              onKeyDown={e => { if (e.key === 'Escape' || e.key === 'Enter') setEditingDL(false); }}
              className="text-xs bg-[#0A0A0A] border border-[#F27D26] rounded px-1 text-white focus:outline-none" />
          ) : (
            <span className={cn('text-xs font-mono font-bold cursor-pointer hover:underline', text)}
              onClick={() => setEditingDL(true)} title="Click to set deadline">
              {days === null ? 'No deadline' : Math.abs(days)}
            </span>
          )}
          {days !== null && <span className="text-[10px] text-[#555] uppercase">{days < 0 ? 'overdue' : 'days left'}</span>}
        </div>
        <ProgressBar projectId={project.id} />
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => setEditing(true)} className="hidden group-hover:flex text-[#555] hover:text-[#8E9299] transition-colors" title="Edit"><Pencil size={11} /></button>
        <button onClick={() => deleteProject(project.id)} className="hidden group-hover:flex text-[#555] hover:text-red-500 transition-colors"><X size={12} /></button>
      </div>
    </div>
  );
}

function MacroGoalCard({ project, today, expanded, onToggle }: { project: Project; today: Date; expanded: boolean; onToggle: () => void; key?: React.Key }) {
  const { tasks, hoveredProjectId, deleteProject, updateProject } = useStore();
  const [editing, setEditing] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(project.name);
  const [editingDL, setEditingDL] = useState(false);

  const daysRemaining = project.deadline ? differenceInDays(parseISO(project.deadline), today) : null;
  const isHovered = hoveredProjectId === project.id;
  const { border, text, bg, icon } = urgencyStyles(daysRemaining);

  const projectTasks = tasks.filter(t => t.projectId === project.id && t.date !== null);
  let lostDays = 0;
  if (projectTasks.length > 0) {
    const past = projectTasks.map(t => parseISO(t.date!)).filter(d => differenceInDays(today, d) >= 0).sort((a, b) => b.getTime() - a.getTime());
    lostDays = past.length > 0 ? differenceInDays(today, past[0]) : Math.max(0, differenceInDays(today, parseISO(project.createdAt)));
  } else {
    lostDays = Math.max(0, differenceInDays(today, parseISO(project.createdAt)));
  }

  const saveName = () => {
    if (nameVal.trim()) updateProject(project.id, { name: nameVal.trim() });
    else setNameVal(project.name);
    setEditingName(false);
  };

  if (editing) {
    return (
      <ProjectForm label="Edit Macro-Goal"
        initial={{ name: project.name, deadline: project.deadline, color: project.color, priority: project.priority }}
        onCancel={() => setEditing(false)}
        onSubmit={(name, deadline, color, priority) => { updateProject(project.id, { name, deadline, color, priority }); setEditing(false); }}
      />
    );
  }

  return (
    <div className={cn('rounded-lg p-4 flex flex-col gap-2 transition-all relative group border', border, bg, isHovered && 'ring-2 ring-white scale-[1.01] shadow-xl z-10')}>
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1 flex-1 overflow-hidden pr-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded shrink-0 cursor-pointer hover:opacity-70', PRIORITY_CLASS[project.priority])}
              onClick={() => updateProject(project.id, { priority: PRIORITY_NEXT[project.priority] })} title="Click to change priority">
              {project.priority}
            </span>
            {project.startedAt ? (
              <span className="text-[9px] text-[#8E9299] uppercase tracking-wider font-mono shrink-0" title={format(parseISO(project.startedAt), 'PPpp')}>
                Started {format(parseISO(project.startedAt), 'MMM d')}
              </span>
            ) : (
              <button onClick={e => { e.stopPropagation(); updateProject(project.id, { startedAt: new Date().toISOString() }); }}
                className="text-[9px] bg-[#2A2A2A] hover:bg-[#3A3A3A] text-white px-1.5 py-0.5 rounded uppercase tracking-wider transition-colors shrink-0">
                Start
              </button>
            )}
            {editingName ? (
              <input autoFocus value={nameVal} onChange={e => setNameVal(e.target.value)} onBlur={saveName}
                onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setNameVal(project.name); setEditingName(false); } }}
                className="text-lg font-bold text-white bg-[#0A0A0A] border border-[#F27D26] rounded px-2 focus:outline-none flex-1" />
            ) : (
              <h3 className="text-lg font-bold tracking-tight text-white truncate ml-1 cursor-pointer hover:underline"
                onClick={() => setEditingName(true)} title="Click to edit name">{project.name}</h3>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => setEditing(true)} className="hidden group-hover:flex text-[#555] hover:text-[#8E9299] transition-colors" title="Edit project"><Pencil size={13} /></button>
          <button onClick={() => deleteProject(project.id)} className="hidden group-hover:flex text-[#8E9299] hover:text-red-500 transition-colors"><X size={14} /></button>
          <button onClick={onToggle} className="text-[#555] hover:text-[#8E9299] transition-colors">{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
          <label className="w-3 h-3 rounded-full mt-0.5 cursor-pointer block group-hover:hidden" style={{ backgroundColor: project.color }} title="Click to change color">
            <input type="color" value={project.color} onChange={e => updateProject(project.id, { color: e.target.value })} className="sr-only" />
          </label>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          {editingDL ? (
            <input type="date" autoFocus value={project.deadline ?? ''}
              onChange={e => updateProject(project.id, { deadline: e.target.value || null })}
              onBlur={() => setEditingDL(false)}
              onKeyDown={e => { if (e.key === 'Escape' || e.key === 'Enter') setEditingDL(false); }}
              className="text-sm bg-[#0A0A0A] border border-[#F27D26] rounded px-2 py-0.5 text-white focus:outline-none" />
          ) : (
            <span className={cn('text-2xl font-mono font-bold leading-none cursor-pointer hover:underline', daysRemaining === null ? 'text-[#555]' : text)}
              onClick={() => setEditingDL(true)} title="Click to set deadline">
              {daysRemaining === null ? '—' : Math.abs(daysRemaining)}
            </span>
          )}
          <span className="text-xs uppercase tracking-wider font-semibold opacity-80 leading-none mt-1">
            {daysRemaining === null ? 'No deadline' : daysRemaining < 0 ? 'Days Overdue' : 'Days Left'}
          </span>
        </div>
        {lostDays > 0 && (
          <div className="text-[10px] font-mono uppercase tracking-wider text-red-400/80 bg-red-500/10 px-2 py-1 rounded">
            {lostDays} Lost Day{lostDays !== 1 ? 's' : ''}
          </div>
        )}
      </div>
      <ProgressBar projectId={project.id} />
    </div>
  );
}

function ProjectGroup({ project, today }: { project: Project; today: Date; key?: React.Key }) {
  const { projects, addProject } = useStore();
  const [expanded, setExpanded] = useState(true);
  const [addingSub, setAddingSub] = useState(false);
  const subprojects = projects.filter(p => p.parentId === project.id);

  return (
    <div className="flex flex-col gap-1.5 w-[300px] shrink-0">
      <MacroGoalCard project={project} today={today} expanded={expanded} onToggle={() => setExpanded(e => !e)} />
      {expanded && (
        <>
          {subprojects.length > 0 && (
            <div className="flex flex-col gap-1 ml-3 pl-3 border-l border-[#2A2A2A]">
              {subprojects.map(sp => <SubProjectCard key={sp.id} project={sp} today={today} />)}
            </div>
          )}
          {addingSub ? (
            <div className="ml-3 pl-3 border-l border-[#2A2A2A]">
              <ProjectForm label="New Subproject" compact parentColor={project.color}
                onCancel={() => setAddingSub(false)}
                onSubmit={(name, deadline, color, priority) => {
                  addProject({ name, color, priority, deadline, parentId: project.id, startedAt: null });
                  setAddingSub(false);
                }}
              />
            </div>
          ) : (
            <button onClick={() => setAddingSub(true)}
              className="ml-3 pl-3 border-l border-[#2A2A2A] flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#555] hover:text-[#8E9299] transition-colors py-1">
              <Plus size={11} /> Add Subproject
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function MacroGoalsPanel() {
  const { projects, addProject } = useStore();
  const today = startOfToday();
  const [isCreating, setIsCreating] = useState(false);

  React.useEffect(() => { newProjectTrigger.open = () => setIsCreating(true); }, []);

  const priorityWeight = { High: 3, Medium: 2, Low: 1 };
  const topLevel = projects
    .filter(p => !p.parentId)
    .sort((a, b) =>
      priorityWeight[b.priority] - priorityWeight[a.priority] ||
      (a.deadline && b.deadline ? new Date(a.deadline).getTime() - new Date(b.deadline).getTime() : a.deadline ? -1 : 1)
    );

  return (
    <div className="flex gap-4 p-6 border-b border-[#2A2A2A] overflow-x-auto bg-[#0A0A0A] shrink-0 items-start">
      {topLevel.map(p => <ProjectGroup key={p.id} project={p} today={today} />)}
      {isCreating ? (
        <div className="w-[300px] shrink-0">
          <ProjectForm label="New Macro-Goal"
            onCancel={() => setIsCreating(false)}
            onSubmit={(name, deadline, color, priority) => {
              addProject({ name, color, priority, deadline, startedAt: null });
              setIsCreating(false);
            }}
          />
        </div>
      ) : (
        <button onClick={() => setIsCreating(true)}
          className="w-[300px] shrink-0 rounded-lg p-4 flex flex-col items-center justify-center gap-2 border border-dashed border-[#2A2A2A] text-[#555] hover:text-[#8E9299] hover:border-[#444] transition-colors h-[104px]">
          <Plus size={24} />
          <span className="text-sm font-bold uppercase tracking-wider">Add Macro-Goal</span>
        </button>
      )}
    </div>
  );
}
