import { Task, TimeEntry, Project } from '../store';
import { format, parseISO } from 'date-fns';

export function exportTimeLogCSV(tasks: Task[], timeEntries: TimeEntry[], projects: Project[]): void {
  const header = 'Task,Project,Date,Duration (min),StartedAt,EndedAt';
  const rows = timeEntries.map(e => {
    const task = tasks.find(t => t.id === e.taskId);
    const project = task?.projectId ? projects.find(p => p.id === task.projectId) : null;
    const taskTitle = task?.title ?? '';
    const projectName = project?.name ?? '';
    const date = format(parseISO(e.startedAt), 'yyyy-MM-dd');
    const durationMin = Math.round(e.duration / 60000);
    const csvEscape = (s: string) => `"${s.replace(/"/g, '""')}"`;
    return [csvEscape(taskTitle), csvEscape(projectName), date, durationMin, e.startedAt, e.endedAt].join(',');
  });

  const csv = [header, ...rows].join('\n');
  const filename = `horizon-timelog-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  const uri = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;

  const link = document.createElement('a');
  link.setAttribute('href', uri);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportTimeLogJSON(tasks: Task[], timeEntries: TimeEntry[], projects: Project[]): void {
  const entries = timeEntries.map(e => {
    const task = tasks.find(t => t.id === e.taskId);
    const project = task?.projectId ? projects.find(p => p.id === task.projectId) : null;
    return {
      task: task?.title ?? '',
      project: project?.name ?? '',
      startedAt: e.startedAt,
      endedAt: e.endedAt,
      durationMs: e.duration,
      durationMin: Math.round(e.duration / 60000),
    };
  });

  const data = {
    exportedAt: new Date().toISOString(),
    totalDurationMs: timeEntries.reduce((s, e) => s + e.duration, 0),
    entries,
  };

  const json = JSON.stringify(data, null, 2);
  const filename = `horizon-timelog-${format(new Date(), 'yyyy-MM-dd')}.json`;
  const uri = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;

  const link = document.createElement('a');
  link.setAttribute('href', uri);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function copyMarkdownSummary(tasks: Task[], timeEntries: TimeEntry[], projects: Project[]): Promise<void> {
  const projectMap = new Map<string, { name: string; ms: number; sessions: number }>();

  for (const e of timeEntries) {
    const task = tasks.find(t => t.id === e.taskId);
    const project = task?.projectId ? projects.find(p => p.id === task.projectId) : null;
    const key = project?.id ?? '__none__';
    const name = project?.name ?? 'No Project';
    if (!projectMap.has(key)) projectMap.set(key, { name, ms: 0, sessions: 0 });
    const entry = projectMap.get(key)!;
    entry.ms += e.duration;
    entry.sessions += 1;
  }

  const sorted = Array.from(projectMap.values()).sort((a, b) => b.ms - a.ms);
  const totalMs = timeEntries.reduce((s, e) => s + e.duration, 0);
  const totalSessions = timeEntries.length;

  const fmtMs = (ms: number) => {
    const m = Math.floor(ms / 60000);
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  };

  const dateStr = format(new Date(), 'MMM d, yyyy');
  const rows = sorted.map(({ name, ms, sessions }) => `| ${name} | ${fmtMs(ms)} | ${sessions} |`).join('\n');

  const md = [
    `## Horizon Focus Summary — ${dateStr}`,
    '',
    '| Project | Time | Sessions |',
    '|---------|------|----------|',
    rows,
    '',
    `**Total:** ${fmtMs(totalMs)} across ${totalSessions} sessions`,
  ].join('\n');

  await navigator.clipboard.writeText(md);
}
