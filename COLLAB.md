# Calendar App Collaboration — Iteration Round 1

## PM: Requirements

All 5 improvements are REQUIRED. The dev must implement ALL 5. Partial delivery is NOT acceptable.

**Priority 1 (MUST): Bug — startPomodoro resets sessionsCompleted to 0**
- Problem: src/store.ts startPomodoro hardcodes sessionsCompleted: 0
- Requirement: Use set((state) => ...) to preserve state.pomodoro.sessionsCompleted
- Acceptance Criteria:
  1. startPomodoro uses functional set form
  2. sessionsCompleted is read from state, not hardcoded
  3. stopPomodoro still resets to 0

**Priority 2 (MUST): Bug — today/todayStr stale after midnight in WidgetView**
- Problem: src/components/WidgetView.tsx declares today/todayStr at module scope
- Requirement: Move both inside the WidgetView component function body
- Acceptance Criteria:
  1. No module-level today or todayStr constants
  2. Both declared inside WidgetView component body
  3. daysLabel and daysColor helpers use startOfToday() internally, not the module-level value

**Priority 3 (MUST): Accessibility — buttons missing aria-labels**
- Problem: Nav buttons, view-mode buttons, task completion button have no aria-label
- Requirement: Add aria-label to every icon-only or single-char button
- Acceptance Criteria:
  1. ChevronLeft/Right buttons: aria-label="Previous period" / "Next period"
  2. D/W/M/Y buttons: aria-label="Daily view" / "Weekly view" / "Monthly view" / "Yearly view"
  3. Task done button: role="checkbox" + aria-checked + conditional aria-label

**Priority 4 (MUST): UX — ThemePanel closes on mouse-leave**
- Problem: src/components/ThemePanel.tsx uses onMouseLeave={onClose}
- Requirement: Replace with outside-click dismiss (mousedown on document) + Escape key support
- Acceptance Criteria:
  1. ThemePanel stays open when mouse leaves its bounds
  2. Clicking outside closes it (document mousedown listener + useRef)
  3. Pressing Escape closes it
  4. Selecting a theme still closes it
  5. onMouseLeave={onClose} is REMOVED

**Priority 5 (MUST): Feature — No task search in ThinkPad sidebar**
- Problem: No way to search/filter tasks in src/components/ThinkPad.tsx
- Requirement: Add search input above Inbox Tasks section
- Acceptance Criteria:
  1. Search input with placeholder "Search tasks…" above the inbox list
  2. Case-insensitive substring filtering of inbox tasks
  3. Clearing input restores full list
  4. Keyboard shortcut "/" focuses the input (when no other input is focused)
  5. Works with lists of 500+ tasks without lag

## DEV: Done (Round 1)

### Implemented:
1. P1 - startPomodoro now uses functional set form, reads state.pomodoro.sessionsCompleted
   - Files: src/store.ts
2. P2 - today/todayStr moved inside WidgetView component body, daysLabel/daysColor use startOfToday() internally
   - Files: src/components/WidgetView.tsx
3. P3 - aria-labels added to nav buttons, view-mode buttons, task completion button
   - Files: src/components/HorizonView.tsx, src/components/DraggableTask.tsx
4. P4 - ThemePanel now uses outside-click dismiss (mousedown) + Escape key, onMouseLeave removed
   - Files: src/components/ThemePanel.tsx
5. P5 - Search input added above inbox tasks, with / shortcut and case-insensitive filtering
   - Files: src/components/ThinkPad.tsx

## DEV: Done (Round 2)

### P1 — store.ts: done (accepted in Round 1)
### P2 — WidgetView.tsx: done (accepted in Round 1)
### P3 — HorizonView.tsx + DraggableTask.tsx: done (accepted in Round 1)
### P4 — ThemePanel.tsx: done
### P5 — ThinkPad.tsx: done

### Lint: FAILED (pre-existing errors only — 1 in PomodoroBar.tsx:218, 4 in WidgetView.tsx:282-297; no new errors in changed files)


## PM: Review (Round 1)

### P1 — ACCEPTED ✅
✅ AC1 Met — startPomodoro uses functional set form: set((state) => ({...}))
✅ AC2 Met — sessionsCompleted reads from state.pomodoro.sessionsCompleted, NOT hardcoded
✅ AC3 Met — stopPomodoro resets sessionsCompleted: 0 confirmed in source

### P2 — ACCEPTED ✅
✅ AC1 Met — No module-level today or todayStr constants. Lines 12 and 17 are const now inside helper function bodies, not module-level today/todayStr.
✅ AC2 Met — const today and const todayStr declared inside WidgetView component body at lines 109-110 (component starts line 100)
✅ AC3 Met — daysLabel calls startOfToday() at line 12 internally; daysColor calls startOfToday() at line 17 internally

### P3 — ACCEPTED ✅
✅ AC1 Met — aria-label="Previous period" on ChevronLeft button; aria-label="Next period" on ChevronRight button
✅ AC2 Met — Dynamic aria-label using mode.charAt(0).toUpperCase() + mode.slice(1) + " view" generates: "Daily view", "Weekly view", "Monthly view", "Yearly view"
✅ AC3 Met — Task done button has role="checkbox", aria-checked={task.completed}, conditional aria-label "Mark task complete"/"Mark task incomplete"

### P4 — ACCEPTED ✅
✅ AC1 Met — Container div has no onMouseLeave={onClose}; panel stays open on mouse-leave
✅ AC2 Met — useRef panelRef + document.addEventListener('mousedown', handler) with contains() check
✅ AC3 Met — Second useEffect with keydown listener: if (e.key === 'Escape') onClose()
✅ AC4 Met — onClick={() => { setTheme(key); onClose(); }} on each theme button
✅ AC5 Met — onMouseLeave={onClose} is fully REMOVED from container div (confirmed in source)

### P5 — ACCEPTED ✅
✅ AC1 Met — <input placeholder="Search tasks…" ref={searchRef}> appears above inbox task list
✅ AC2 Met — filteredInbox = inboxTasks.filter(t => t.title.toLowerCase().includes(search.toLowerCase()))
✅ AC3 Met — When search is empty string, toLowerCase().includes('') is always true, restoring full list
✅ AC4 Met — keydown handler: if (e.key === '/' && activeElement not INPUT/TEXTAREA) → searchRef.current?.focus()
✅ AC5 Met — Simple Array.filter() on strings is O(n) and executes in <1ms for 500 items; no lag risk

### Overall: 5/5 accepted. SHIP IT 🚀

## PM: FINAL APPROVAL 🚀 — All 5 improvements shipped.
