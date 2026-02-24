import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { addDays, format, startOfToday, parseISO, addMonths } from 'date-fns';

export type Priority = 'High' | 'Medium' | 'Low';
export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';

export type Project = {
  id: string;
  name: string;
  color: string;
  deadline?: string | null; // ISO date string, optional
  createdAt: string;
  priority: Priority;
  startedAt?: string | null;
  parentId?: string | null; // null/undefined = top-level project, set = subproject
};

export type Task = {
  id: string;
  projectId: string | null;
  title: string;
  date: string | null;      // work date — which day it appears on the calendar
  deadline: string | null;  // due date — when it must be done by (optional)
  deadlineHistory: string[]; // previous deadlines, oldest first — tracks procrastination
  completed: boolean;
  startedAt?: string | null;
  priority?: Priority;
  description?: string;
};

type EpochState = {
  projects: Project[];
  tasks: Task[];
  thinkPadNotes: string;
  hoveredProjectId: string | null;
  hideCompleted: boolean;
  
  // Actions
  addProject: (project: Omit<Project, 'id' | 'createdAt'>) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  
  addTask: (task: Omit<Task, 'id' | 'completed'>, recurrence?: Recurrence, startDate?: string) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  
  setThinkPadNotes: (notes: string) => void;
  setHoveredProjectId: (id: string | null) => void;
  toggleHideCompleted: () => void;
};

const today = startOfToday();

// Initial dummy data to show the concept
const initialProjects: Project[] = [
  {
    id: 'p1',
    name: 'Launch V1 of SaaS App',
    color: '#F27D26', // Urgent orange
    deadline: format(addDays(today, 45), 'yyyy-MM-dd'),
    createdAt: format(today, 'yyyy-MM-dd'),
    priority: 'High',
    startedAt: null,
  },
  {
    id: 'p2',
    name: 'Write Research Paper',
    color: '#3B82F6', // Blue
    deadline: format(addDays(today, 80), 'yyyy-MM-dd'),
    createdAt: format(today, 'yyyy-MM-dd'),
    priority: 'Medium',
    startedAt: null,
  }
];

const initialTasks: Task[] = [
  { id: 't1', projectId: 'p1', title: 'DB schema design', date: format(addDays(today, 1), 'yyyy-MM-dd'), deadline: format(addDays(today, 10), 'yyyy-MM-dd'), deadlineHistory: [], completed: false, startedAt: null },
  { id: 't2', projectId: 'p1', title: 'Auth implementation', date: format(addDays(today, 3), 'yyyy-MM-dd'), deadline: format(addDays(today, 14), 'yyyy-MM-dd'), deadlineHistory: [], completed: false, startedAt: null },
  { id: 't3', projectId: 'p1', title: 'UI design', date: null, deadline: null, deadlineHistory: [], completed: false, startedAt: null },
  { id: 't4', projectId: 'p2', title: 'Literature review', date: format(addDays(today, 5), 'yyyy-MM-dd'), deadline: format(addDays(today, 20), 'yyyy-MM-dd'), deadlineHistory: [], completed: false, startedAt: null },
  { id: 't5', projectId: null, title: 'Buy groceries', date: format(today, 'yyyy-MM-dd'), deadline: null, deadlineHistory: [], completed: false, startedAt: null },
];

export const useStore = create<EpochState>()(
  persist(
    (set) => ({
  projects: initialProjects,
  tasks: initialTasks,
  thinkPadNotes: 'Brainstorming:\n- Need to figure out the landing page copy.\n- Ask Sarah about the API integration.',
  hoveredProjectId: null,
  hideCompleted: false,
  
  addProject: (project) => set((state) => ({
    projects: [...state.projects, { ...project, id: crypto.randomUUID(), createdAt: format(startOfToday(), 'yyyy-MM-dd'), startedAt: project.startedAt || null }]
  })),
  
  updateProject: (id, updates) => set((state) => ({
    projects: state.projects.map(p => p.id === id ? { ...p, ...updates } : p)
  })),
  
  deleteProject: (id) => set((state) => {
    // Collect the project and all descendants recursively
    const toDelete = new Set<string>();
    const collect = (pid: string) => {
      toDelete.add(pid);
      state.projects.filter(p => p.parentId === pid).forEach(c => collect(c.id));
    };
    collect(id);
    return {
      projects: state.projects.filter(p => !toDelete.has(p.id)),
      tasks: state.tasks.map(t => toDelete.has(t.projectId ?? '') ? { ...t, projectId: null } : t),
    };
  }),
  
  addTask: (task, recurrence = 'none', startDate) => set((state) => {
    const baseTask = { ...task, startedAt: task.startedAt || null, deadlineHistory: task.deadlineHistory ?? [] };
    if (recurrence === 'none' || !startDate) {
      return { tasks: [...state.tasks, { ...baseTask, id: crypto.randomUUID(), completed: false }] };
    }
    
    const newTasks: Task[] = [];
    let currentDate = parseISO(startDate);
    const endDate = addDays(startOfToday(), 90);
    
    let count = 0;
    while (currentDate <= endDate && count < 100) {
      newTasks.push({
        ...baseTask,
        id: crypto.randomUUID(),
        date: format(currentDate, 'yyyy-MM-dd'),
        completed: false,
      });
      
      if (recurrence === 'daily') {
        currentDate = addDays(currentDate, 1);
      } else if (recurrence === 'weekly') {
        currentDate = addDays(currentDate, 7);
      } else if (recurrence === 'monthly') {
        currentDate = addMonths(currentDate, 1);
      }
      count++;
    }
    
    return { tasks: [...state.tasks, ...newTasks] };
  }),
  
  updateTask: (id, updates) => set((state) => ({
    tasks: state.tasks.map(t => {
      if (t.id !== id) return t;
      // Track deadline shift: if deadline is being changed to a later date, record old one
      if (updates.deadline !== undefined && updates.deadline !== t.deadline && t.deadline) {
        const isShiftingLater = updates.deadline && new Date(updates.deadline) > new Date(t.deadline);
        if (isShiftingLater) {
          return { ...t, ...updates, deadlineHistory: [...(t.deadlineHistory ?? []), t.deadline] };
        }
      }
      return { ...t, ...updates };
    })
  })),
  
  deleteTask: (id) => set((state) => ({
    tasks: state.tasks.filter(t => t.id !== id)
  })),
  
      setThinkPadNotes: (notes) => set({ thinkPadNotes: notes }),
      setHoveredProjectId: (id) => set({ hoveredProjectId: id }),
      toggleHideCompleted: () => set((state) => ({ hideCompleted: !state.hideCompleted })),
    }),
    {
      name: 'calendar-storage',
      // hoveredProjectId is transient — don't persist it
      partialize: (state) => ({
        projects: state.projects,
        tasks: state.tasks,
        thinkPadNotes: state.thinkPadNotes,
        hideCompleted: state.hideCompleted,
      }),
    }
  )
);
