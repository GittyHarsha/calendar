new_render = """
  const activeMs = tab === 'daily' ? todayMs : tab === 'weekly' ? totalFocusMs : allTimeStats.totalMs;
  const activeDone = tab === 'daily' ? todayTasksDone : tab === 'weekly' ? tasksCompletedThisWeek : allTimeTasksDone;
  const activeSessions = tab === 'daily' ? todaySessions : tab === 'weekly' ? sessionsCompleted : allTimeStats.totalSessions;
  const activeProjects = tab === 'daily' ? dailyProjectTimes : projectTimes;
  const activeTasks = tab === 'daily' ? dailyTopTasks : topTasks;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden" style={{ background: 'var(--bg-0)', fontFamily: 'system-ui,-apple-system,sans-serif' }}>

      {/* Header */}
      <div className="shrink-0 flex items-center gap-4 px-8 h-14 border-b" style={{ borderColor: 'var(--border-1)' }}>
        <span className="text-base font-bold tracking-widest uppercase" style={{ color: 'var(--text-1)' }}>Analytics</span>
        <div className="flex items-center gap-1 bg-[#0A0A0A] rounded-lg border p-0.5 ml-4" style={{ borderColor: 'var(--border-1)' }}>
          {(['daily', 'weekly', 'alltime'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="h-7 px-4 text-xs font-bold tracking-wider uppercase rounded-md transition-all"
              style={tab === t ? { background: 'color-mix(in srgb, var(--accent) 22%, #1a1a1a)', color: 'var(--accent)' } : { color: 'var(--text-2)' }}>
              {t === 'daily' ? 'Today' : t === 'weekly' ? 'Week' : 'All Time'}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => exportTimeLogCSV(tasks, timeEntries, projects)}
            className="h-7 px-3 text-xs font-bold flex items-center gap-1.5 rounded border transition-colors hover:text-white"
            style={{ color: 'var(--text-2)', borderColor: 'var(--border-1)', background: 'var(--bg-1)' }}>
            <Download size={12} /> CSV
          </button>
          <button onClick={() => exportTimeLogJSON(tasks, timeEntries, projects)}
            className="h-7 px-3 text-xs font-bold flex items-center gap-1.5 rounded border transition-colors hover:text-white"
            style={{ color: 'var(--text-2)', borderColor: 'var(--border-1)', background: 'var(--bg-1)' }}>
            <FileJson size={12} /> JSON
          </button>
          <button onClick={handleCopyMd}
            className="h-7 px-3 text-xs font-bold flex items-center gap-1.5 rounded border transition-colors"
            style={copied ? { color: 'var(--accent)', borderColor: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)' } : { color: 'var(--text-2)', borderColor: 'var(--border-1)', background: 'var(--bg-1)' }}>
            <Copy size={12} /> {copied ? 'Copied!' : 'MD'}
          </button>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded transition-colors hover:text-white ml-2" style={{ color: 'var(--text-2)' }}>
            <X size={18} />
          </button>
        </div>
      </div>

      {/* No data */}
      {timeEntries.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ color: 'var(--text-2)' }}>
          <span className="text-4xl" style={{ color: 'var(--accent)' }}>&#9679;</span>
          <span className="text-lg font-bold" style={{ color: 'var(--text-1)' }}>No focus sessions yet</span>
          <span className="text-sm">Start a Pomodoro on any task to begin tracking time.</span>
        </div>
      )}

      {timeEntries.length > 0 && (
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">

          {/* Hero Stats */}
          <div className="grid grid-cols-3 gap-4">
            {([
              { label: 'Focus Time', value: activeMs > 0 ? fmtDuration(activeMs) : '\u2014', sub: 'total tracked', accent: true },
              { label: 'Completed', value: String(activeDone), sub: 'tasks done', accent: false },
              { label: 'Sessions', value: String(activeSessions), sub: 'pomodoros', accent: false },
            ] as { label: string; value: string; sub: string; accent: boolean }[]).map(s => (
              <div key={s.label} className="rounded-xl p-5 border" style={{ background: 'var(--bg-1)', borderColor: s.accent ? 'color-mix(in srgb, var(--accent) 35%, transparent)' : 'var(--border-1)' }}>
                <div className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: s.accent ? 'var(--accent)' : 'var(--text-2)' }}>{s.label}</div>
                <div className="text-4xl font-black leading-none mb-1.5" style={{ color: s.accent ? 'var(--accent)' : 'var(--text-1)', fontFamily: 'Consolas, monospace' }}>{s.value}</div>
                <div className="text-xs" style={{ color: 'var(--text-2)' }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* All-time bonus */}
          {tab === 'alltime' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl p-5 border" style={{ background: 'var(--bg-1)', borderColor: 'var(--border-1)' }}>
                <div className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-2)' }}>Best Day</div>
                <div className="text-2xl font-black" style={{ color: 'var(--text-1)', fontFamily: 'Consolas, monospace' }}>
                  {allTimeStats.mostProductiveDay ? format(parseISO(allTimeStats.mostProductiveDay[0]), 'EEE, MMM d') : '\u2014'}
                </div>
                {allTimeStats.mostProductiveDay && <div className="text-xs mt-1" style={{ color: 'var(--text-2)' }}>{fmtDuration(allTimeStats.mostProductiveDay[1])} focused</div>}
              </div>
              <div className="rounded-xl p-5 border" style={{ background: 'var(--bg-1)', borderColor: 'var(--border-1)' }}>
                <div className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-2)' }}>Best Streak</div>
                <div className="text-2xl font-black" style={{ color: 'var(--text-1)', fontFamily: 'Consolas, monospace' }}>
                  {allTimeStats.longestStreak > 0 ? `${allTimeStats.longestStreak} days` : '\u2014'}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-2)' }}>consecutive active days</div>
              </div>
            </div>
          )}

          {/* 2-col: Projects + Top Tasks */}
          <div className="grid grid-cols-2 gap-4">
            <AnalCard title="Time by Project">
              {activeProjects.length === 0 ? <AnalEmpty text="No tracked time yet" /> :
                activeProjects.map(({ project, ms }) => {
                  const pct = Math.round((ms / (activeProjects[0]?.ms ?? 1)) * 100);
                  const rate = projectCompletionRates[project.id];
                  return (
                    <div key={project.id} className="mb-3 last:mb-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: project.color }} />
                        <span className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--text-1)' }} title={project.name}>{project.name}</span>
                        {tab !== 'daily' && rate && rate.total > 0 && (
                          <span className="text-xs font-bold shrink-0" style={{ color: project.color }}>{Math.round((rate.completed / rate.total) * 100)}%</span>
                        )}
                        <span className="text-sm font-bold shrink-0 tabular-nums" style={{ color: 'var(--text-1)', fontFamily: 'Consolas, monospace' }}>{fmtDuration(ms)}</span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: 'var(--bg-2)' }}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: project.color }} />
                      </div>
                    </div>
                  );
                })
              }
            </AnalCard>

            <AnalCard title="Top Tasks by Time">
              {activeTasks.length === 0 ? <AnalEmpty text="No tracked time yet" /> :
                activeTasks.map(({ task, ms }, i) => {
                  const proj = projects.find(p => p.id === task.projectId);
                  return (
                    <div key={task.id} className="flex items-center gap-3 py-2.5 border-b last:border-0" style={{ borderColor: 'var(--border-1)' }}>
                      <span className="text-xs font-bold w-4 text-right shrink-0 tabular-nums" style={{ color: 'var(--text-2)', fontFamily: 'Consolas, monospace' }}>{i + 1}</span>
                      {proj && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: proj.color }} />}
                      <span className="flex-1 text-sm truncate" style={{ color: 'var(--text-1)' }} title={task.title}>{task.title}</span>
                      <span className="text-sm font-bold shrink-0 tabular-nums" style={{ color: 'var(--accent)', fontFamily: 'Consolas, monospace' }}>{fmtDuration(ms)}</span>
                    </div>
                  );
                })
              }
            </AnalCard>
          </div>

          {/* Week-over-week project trends */}
          {tab === 'weekly' && projectTrends.length > 0 && (
            <AnalCard title="Week-over-Week - Project Trends">
              <div className="grid grid-cols-2 gap-6">
                {projectTrends.map(({ project, thisWeekMs, lastWeekMs }) => {
                  const maxMs = Math.max(thisWeekMs, lastWeekMs, 1);
                  const diff = thisWeekMs - lastWeekMs;
                  return (
                    <div key={project.id}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: project.color }} />
                        <span className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--text-1)' }}>{project.name}</span>
                        <span className="text-xs font-bold tabular-nums" style={{ color: diff > 0 ? '#22c55e' : diff < 0 ? '#ef4444' : 'var(--text-2)' }}>
                          {diff > 0 ? 'up ' : diff < 0 ? 'dn ' : '= '}{diff !== 0 ? fmtDuration(Math.abs(diff)) : 'same'}
                        </span>
                      </div>
                      <div className="flex gap-2 items-end" style={{ height: 36 }}>
                        {[{ ms: lastWeekMs, label: 'last', op: 0.3 }, { ms: thisWeekMs, label: 'this', op: 1 }].map(({ ms: barMs, label, op }) => (
                          <div key={label} className="flex-1 flex flex-col items-center gap-1">
                            <div className="w-full rounded-sm" style={{ height: Math.max(4, Math.round((barMs / maxMs) * 28)), background: project.color, opacity: op }} />
                            <span className="text-[10px]" style={{ color: 'var(--text-2)' }}>{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </AnalCard>
          )}

          {/* Deadline Analysis */}
          {tab !== 'daily' && (
            <div className="space-y-4">
              <div className="text-[11px] font-bold uppercase tracking-widest pt-1" style={{ color: 'var(--text-2)' }}>Deadline Analysis</div>

              <div className="grid grid-cols-2 gap-4">
                {onTimeStats.total > 0 && (
                  <AnalCard title="On-Time Delivery">
                    <div className="flex items-center gap-6">
                      <svg width={88} height={88} viewBox="0 0 88 88" className="shrink-0">
                        <circle cx={44} cy={44} r={34} fill="none" stroke="var(--bg-2)" strokeWidth={9} />
                        <circle cx={44} cy={44} r={34} fill="none" stroke="#22c55e" strokeWidth={9}
                          strokeDasharray={`${2*Math.PI*34*onTimeStats.onTimePct/100} ${2*Math.PI*34}`}
                          strokeLinecap="round" transform="rotate(-90 44 44)"
                          style={{ transition: 'stroke-dasharray 0.8s ease' }} />
                        <circle cx={44} cy={44} r={34} fill="none" stroke="#ef4444" strokeWidth={9}
                          strokeDasharray={`${2*Math.PI*34*onTimeStats.late/onTimeStats.total} ${2*Math.PI*34}`}
                          strokeLinecap="round" strokeDashoffset={-(2*Math.PI*34*onTimeStats.onTimePct/100)}
                          transform="rotate(-90 44 44)" style={{ transition: 'stroke-dasharray 0.8s ease' }} />
                        <text x={44} y={40} textAnchor="middle" fill="var(--accent)" fontSize={15} fontWeight={900} fontFamily="Consolas,monospace">{onTimeStats.onTimePct}%</text>
                        <text x={44} y={53} textAnchor="middle" fill="var(--text-2)" fontSize={9} fontFamily="system-ui,sans-serif">on time</text>
                      </svg>
                      <div className="flex flex-col gap-2.5">
                        {[
                          { label: 'On time', count: onTimeStats.onTime, color: '#22c55e' },
                          { label: 'Late', count: onTimeStats.late, color: '#ef4444' },
                          { label: 'No deadline', count: onTimeStats.noDeadline, color: 'var(--text-2)' },
                        ].map(r => (
                          <div key={r.label} className="flex items-center gap-2.5">
                            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: r.color }} />
                            <span className="text-sm" style={{ color: 'var(--text-1)' }}>{r.label}</span>
                            <span className="text-xl font-black ml-auto tabular-nums" style={{ color: r.color, fontFamily: 'Consolas, monospace' }}>{r.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </AnalCard>
                )}

                {deadlineStats.slippedTasks.length > 0 && (
                  <AnalCard title="Deadline Slippage">
                    <div className="flex items-baseline gap-3 mb-4">
                      <span className="text-4xl font-black tabular-nums" style={{ color: '#f97316', fontFamily: 'Consolas, monospace' }}>{deadlineStats.avgDaysSlipped}d</span>
                      <span className="text-sm" style={{ color: 'var(--text-2)' }}>avg slip - <span style={{ color: 'var(--text-1)' }}>{deadlineStats.slippedTasks.length}</span> tasks shifted</span>
                    </div>
                    <div className="flex gap-2 items-end" style={{ height: 56 }}>
                      {deadlineStats.buckets.map(b => {
                        const maxC = Math.max(...deadlineStats.buckets.map(x => x.count), 1);
                        return (
                          <div key={b.label} className="flex-1 flex flex-col items-center gap-1">
                            {b.count > 0 && <span className="text-xs font-bold tabular-nums" style={{ color: '#f97316', fontFamily: 'Consolas, monospace' }}>{b.count}</span>}
                            <div className="w-full rounded-sm" style={{ height: Math.max(3, Math.round((b.count / maxC) * 36)), background: b.count > 0 ? '#f97316' : 'var(--bg-2)', opacity: b.count > 0 ? 1 : 0.3 }} />
                            <span className="text-[10px]" style={{ color: 'var(--text-2)' }}>{b.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </AnalCard>
                )}
              </div>

              {projectDeadlineHealth.length > 0 && (
                <AnalCard title="Project Deadline Health">
                  <div className="space-y-2.5">
                    {projectDeadlineHealth.map(({ project, onTime, late, overdue, active, avgSlip }) => (
                      <div key={project.id} className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: project.color }} />
                        <span className="w-32 text-sm font-medium truncate shrink-0" style={{ color: 'var(--text-1)' }} title={project.name}>{project.name}</span>
                        <div className="flex-1 flex gap-px h-5 rounded overflow-hidden">
                          {onTime > 0 && <div className="flex items-center justify-center text-[9px] font-bold text-black" style={{ flex: onTime, background: '#22c55e' }}>{onTime > 1 ? onTime : ''}</div>}
                          {late > 0 && <div className="flex items-center justify-center text-[9px] font-bold text-white" style={{ flex: late, background: '#ef4444' }}>{late > 1 ? late : ''}</div>}
                          {overdue > 0 && <div className="flex items-center justify-center text-[9px] font-bold text-white" style={{ flex: overdue, background: '#f97316' }}>{overdue > 1 ? overdue : ''}</div>}
                          {active > 0 && <div className="flex items-center justify-center text-[9px]" style={{ flex: active, background: project.color, opacity: 0.4 }}>{active > 1 ? active : ''}</div>}
                        </div>
                        {avgSlip > 0 && <span className="text-xs font-bold shrink-0 tabular-nums" style={{ color: '#f97316', fontFamily: 'Consolas, monospace' }}>+{avgSlip}d</span>}
                      </div>
                    ))}
                    <div className="flex items-center gap-4 pt-2 border-t" style={{ borderColor: 'var(--border-1)' }}>
                      {[['#22c55e', 'on time'], ['#ef4444', 'late'], ['#f97316', 'overdue'], ['var(--accent)', 'active']].map(([c, l]) => (
                        <div key={l} className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-sm" style={{ background: c }} />
                          <span className="text-[11px]" style={{ color: 'var(--text-2)' }}>{l}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </AnalCard>
              )}

              {taskDeadlineTimelines.length > 0 && (
                <AnalCard title={`Task Timelines - ${taskDeadlineTimelines.length} tracked`}>
                  <div>
                    {taskDeadlineTimelines.slice(0, 8).map(({ task, allDeadlines, current, totalSlip, status, project }) => {
                      const sc = status === 'done' ? '#22c55e' : status === 'overdue' ? '#ef4444' : 'var(--accent)';
                      return (
                        <div key={task.id} className="flex items-center gap-3 py-2.5 border-b last:border-0" style={{ borderColor: 'var(--border-1)' }}>
                          <div className="w-0.5 h-7 rounded-full shrink-0" style={{ background: sc }} />
                          {project && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: project.color }} />}
                          <span className="flex-1 text-sm truncate" style={{ color: 'var(--text-1)' }} title={task.title}>{task.title}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {allDeadlines.length > 1 && <span className="text-xs tabular-nums" style={{ color: 'var(--text-2)', fontFamily: 'Consolas, monospace' }}>{format(parseISO(allDeadlines[0]), 'MMM d')}</span>}
                            {allDeadlines.length > 1 && <span className="text-xs" style={{ color: '#f97316' }}>&rarr;</span>}
                            <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--text-1)', fontFamily: 'Consolas, monospace' }}>{current ? format(parseISO(current), 'MMM d') : '\u2014'}</span>
                          </div>
                          {totalSlip > 0 && <span className="text-xs font-bold px-1.5 py-0.5 rounded tabular-nums" style={{ background: '#f9731618', color: '#f97316', fontFamily: 'Consolas, monospace' }}>+{totalSlip}d</span>}
                          <span className="text-xs font-bold w-5 text-center" style={{ color: sc }}>{status === 'done' ? '\\u2713' : status === 'overdue' ? '!' : '\\u25cf'}</span>
                        </div>
                      );
                    })}
                    {taskDeadlineTimelines.length > 8 && <div className="text-xs pt-2" style={{ color: 'var(--text-2)' }}>+{taskDeadlineTimelines.length - 8} more tasks</div>}
                  </div>
                </AnalCard>
              )}

              {deadlineVelocity.some(w => w.count > 0) && (
                <AnalCard title="Deadline Extension Trend - 8 weeks">
                  <div className="flex items-end gap-2" style={{ height: 80 }}>
                    {deadlineVelocity.map(({ label, count, isCurrentWeek }) => {
                      const h = count === 0 ? 3 : Math.max(6, Math.round((count / maxVelocityCount) * 56));
                      return (
                        <div key={label} className="flex-1 flex flex-col items-center gap-1">
                          {count > 0 && <span className="text-xs font-bold tabular-nums" style={{ color: isCurrentWeek ? 'var(--accent)' : '#f97316', fontFamily: 'Consolas, monospace' }}>{count}</span>}
                          <div className="w-full rounded-sm" style={{ height: h, background: count === 0 ? 'var(--bg-2)' : isCurrentWeek ? 'var(--accent)' : '#f97316', opacity: count === 0 ? 0.3 : 1 }} />
                          <span className="text-[10px] text-center" style={{ color: isCurrentWeek ? 'var(--accent)' : 'var(--text-2)' }}>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                  {(() => {
                    const first = deadlineVelocity.slice(0, 4).reduce((s, w) => s + w.count, 0);
                    const second = deadlineVelocity.slice(4).reduce((s, w) => s + w.count, 0);
                    const diff = second - first;
                    return <div className="mt-3 text-sm font-semibold" style={{ color: diff > 0 ? '#ef4444' : diff < 0 ? '#22c55e' : 'var(--text-2)' }}>{diff > 0 ? 'More extensions lately - work on your planning' : diff < 0 ? 'Fewer extensions - good trend' : 'Stable extension rate'}</div>;
                  })()}
                </AnalCard>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}

function AnalCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-5" style={{ background: 'var(--bg-1)', borderColor: 'var(--border-1)' }}>
      <div className="text-[11px] font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-2)' }}>{title}</div>
      {children}
    </div>
  );
}

function AnalEmpty({ text }: { text: string }) {
  return <div className="text-sm py-2" style={{ color: 'var(--text-2)' }}>{text}</div>;
}
"""

lines = open('src/components/AnalyticsPanel.tsx', encoding='utf-8').readlines()
cut = next(i for i,l in enumerate(lines) if 'const panel: React.CSSProperties' in l)
kept = ''.join(lines[:cut])
with open('src/components/AnalyticsPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(kept + new_render)
print(f'Done. Kept {cut} lines, wrote new render.')
