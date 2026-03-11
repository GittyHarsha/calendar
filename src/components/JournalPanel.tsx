import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { format, parseISO, addDays, subDays } from 'date-fns';
import { ChevronLeft, ChevronRight, GitCompare, X, Search, BookOpen, Maximize2, Minimize2 } from 'lucide-react';
import { useStore, JournalEntry } from '../store';

// ─── Simple line-based diff ───────────────────────────────────────────────────
type DiffLine = { type: 'add' | 'remove' | 'same'; text: string };

function lineDiff(a: string, b: string): DiffLine[] {
  const aLines = a ? a.split('\n') : [];
  const bLines = b ? b.split('\n') : [];
  const result: DiffLine[] = [];

  // LCS-based diff (simple O(n*m) for short texts)
  const m = aLines.length, n = bLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      dp[i][j] = aLines[i] === bLines[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);

  let i = 0, j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && aLines[i] === bLines[j]) {
      result.push({ type: 'same', text: aLines[i] });
      i++; j++;
    } else if (j < n && (i >= m || dp[i + 1][j] >= dp[i][j + 1])) {
      result.push({ type: 'add', text: bLines[j] });
      j++;
    } else {
      result.push({ type: 'remove', text: aLines[i] });
      i++;
    }
  }
  return result;
}

// ─── Search snippet highlighter ───────────────────────────────────────────────
function highlightSnippet(text: string, query: string): React.ReactNode {
  if (!text || !query) return null;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return null;
  const start = Math.max(0, idx - 45);
  const end = Math.min(text.length, idx + query.length + 45);
  const pre = (start > 0 ? '…' : '') + text.slice(start, idx);
  const match = text.slice(idx, idx + query.length);
  const post = text.slice(idx + query.length, end) + (end < text.length ? '…' : '');
  return (
    <>{pre}<mark style={{ background: 'color-mix(in srgb, var(--accent) 28%, transparent)', color: 'var(--text-1)', borderRadius: 2, padding: '0 1px' }}>{match}</mark>{post}</>
  );
}


function fmtNavDate(dateStr: string): string {
  const d = parseISO(dateStr);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const yesterStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  if (dateStr === todayStr) return 'Today';
  if (dateStr === yesterStr) return 'Yesterday';
  return format(d, 'EEE, MMM d');
}

