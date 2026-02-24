import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { addDays, format, startOfToday, parseISO, addMonths } from 'date-fns';

export type Priority = 'High' | 'Medium' | 'Low';
export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';

export type Project = {
  id: string;
  name: string;
  color: string;
  deadline?: string | null;
  createdAt: string;
  priority: Priority;
  startedAt?: string | null;
  parentId?: string | null;
};

export type Task = {
  id: string;
  projectId: string | null;
  title: string;
  date: string | null;
  deadline: string | null;
  deadlineHistory: string[];
  completed: boolean;
  startedAt?: string | null;
  priority?: Priority;
  description?: string;
};

export type TimeEntry = {
  id: string;
  taskId: string;
  startedAt: string; // ISO timestamp
  endedAt: string;   // ISO timestamp
  duration: number;  // ms
};

export type PomodoroPhase = 'idle' | 'work' | 'break';

export type PomodoroState = {
  taskId: string | null;
  phase: PomodoroPhase;
  sessionStart: string | null; // ISO — when current work/break phase started
  sessionsCompleted: number;   // total 🍅 this app session
};

export const WORK_DURATION  = 25 * 60 * 1000;
export const BREAK_DURATION =  5 * 60 * 1000;

/** Format ms as "Xh Ym" or "Ym" */
export function fmtDuration(ms: number): string {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

type EpochState = {
  projects: Project[];
  tasks: Task[];
  timeEntries: TimeEntry[];
  pomodoro: PomodoroState;
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

  // Pomodoro + time tracking
  startPomodoro: (taskId: string) => void;
  pausePomodoro: () => void;   // stops current session, saves partial time entry
  stopPomodoro: () => void;    // fully stop, save time entry
  completeWorkSession: () => void; // 25m up → transition to break phase
  startBreak: () => void;
  skipBreak: () => void;       // skip break, start new work session immediately
  getTaskTime: (taskId: string) => number; // total ms for a task
  getProjectTime: (projectId: string) => number;
  
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
    (set, get) => ({
  projects: initialProjects,
  tasks: initialTasks,
  timeEntries: [],
  pomodoro: { taskId: null, phase: 'idle', sessionStart: null, sessionsCompleted: 0 },
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

  // ── Pomodoro ─────────────────────────────────────────────────────────────
  startPomodoro: (taskId) => set({
    pomodoro: { taskId, phase: 'work', sessionStart: new Date().toISOString(), sessionsCompleted: 0 }
  }),

  pausePomodoro: () => set((state) => {
    const { pomodoro } = state;
    if (pomodoro.phase !== 'work' || !pomodoro.sessionStart || !pomodoro.taskId) return {};
    const endedAt = new Date().toISOString();
    const duration = Date.now() - new Date(pomodoro.sessionStart).getTime();
    if (duration < 5000) return { pomodoro: { ...pomodoro, phase: 'idle', sessionStart: null } };
    return {
      pomodoro: { ...pomodoro, phase: 'idle', sessionStart: null },
      timeEntries: [...state.timeEntries, { id: crypto.randomUUID(), taskId: pomodoro.taskId, startedAt: pomodoro.sessionStart, endedAt, duration }],
    };
  }),

  stopPomodoro: () => set((state) => {
    const { pomodoro } = state;
    const entries = [...state.timeEntries];
    if (pomodoro.phase === 'work' && pomodoro.sessionStart && pomodoro.taskId) {
      const endedAt = new Date().toISOString();
      const duration = Date.now() - new Date(pomodoro.sessionStart).getTime();
      if (duration >= 5000) entries.push({ id: crypto.randomUUID(), taskId: pomodoro.taskId, startedAt: pomodoro.sessionStart, endedAt, duration });
    }
    return { pomodoro: { taskId: null, phase: 'idle', sessionStart: null, sessionsCompleted: 0 }, timeEntries: entries };
  }),

  completeWorkSession: () => set((state) => {
    const { pomodoro } = state;
    if (pomodoro.phase !== 'work' || !pomodoro.sessionStart || !pomodoro.taskId) return {};
    const endedAt = new Date().toISOString();
    const duration = Date.now() - new Date(pomodoro.sessionStart).getTime();
    return {
      pomodoro: { ...pomodoro, phase: 'break', sessionStart: null, sessionsCompleted: pomodoro.sessionsCompleted + 1 },
      timeEntries: [...state.timeEntries, { id: crypto.randomUUID(), taskId: pomodoro.taskId, startedAt: pomodoro.sessionStart, endedAt, duration }],
    };
  }),

  startBreak: () => set((state) => ({
    pomodoro: { ...state.pomodoro, phase: 'break', sessionStart: new Date().toISOString() }
  })),

  skipBreak: () => set((state) => ({
    pomodoro: { ...state.pomodoro, phase: 'work', sessionStart: new Date().toISOString() }
  })),

  getTaskTime: (taskId) => {
    const entries = get().timeEntries.filter(e => e.taskId === taskId);
    const running = get().pomodoro;
    let extra = 0;
    if (running.phase === 'work' && running.taskId === taskId && running.sessionStart) {
      extra = Date.now() - new Date(running.sessionStart).getTime();
    }
    return entries.reduce((s, e) => s + e.duration, 0) + extra;
  },

  getProjectTime: (projectId) => {
    const taskIds = get().tasks.filter(t => t.projectId === projectId).map(t => t.id);
    return get().timeEntries.filter(e => taskIds.includes(e.taskId)).reduce((s, e) => s + e.duration, 0);
  },

      setThinkPadNotes: (notes) => set({ thinkPadNotes: notes }),
      setHoveredProjectId: (id) => set({ hoveredProjectId: id }),
      toggleHideCompleted: () => set((state) => ({ hideCompleted: !state.hideCompleted })),
    }),
    {
      name: 'calendar-storage',
      partialize: (state) => ({
        projects: state.projects,
        tasks: state.tasks,
        timeEntries: state.timeEntries,
        thinkPadNotes: state.thinkPadNotes,
        hideCompleted: state.hideCompleted,
      }),
    }
  )
);
