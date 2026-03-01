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
  sessionStart: string | null; // ISO — when current work/break phase started (adjusted for pauses)
  sessionsCompleted: number;   // total 🍅 this app session
  paused: boolean;
  pausedElapsed: number;       // ms elapsed before current pause
};

export const WORK_DURATION  = 25 * 60 * 1000;
export const BREAK_DURATION =  5 * 60 * 1000;

export type ThemeKey = 'void' | 'dusk' | 'ember' | 'moss' | 'dawn';

export type ThemeConfig = {
  name: string;
  accent: string;
  bg0: string; bg1: string; bg2: string;
  border: string;
  text1: string; text2: string;
};

/** Derive a full dark theme config from any hex accent color */
export function deriveThemeFromAccent(hex: string): ThemeConfig {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0;
  if (max !== min) {
    const d = max - min;
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  const hd = Math.round(h * 360);
  const hsl = (hue: number, s: number, l: number) => `hsl(${hue},${s}%,${l}%)`;
  return {
    name: 'Custom',
    accent: hex,
    bg0: hsl(hd, 15, 4),
    bg1: hsl(hd, 12, 6),
    bg2: hsl(hd, 10, 10),
    border: hsl(hd, 15, 14),
    text1: hsl(hd, 10, 94),
    text2: hsl(hd, 8, 42),
  };
}

export const THEMES: Record<ThemeKey, ThemeConfig> = {
  void:   { name: 'Void',  accent: '#FF7B2F', bg0: '#080808', bg1: '#0F0F0F', bg2: '#191919', border: '#252525', text1: '#F0EDEA', text2: '#686868' },
  dusk:   { name: 'Dusk',  accent: '#A78BFA', bg0: '#080B1C', bg1: '#0F1328', bg2: '#171C3C', border: '#242854', text1: '#DDDEFF', text2: '#6870B0' },
  ember:  { name: 'Ember', accent: '#FF6B35', bg0: '#120600', bg1: '#1C0B00', bg2: '#2C1500', border: '#482200', text1: '#FFE4CC', text2: '#A85028' },
  moss:   { name: 'Moss',  accent: '#2FD96A', bg0: '#040E06', bg1: '#071408', bg2: '#0D1E10', border: '#143A18', text1: '#D0F5DA', text2: '#3A7848' },
  dawn:   { name: 'Dawn',  accent: '#DC4A0E', bg0: '#EEE8DF', bg1: '#F8F4EE', bg2: '#EDE8E2', border: '#CFC7BC', text1: '#1A1714', text2: '#5C5248' },
};

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
  theme: ThemeKey;
  customAccent: string | null;
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
  startPomodoro: (taskId: string | null) => void;
  pausePomodoro: () => void;
  stopPomodoro: () => void;
  completeWorkSession: () => void;
  startBreak: () => void;
  skipBreak: () => void;
  getTaskTime: (taskId: string) => number;
  getProjectTime: (projectId: string) => number;

  setTheme: (theme: ThemeKey) => void;
  setCustomAccent: (hex: string | null) => void;
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
  pomodoro: { taskId: null, phase: 'idle', sessionStart: null, sessionsCompleted: 0, paused: false, pausedElapsed: 0 },
  theme: 'void' as ThemeKey,
  customAccent: null,
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
  startPomodoro: (taskId) => set((state) => ({
    pomodoro: { taskId, phase: 'work', sessionStart: new Date().toISOString(), sessionsCompleted: state.pomodoro.sessionsCompleted, paused: false, pausedElapsed: 0 }
  })),

  pausePomodoro: () => set((state) => {
    const { pomodoro } = state;
    if (pomodoro.phase === 'idle') return {};
    if (pomodoro.paused) {
      // Resume: shift sessionStart forward by the time we were paused
      // so elapsed = Date.now() - sessionStart stays correct
      const elapsed = pomodoro.pausedElapsed;
      const newStart = new Date(Date.now() - elapsed).toISOString();
      return { pomodoro: { ...pomodoro, paused: false, sessionStart: newStart } };
    } else {
      // Pause: record how many ms have elapsed so far
      const elapsed = pomodoro.sessionStart
        ? Date.now() - new Date(pomodoro.sessionStart).getTime()
        : 0;
      return { pomodoro: { ...pomodoro, paused: true, pausedElapsed: elapsed } };
    }
  }),

  stopPomodoro: () => set((state) => {
    const { pomodoro } = state;
    const entries = [...state.timeEntries];
    if (pomodoro.phase === 'work' && pomodoro.sessionStart && pomodoro.taskId) {
      const endedAt = new Date().toISOString();
      const duration = Date.now() - new Date(pomodoro.sessionStart).getTime();
      if (duration >= 5000) entries.push({ id: crypto.randomUUID(), taskId: pomodoro.taskId, startedAt: pomodoro.sessionStart, endedAt, duration });
    }
    return { pomodoro: { taskId: null, phase: 'idle', sessionStart: null, sessionsCompleted: pomodoro.sessionsCompleted, paused: false, pausedElapsed: 0 }, timeEntries: entries };
  }),

  completeWorkSession: () => set((state) => {
    const { pomodoro } = state;
    if (pomodoro.phase !== 'work' || !pomodoro.sessionStart) return {};
    const endedAt = new Date().toISOString();
    const duration = Date.now() - new Date(pomodoro.sessionStart).getTime();
    const newEntries = pomodoro.taskId
      ? [...state.timeEntries, { id: crypto.randomUUID(), taskId: pomodoro.taskId, startedAt: pomodoro.sessionStart, endedAt, duration }]
      : state.timeEntries; // eye rest — no time entry
    return {
      pomodoro: { ...pomodoro, phase: 'break', sessionStart: null, sessionsCompleted: pomodoro.sessionsCompleted + 1 },
      timeEntries: newEntries,
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

      setTheme: (theme) => set({ theme, customAccent: null }),
      setCustomAccent: (hex) => set({ customAccent: hex }),
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
        theme: state.theme,
        customAccent: state.customAccent,
        thinkPadNotes: state.thinkPadNotes,
        hideCompleted: state.hideCompleted,
        pomodoro: state.pomodoro,
      }),
    }
  )
);