// ─── Task / project report for a date ────────────────────────────────────────
function fmtMs(ms: number): string {
  if (ms <= 0) return '—';
  const m = Math.round(ms / 60000);
  if (m < 1) return '<1m';
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60 > 0 ? `${m % 60}m` : ''}`.trim();
}

function DailyReport({ dateStr, tasks, projects, timeEntries }: {
  dateStr: string;
  tasks: ReturnType<typeof useStore>['tasks'];
  projects: ReturnType<typeof useStore>['projects'];
  timeEntries: ReturnType<typeof useStore>['timeEntries'];
}) {
  // Tasks scheduled for this specific day
  const scheduled = tasks.filter(t => t.date === dateStr);

  // Time entries logged on this day
  const dayEntries = timeEntries.filter(e => e.startedAt.slice(0, 10) === dateStr);
  const timeForTask = (id: string) => dayEntries.filter(e => e.taskId === id).reduce((s, e) => s + e.duration, 0);

  // Tasks completed today but not scheduled today (ad-hoc wins)
  const adHocDone = tasks.filter(t => t.completedAt === dateStr && t.date !== dateStr);

  return (
    <div className="flex flex-col gap-4 mt-1">
      {/* Scheduled tasks */}
      {scheduled.length > 0 ? (
        <section>
          <h4 style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: 8 }}>
            Tasks · {scheduled.length} scheduled
          </h4>
          <div className="flex flex-col" style={{ gap: 6 }}>
            {scheduled.map(t => {
              const proj = projects.find(p => p.id === t.projectId);
              const ms = timeForTask(t.id);
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  {/* Status */}
                  <span style={{
                    fontSize: 13, flexShrink: 0, width: 14, textAlign: 'center',
                    color: t.completed ? '#4ade80' : 'var(--text-2)',
                  }}>
                    {t.completed ? '✓' : '○'}
                  </span>
                  {/* Project dot */}
                  {proj && <span style={{ width: 6, height: 6, borderRadius: '50%', background: proj.color, flexShrink: 0, display: 'inline-block' }} />}
                  {/* Title */}
                  <span style={{
                    flex: 1, color: t.completed ? 'var(--text-2)' : 'var(--text-1)',
                    textDecoration: t.completed ? 'line-through' : 'none',
                    opacity: t.completed ? 0.6 : 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {t.title}
                  </span>
                  {/* Time spent */}
                  <span style={{ fontSize: 11, fontFamily: 'Consolas, monospace', color: ms > 0 ? 'var(--accent)' : '#444', flexShrink: 0 }}>
                    {fmtMs(ms)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <p style={{ fontSize: 12, color: '#444', fontStyle: 'italic' }}>No tasks scheduled for this day.</p>
      )}

      {/* Ad-hoc completed (not scheduled today) */}
      {adHocDone.length > 0 && (
        <section>
          <h4 style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4ade80', marginBottom: 6 }}>
            Also completed · {adHocDone.length}
          </h4>
          <div className="flex flex-col" style={{ gap: 5 }}>
            {adHocDone.map(t => {
              const proj = projects.find(p => p.id === t.projectId);
              const ms = timeForTask(t.id);
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ color: '#4ade80', flexShrink: 0, width: 14, textAlign: 'center' }}>✓</span>
                  {proj && <span style={{ width: 6, height: 6, borderRadius: '50%', background: proj.color, flexShrink: 0, display: 'inline-block' }} />}
                  <span style={{ flex: 1, color: 'var(--text-2)', textDecoration: 'line-through', opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.title}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: 'Consolas, monospace', color: ms > 0 ? 'var(--accent)' : '#444', flexShrink: 0 }}>
                    {fmtMs(ms)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Diff view ────────────────────────────────────────────────────────────────
function DiffView({ prevEntry, currEntry, prevDate, currDate, tasks, projects }: {
  prevEntry: JournalEntry | undefined;
  currEntry: JournalEntry | undefined;
  prevDate: string;
  currDate: string;
  tasks: ReturnType<typeof useStore>['tasks'];
  projects: ReturnType<typeof useStore>['projects'];
}) {
  const diff = lineDiff(prevEntry?.text ?? '', currEntry?.text ?? '');
  const hasTextChanges = diff.some(l => l.type !== 'same');

  const prevCompleted = tasks.filter(t => t.completedAt === prevDate);
  const currCompleted = tasks.filter(t => t.completedAt === currDate);
  const prevCompletedIds = new Set(prevCompleted.map(t => t.id));
  const currCompletedIds = new Set(currCompleted.map(t => t.id));
  const newlyDone = currCompleted.filter(t => !prevCompletedIds.has(t.id));
  const noLongerDone = prevCompleted.filter(t => !currCompletedIds.has(t.id));

  // Project delta
  const projDeltas = projects.filter(p => !p.parentId).map(p => {
    const pTasks = tasks.filter(t => t.projectId === p.id);
    const prevDone = pTasks.filter(t => t.completed && t.completedAt !== undefined && t.completedAt <= prevDate).length;
    const currDone = pTasks.filter(t => t.completed).length;
    const delta = currDone - prevDone;
    const total = pTasks.length;
    const prevPct = total > 0 ? Math.round((prevDone / total) * 100) : 0;
    const currPct = total > 0 ? Math.round((currDone / total) * 100) : 0;
    return { ...p, total, prevDone, currDone, delta, prevPct, currPct };
  }).filter(p => p.total > 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Text diff */}
      <section>
        <h4 style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: 6 }}>
          Journal diff · {fmtNavDate(prevDate)} → {fmtNavDate(currDate)}
        </h4>
        {!hasTextChanges && !prevEntry?.text && !currEntry?.text && (
          <p style={{ fontSize: 12, color: '#444', fontStyle: 'italic' }}>No journal entries to compare.</p>
        )}
        {!hasTextChanges && (prevEntry?.text || currEntry?.text) && (
          <p style={{ fontSize: 12, color: '#555' }}>No text changes between these days.</p>
        )}
        {hasTextChanges && (
          <div style={{ fontFamily: 'Consolas, monospace', fontSize: 12, background: 'var(--bg-1)', borderRadius: 8, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 1 }}>
            {diff.map((line, i) => (
              <div key={i} style={{
                padding: '1px 6px',
                borderRadius: 3,
                background: line.type === 'add' ? '#4ade8018' : line.type === 'remove' ? '#ef444418' : 'transparent',
                color: line.type === 'add' ? '#4ade80' : line.type === 'remove' ? '#ef4444' : 'var(--text-2)',
                whiteSpace: 'pre-wrap',
              }}>
                <span style={{ marginRight: 8, opacity: 0.5 }}>
                  {line.type === 'add' ? '+' : line.type === 'remove' ? '−' : ' '}
                </span>
                {line.text || <span style={{ opacity: 0.3 }}>{'(empty line)'}</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Task deltas */}
      {(newlyDone.length > 0 || noLongerDone.length > 0) && (
        <section>
          <h4 style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: 6 }}>
            Task changes
          </h4>
          {newlyDone.map(t => (
            <div key={t.id} style={{ fontSize: 12, color: '#4ade80', marginBottom: 3 }}>+ {t.title}</div>
          ))}
          {noLongerDone.map(t => (
            <div key={t.id} style={{ fontSize: 12, color: '#ef4444', marginBottom: 3 }}>− {t.title}</div>
          ))}
        </section>
      )}

      {/* Project deltas */}
      {projDeltas.some(p => p.delta !== 0) && (
        <section>
          <h4 style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: 6 }}>
            Project progress
          </h4>
          {projDeltas.filter(p => p.delta !== 0).map(p => (
            <div key={p.id} style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                <span style={{ color: p.color, fontWeight: 600 }}>{p.name}</span>
                <span style={{ fontFamily: 'monospace', color: p.delta > 0 ? '#4ade80' : '#ef4444' }}>
                  {p.prevPct}% → {p.currPct}% ({p.delta > 0 ? '+' : ''}{p.delta} tasks)
                </span>
              </div>
              <div style={{ height: 3, background: 'var(--border-1)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${p.currPct}%`, height: '100%', background: p.color, borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Prompt diffs */}
      {(['wins', 'blockers', 'tomorrow'] as const).map(field => {
        const labels: Record<string, string> = { wins: '🟢 Wins', blockers: '🔴 Blockers', tomorrow: '→ Tomorrow' };
        const prev = prevEntry?.[field] ?? '';
        const curr = currEntry?.[field] ?? '';
        if (!prev && !curr) return null;
        const d = lineDiff(prev, curr);
        const hasChanges = d.some(l => l.type !== 'same');
        return (
          <section key={field}>
            <h4 style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: 6 }}>
              {labels[field]} diff
            </h4>
            {!hasChanges && <p style={{ fontSize: 12, color: '#555' }}>No changes.</p>}
            {hasChanges && (
              <div style={{ fontFamily: 'Consolas, monospace', fontSize: 12, background: 'var(--bg-1)', borderRadius: 8, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 1 }}>
                {d.map((line, i) => (
                  <div key={i} style={{
                    padding: '1px 6px', borderRadius: 3,
                    background: line.type === 'add' ? '#4ade8018' : line.type === 'remove' ? '#ef444418' : 'transparent',
                    color: line.type === 'add' ? '#4ade80' : line.type === 'remove' ? '#ef4444' : 'var(--text-2)',
                    whiteSpace: 'pre-wrap',
                  }}>
                    <span style={{ marginRight: 8, opacity: 0.5 }}>{line.type === 'add' ? '+' : line.type === 'remove' ? '−' : ' '}</span>
                    {line.text || <span style={{ opacity: 0.3 }}>(empty line)</span>}
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────
export function JournalPanel({ onClose }: { onClose: () => void }) {
  const { tasks, projects, journalEntries, timeEntries, setJournalEntry } = useStore();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [dateStr, setDateStr] = useState(todayStr);
  const [showDiff, setShowDiff] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPrompts, setShowPrompts] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [draftWins, setDraftWins] = useState('');
  const [draftBlockers, setDraftBlockers] = useState('');
  const [draftTomorrow, setDraftTomorrow] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const winsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blockersTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tomorrowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const entry = journalEntries[dateStr];
  const prevDateStr = format(subDays(parseISO(dateStr), 1), 'yyyy-MM-dd');
  const prevEntry = journalEntries[prevDateStr];

  // Sync drafts when navigating dates
  useEffect(() => {
    setDraftText(entry?.text ?? '');
    setDraftWins(entry?.wins ?? '');
    setDraftBlockers(entry?.blockers ?? '');
    setDraftTomorrow(entry?.tomorrow ?? '');
    setShowDiff(false);
  }, [dateStr, entry?.text, entry?.wins, entry?.blockers, entry?.tomorrow]);

  // Focus search input when search opens
  useEffect(() => {
    if (showSearch) searchInputRef.current?.focus();
  }, [showSearch]);

  // Escape to exit maximize
  useEffect(() => {
    if (!isMaximized) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsMaximized(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isMaximized]);

  // Search results
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return Object.values(journalEntries)
      .filter(e => [e.text, e.wins, e.blockers, e.tomorrow].join(' ').toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [journalEntries, searchQuery]);

  const writingStreak = useMemo(() => {
    let streak = 0;
    for (let i = 0; ; i++) {
      const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
      if (journalEntries[d]?.text?.trim()) streak++;
      else break;
    }
    return streak;
  }, [journalEntries]);

  const saveText = useCallback((text: string) => {
    setJournalEntry(dateStr, { text });
  }, [dateStr, setJournalEntry]);

  const saveWins = useCallback((wins: string) => {
    setJournalEntry(dateStr, { wins });
  }, [dateStr, setJournalEntry]);

  const saveBlockers = useCallback((blockers: string) => {
    setJournalEntry(dateStr, { blockers });
  }, [dateStr, setJournalEntry]);

  const saveTomorrow = useCallback((tomorrow: string) => {
    setJournalEntry(dateStr, { tomorrow });
  }, [dateStr, setJournalEntry]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setDraftText(val);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveText(val), 600);
  };

  const makePromptHandler = (
    setter: (v: string) => void,
    timer: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
    saver: (v: string) => void,
  ) => (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setter(val);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => saver(val), 600);
  };

  const handleWinsChange = makePromptHandler(setDraftWins, winsTimer, saveWins);
  const handleBlockersChange = makePromptHandler(setDraftBlockers, blockersTimer, saveBlockers);
  const handleTomorrowChange = makePromptHandler(setDraftTomorrow, tomorrowTimer, saveTomorrow);

  const isFuture = dateStr > todayStr;

  const panel = (
    <div
      data-no-inbox-close
      className="flex flex-col"
      style={isMaximized
        ? { position: 'fixed', inset: 0, zIndex: 50, background: 'var(--bg-0)', width: '100%', height: '100%' }
        : { background: 'var(--bg-0)', maxHeight: '78vh', minWidth: 420, width: 480 }
      }
    >
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px 8px', borderBottom: '1px solid var(--border-1)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Date navigation */}
          <button onClick={() => setDateStr(format(subDays(parseISO(dateStr), 1), 'yyyy-MM-dd'))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', padding: '2px 4px', borderRadius: 4 }}
            title="Previous day">
            <ChevronLeft size={14} />
          </button>

          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'Consolas, monospace', color: 'var(--text-1)', minWidth: 110, textAlign: 'center' }}>
            {fmtNavDate(dateStr)}
          </span>

          <button onClick={() => setDateStr(format(addDays(parseISO(dateStr), 1), 'yyyy-MM-dd'))}
            disabled={dateStr >= todayStr}
            style={{ background: 'none', border: 'none', cursor: dateStr >= todayStr ? 'not-allowed' : 'pointer', color: dateStr >= todayStr ? '#333' : 'var(--text-2)', padding: '2px 4px', borderRadius: 4 }}>
            <ChevronRight size={14} />
          </button>

          {dateStr !== todayStr && (
            <button onClick={() => setDateStr(todayStr)}
              style={{ fontSize: 10, fontFamily: 'Consolas, monospace', background: 'none', border: '1px solid #333', color: '#888', borderRadius: 4, padding: '1px 6px', cursor: 'pointer' }}>
              today
            </button>
          )}
          {writingStreak >= 1 && (
            <span style={{ fontSize: 10, fontFamily: 'Consolas, monospace', color: '#4ade80' }}>
              ✍ {writingStreak}d
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => { setShowPrompts(p => !p); setShowDiff(false); setShowSearch(false); }}
            title={showPrompts ? 'Hide prompts' : 'Show reflection prompts'}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontFamily: 'Consolas, monospace',
              background: showPrompts ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'none',
              border: `1px solid ${showPrompts ? 'var(--accent)' : '#333'}`,
              color: showPrompts ? 'var(--accent)' : '#666',
              borderRadius: 5, padding: '2px 7px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
            <BookOpen size={11} />
            Prompts
          </button>
          <button
            onClick={() => { setShowSearch(s => !s); setSearchQuery(''); setShowDiff(false); }}
            title={showSearch ? 'Close search' : 'Search journal entries'}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontFamily: 'Consolas, monospace',
              background: showSearch ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'none',
              border: `1px solid ${showSearch ? 'var(--accent)' : '#333'}`,
              color: showSearch ? 'var(--accent)' : '#666',
              borderRadius: 5, padding: '2px 7px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
            <Search size={11} />
            Search
          </button>
          <button
            onClick={() => setShowDiff(d => !d)}
            title={showDiff ? 'Hide diff' : `Compare with ${fmtNavDate(prevDateStr)}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontFamily: 'Consolas, monospace',
              background: showDiff ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'none',
              border: `1px solid ${showDiff ? 'var(--accent)' : '#333'}`,
              color: showDiff ? 'var(--accent)' : '#666',
              borderRadius: 5, padding: '2px 7px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
            <GitCompare size={11} />
            Diff
          </button>
          <button
            onClick={() => setIsMaximized(m => !m)}
            title={isMaximized ? 'Minimize (Esc)' : 'Maximize'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 2, borderRadius: 4 }}>
            {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 2, borderRadius: 4 }}>
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── Search mode ── */}
        {showSearch ? (
          <>
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { setShowSearch(false); setSearchQuery(''); } }}
              placeholder="Search your journal…"
              style={{
                width: '100%', background: 'var(--bg-1)', border: '1px solid var(--border-1)',
                borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--text-1)',
                fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border-1)')}
            />
            {!searchQuery.trim() && (
              <p style={{ fontSize: 12, color: '#444', fontStyle: 'italic', margin: 0 }}>
                Type to search across all entries.
              </p>
            )}
            {searchQuery.trim() && searchResults.length === 0 && (
              <p style={{ fontSize: 12, color: '#444', fontStyle: 'italic', margin: 0 }}>No matches found.</p>
            )}
            <div className="flex flex-col gap-2">
              {searchResults.map(e => {
                const allText = [e.text, e.wins, e.blockers, e.tomorrow].filter(Boolean).join(' ');
                const snippet = highlightSnippet(allText, searchQuery.trim());
                return (
                  <button
                    key={e.date}
                    onClick={() => { setDateStr(e.date); setShowSearch(false); setSearchQuery(''); }}
                    style={{
                      background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 8,
                      padding: '8px 12px', cursor: 'pointer', textAlign: 'left',
                      display: 'flex', flexDirection: 'column', gap: 4,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-1)')}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'Consolas, monospace', color: 'var(--accent)' }}>
                      {fmtNavDate(e.date)} · {format(parseISO(e.date), 'MMM d, yyyy')}
                    </span>
                    {snippet && (
                      <span style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>{snippet}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {/* Journal text editor or diff */}
            {showDiff ? (
              <DiffView
                prevEntry={prevEntry}
                currEntry={entry}
                prevDate={prevDateStr}
                currDate={dateStr}
                tasks={tasks}
                projects={projects}
              />
            ) : (
              <>
                {/* Reflection prompts */}
                {showPrompts && !isFuture && (
                  <div className="flex flex-col gap-3">
                    {([
                      { label: '🟢 Wins', placeholder: 'What went well today?', value: draftWins, onChange: handleWinsChange, onBlur: () => { if (winsTimer.current) { clearTimeout(winsTimer.current); } saveWins(draftWins); } },
                      { label: '🔴 Blockers', placeholder: 'What got in the way?', value: draftBlockers, onChange: handleBlockersChange, onBlur: () => { if (blockersTimer.current) { clearTimeout(blockersTimer.current); } saveBlockers(draftBlockers); } },
                      { label: '→ Tomorrow', placeholder: 'Top priority for tomorrow', value: draftTomorrow, onChange: handleTomorrowChange, onBlur: () => { if (tomorrowTimer.current) { clearTimeout(tomorrowTimer.current); } saveTomorrow(draftTomorrow); } },
                    ] as const).map(({ label, placeholder, value, onChange, onBlur }) => (
                      <div key={label}>
                        <div style={{ fontSize: 10, fontFamily: 'Consolas, monospace', color: '#666', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          {label}
                        </div>
                        <textarea
                          value={value}
                          onChange={onChange}
                          onBlur={onBlur}
                          placeholder={placeholder}
                          rows={2}
                          style={{
                            width: '100%', background: 'var(--bg-1)', border: '1px solid var(--border-1)',
                            borderRadius: 6, padding: '7px 10px', fontSize: 12, color: 'var(--text-1)',
                            fontFamily: 'inherit', resize: 'vertical', outline: 'none', lineHeight: 1.5,
                            boxSizing: 'border-box',
                          }}
                          onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                          onBlur={e => (e.target.style.borderColor = 'var(--border-1)')}
                        />
                      </div>
                    ))}
                    <div style={{ borderTop: '1px solid var(--border-1)', marginTop: 2 }} />
                  </div>
                )}

                <textarea
                  ref={textareaRef}
                  value={draftText}
                  onChange={handleTextChange}
                  placeholder={isFuture ? 'You cannot journal future dates.' : showPrompts ? 'Free notes…' : "What's on your mind today?"}
                  disabled={isFuture}
                  style={{
                    width: '100%', minHeight: showPrompts ? 100 : isMaximized ? 300 : 160, background: 'var(--bg-1)', border: '1px solid var(--border-1)',
                    borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--text-1)',
                    fontFamily: 'inherit', resize: 'vertical', outline: 'none', lineHeight: 1.6,
                    boxSizing: 'border-box', opacity: isFuture ? 0.4 : 1,
                  }}
                  onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={e => { e.target.style.borderColor = 'var(--border-1)'; if (saveTimer.current) { clearTimeout(saveTimer.current); saveText(draftText); } }}
                />
                <div style={{ fontSize: 10, color: '#444', fontFamily: 'Consolas, monospace', marginTop: -8 }}>
                  auto-saves · {draftText.trim().split(/\s+/).filter(Boolean).length} words
                </div>

                {/* Divider */}
                <div style={{ borderTop: '1px solid var(--border-1)', marginTop: 4 }} />

                {/* Daily report */}
                <h3 style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#555', margin: 0 }}>
                  Activity Report · {fmtNavDate(dateStr)}
                </h3>
                <DailyReport dateStr={dateStr} tasks={tasks} projects={projects} timeEntries={timeEntries} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );

  return isMaximized ? ReactDOM.createPortal(panel, document.body) : panel;
}
