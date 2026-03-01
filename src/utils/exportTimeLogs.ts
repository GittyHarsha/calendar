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
