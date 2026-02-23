import React, { useState } from 'react';
import { useStore, Project, Priority } from '../store';
import { differenceInDays, parseISO, startOfToday, addDays, format } from 'date-fns';
import { cn } from '../lib/utils';
import { Clock, AlertTriangle, Plus, X } from 'lucide-react';

export function MacroGoalsPanel() {
  const { projects, addProject } = useStore();
  const today = startOfToday();
  const [isCreating, setIsCreating] = useState(false);
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalDays, setNewGoalDays] = useState('90');
  const [newGoalColor, setNewGoalColor] = useState('#F27D26');
  const [newGoalPriority, setNewGoalPriority] = useState<Priority>('Medium');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalName.trim()) return;

    const days = parseInt(newGoalDays, 10) || 90;
    
    addProject({
      name: newGoalName.trim(),
      color: newGoalColor,
      deadline: format(addDays(today, days), 'yyyy-MM-dd'),
      priority: newGoalPriority,
    });

    setNewGoalName('');
    setNewGoalDays('90');
    setNewGoalPriority('Medium');
    setIsCreating(false);
  };

  const priorityWeight = { High: 3, Medium: 2, Low: 1 };
  const sortedProjects = [...projects].sort((a, b) => {
    if (priorityWeight[a.priority] !== priorityWeight[b.priority]) {
      return priorityWeight[b.priority] - priorityWeight[a.priority];
    }
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  });

  return (
    <div className="flex gap-4 p-6 border-b border-[#2A2A2A] overflow-x-auto bg-[#0A0A0A] shrink-0 items-start">
      {sortedProjects.map(project => (
        <MacroGoalCard key={project.id} project={project} today={today} />
      ))}

      {isCreating ? (
        <form 
          onSubmit={handleCreate}
          className="min-w-[300px] rounded-lg p-4 flex flex-col gap-3 bg-[#141414] border border-[#2A2A2A]"
        >
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#8E9299]">New Macro-Goal</h3>
            <button type="button" onClick={() => setIsCreating(false)} className="text-[#555] hover:text-white">
              <X size={16} />
            </button>
          </div>
          
          <input
            type="text"
            value={newGoalName}
            onChange={(e) => setNewGoalName(e.target.value)}
            placeholder="Goal Name (e.g. Launch V1)"
            className="bg-[#0A0A0A] border border-[#2A2A2A] rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#F27D26]"
            autoFocus
          />
          
          <div className="flex gap-2">
            <div className="flex-1 flex items-center bg-[#0A0A0A] border border-[#2A2A2A] rounded px-2 py-1.5">
              <input
                type="number"
                value={newGoalDays}
                onChange={(e) => setNewGoalDays(e.target.value)}
                className="bg-transparent text-sm text-white focus:outline-none w-12 text-right"
                min="1"
              />
              <span className="text-xs text-[#8E9299] ml-2">days out</span>
            </div>
            <input
              type="color"
              value={newGoalColor}
              onChange={(e) => setNewGoalColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
            />
          </div>

          <select
            value={newGoalPriority}
            onChange={(e) => setNewGoalPriority(e.target.value as Priority)}
            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded px-2 py-1.5 text-sm text-[#8E9299] focus:outline-none focus:border-[#F27D26]"
          >
            <option value="High">High Priority</option>
            <option value="Medium">Medium Priority</option>
            <option value="Low">Low Priority</option>
          </select>

          <button 
            type="submit"
            className="w-full bg-[#2A2A2A] hover:bg-[#3A3A3A] text-white text-xs font-bold uppercase tracking-wider py-2 rounded transition-colors mt-1"
          >
            Create Goal
          </button>
        </form>
      ) : (
        <button 
          onClick={() => setIsCreating(true)}
          className="min-w-[300px] rounded-lg p-4 flex flex-col items-center justify-center gap-2 border border-dashed border-[#2A2A2A] text-[#555] hover:text-[#8E9299] hover:border-[#444] transition-colors h-[104px]"
        >
          <Plus size={24} />
          <span className="text-sm font-bold uppercase tracking-wider">Add Macro-Goal</span>
        </button>
      )}
    </div>
  );
}

function MacroGoalCard({ project, today }: { key?: React.Key; project: Project; today: Date }) {
  const { tasks, hoveredProjectId, deleteProject, updateProject } = useStore();
  const deadlineDate = parseISO(project.deadline);
  const daysRemaining = differenceInDays(deadlineDate, today);
  const isHovered = hoveredProjectId === project.id;

  // Calculate Lost Days
  const projectTasks = tasks.filter(t => t.projectId === project.id && t.date !== null);
  
  let lostDays = 0;
  if (projectTasks.length > 0) {
    // Find the most recent task date that is on or before today
    const pastOrTodayTasks = projectTasks
      .map(t => parseISO(t.date!))
      .filter(d => differenceInDays(today, d) >= 0)
      .sort((a, b) => b.getTime() - a.getTime());

    if (pastOrTodayTasks.length > 0) {
      lostDays = differenceInDays(today, pastOrTodayTasks[0]);
    } else {
      // All tasks are in the future, calculate from creation date
      const createdAt = parseISO(project.createdAt);
      lostDays = Math.max(0, differenceInDays(today, createdAt));
    }
  } else {
    // No tasks scheduled at all
    const createdAt = parseISO(project.createdAt);
    lostDays = Math.max(0, differenceInDays(today, createdAt));
  }

  // Determine urgency level
  let urgencyClass = "border-[#2A2A2A] text-[#8E9299]";
  let icon = <Clock size={16} className="text-[#8E9299]" />;
  let bgColor = "bg-[#141414]";

  if (daysRemaining < 0) {
    urgencyClass = "border-red-500 text-red-500";
    icon = <AlertTriangle size={16} className="text-red-500" />;
    bgColor = "bg-red-500/10";
  } else if (daysRemaining <= 7) {
    urgencyClass = "border-[#F27D26] text-[#F27D26] border-2 shadow-[0_0_15px_rgba(242,125,38,0.2)]";
    icon = <AlertTriangle size={16} className="text-[#F27D26]" />;
    bgColor = "bg-[#F27D26]/10";
  } else if (daysRemaining <= 30) {
    urgencyClass = "border-yellow-500 text-yellow-500";
    icon = <Clock size={16} className="text-yellow-500" />;
    bgColor = "bg-yellow-500/10";
  } else {
    urgencyClass = "border-[#3B82F6] text-[#3B82F6]";
    icon = <Clock size={16} className="text-[#3B82F6]" />;
    bgColor = "bg-[#3B82F6]/10";
  }

  const startProject = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateProject(project.id, { startedAt: new Date().toISOString() });
  };

  return (
    <div 
      className={cn(
        "min-w-[300px] rounded-lg p-4 flex flex-col gap-3 transition-all h-[104px] relative group overflow-hidden",
        "border",
        urgencyClass,
        bgColor,
        isHovered && "ring-2 ring-white scale-[1.02] shadow-xl z-10"
      )}
    >
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1 overflow-hidden pr-2">
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded shrink-0",
              project.priority === 'High' ? "bg-red-500/20 text-red-500" :
              project.priority === 'Medium' ? "bg-yellow-500/20 text-yellow-500" :
              "bg-blue-500/20 text-blue-500"
            )}>
              {project.priority}
            </span>
            {project.startedAt ? (
              <span 
                className="text-[9px] text-[#8E9299] uppercase tracking-wider font-mono shrink-0" 
                title={format(parseISO(project.startedAt), 'PPpp')}
              >
                Started {format(parseISO(project.startedAt), 'MMM d')}
              </span>
            ) : (
              <button
                onClick={startProject}
                className="text-[9px] bg-[#2A2A2A] hover:bg-[#3A3A3A] text-white px-1.5 py-0.5 rounded uppercase tracking-wider transition-colors shrink-0"
              >
                Start
              </button>
            )}
            <h3 className="text-lg font-bold tracking-tight text-white truncate ml-1">
              {project.name}
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button 
            onClick={() => deleteProject(project.id)}
            className="hidden group-hover:flex text-[#8E9299] hover:text-red-500 transition-colors"
            title="Delete goal"
          >
            <X size={14} />
          </button>
          <div 
            className="w-3 h-3 rounded-full mt-1 group-hover:hidden" 
            style={{ backgroundColor: project.color }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between mt-auto">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-2xl font-mono font-bold leading-none">
            {Math.abs(daysRemaining)}
          </span>
          <span className="text-xs uppercase tracking-wider font-semibold opacity-80 leading-none mt-1">
            {daysRemaining < 0 ? 'Days Overdue' : 'Days Left'}
          </span>
        </div>
        
        {lostDays > 0 && (
          <div className="text-[10px] font-mono uppercase tracking-wider text-red-400/80 bg-red-500/10 px-2 py-1 rounded">
            {lostDays} Lost Day{lostDays !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
