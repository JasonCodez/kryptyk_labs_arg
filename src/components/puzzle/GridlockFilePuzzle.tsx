'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  applyGridlockSelection,
  clearGridlockSelection,
  createInitialGridlockState,
  getGridlockPuzzleSignature,
  gridlockAnswerValues,
  gridlockStorageKey,
  isGridlockStateComplete,
  restoreGridlockProgress,
  serializeGridlockState,
  setGridlockValue,
  validateGridlockData,
  type GridlockPersistenceScope,
  type GridlockPlayerState,
  type GridlockPuzzleData,
  type GridlockPlayerStatus,
} from '@/lib/gridlockCore';
import {
  addPendingRewards,
  getAnonId,
  getAnonSolved,
  getAnonStreak,
  setAnonSolved,
  updateAnonStreak,
} from '@/lib/gridlockAnon';

export interface GridlockPresentationState {
  status: GridlockPlayerStatus;
  elapsedMs: number;
  selectedCount: number;
  requiredCount: number;
  attemptsUsed: number;
  maximumAttempts: number;
  completionPending: boolean;
  rulePanelOpen: boolean;
}

export interface GridlockPuzzleHandle {
  openHelp: () => void;
  requestReset: () => void;
  focusBoard: () => void;
}

export interface GridlockFilePuzzleProps {
  puzzleId: string;
  onSolved?: () => void;
  guestMode?: boolean;
  hideHeader?: boolean;
  prelaunch?: boolean;
  requireStart?: boolean;
  mode?: 'catalog' | 'daily' | 'warz' | 'preview';
  persistenceScope?: GridlockPersistenceScope;
  dailyIdentity?: string | number;
  displayMode?: 'standalone' | 'app-shell';
  clientPuzzleData?: unknown;
  preview?: boolean;
  onPresentationChange?: (state: GridlockPresentationState) => void;
}

interface GridlockServerState {
  puzzle: unknown;
  solved?: boolean;
  submissionCount?: number;
  hintsUsed?: number;
  ruleExplanation?: string | null;
  retentionUnlock?: string | null;
}

interface GridlockSubmitResult {
  correct: boolean;
  error?: string;
  alreadySolved?: boolean;
  submissionCount?: number;
  rank?: string;
  ruleExplanation?: string;
  retentionUnlock?: string;
  xpReward?: number;
  pointsReward?: number;
  arcDay?: number;
}

const ONBOARDING_KEY = 'gridlock:onboarding:v1';

function createSubmissionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `gridlock-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function selectedCount(state: GridlockPlayerState): number {
  return state.answer.mode === 'selection'
    ? state.answer.cellIds.length
    : state.answer.values.filter(value => value.trim()).length;
}

function formatTime(elapsedMs: number): string {
  const seconds = Math.floor(elapsedMs / 1000);
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

const GridlockFilePuzzle = forwardRef<GridlockPuzzleHandle, GridlockFilePuzzleProps>(function GridlockFilePuzzle({
  puzzleId,
  onSolved,
  guestMode = false,
  hideHeader = false,
  requireStart = false,
  mode = guestMode ? 'daily' : 'catalog',
  persistenceScope,
  dailyIdentity,
  displayMode = 'standalone',
  clientPuzzleData,
  preview = false,
  onPresentationChange,
}, forwardedRef) {
  const [data, setData] = useState<GridlockPuzzleData | null>(null);
  const [player, setPlayer] = useState<GridlockPlayerState>(() => ({
    ...createInitialGridlockState({ answerMode: 'selection', grid: [] }, 'loading'),
    focusedCellId: null,
  }));
  const [started, setStarted] = useState(!requireStart);
  const [helpOpen, setHelpOpen] = useState(false);
  const [loadFailure, setLoadFailure] = useState<string | null>(null);
  const [serverState, setServerState] = useState<GridlockServerState | null>(null);
  const [declassifiedRule, setDeclassifiedRule] = useState<string | null>(null);
  const [completionAnimating, setCompletionAnimating] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const submitInFlight = useRef(false);
  const completionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveScope: GridlockPersistenceScope = preview || mode === 'warz' || mode === 'preview'
    ? 'none'
    : persistenceScope ?? (mode === 'daily' || guestMode ? 'daily' : 'catalog');
  const effectiveDailyIdentity = dailyIdentity ?? (mode === 'daily' || guestMode ? new Date().toISOString().slice(0, 10) : undefined);

  const load = useCallback(async () => {
    setLoadFailure(null);
    setPlayer(current => ({ ...current, status: 'loading', message: '' }));
    try {
      let responseState: GridlockServerState;
      if (clientPuzzleData != null) {
        responseState = { puzzle: clientPuzzleData, solved: false };
      } else {
        const endpoint = guestMode
          ? `/api/gridlock/guest/${encodeURIComponent(puzzleId)}/state`
          : `/api/puzzles/${encodeURIComponent(puzzleId)}/gridlock/state`;
        const response = await fetch(endpoint, { cache: 'no-store' });
        const body = await response.json().catch(() => ({})) as GridlockServerState & { error?: string };
        if (!response.ok) throw new Error(body.error || 'Unable to open this file.');
        responseState = body;
      }

      const validation = validateGridlockData(responseState.puzzle, {
        requireAnswers: false,
        requireRuleExplanation: false,
      });
      if (!validation.valid || !validation.normalized) {
        const message = validation.errors[0]?.message || 'This file has an invalid grid configuration.';
        setLoadFailure(message);
        setPlayer(current => ({ ...current, status: 'config-error', message }));
        return;
      }

      const puzzle = validation.normalized;
      const solved = Boolean(responseState.solved || (guestMode && getAnonSolved()[puzzleId]));
      let initial = createInitialGridlockState(puzzle, solved ? 'won' : 'ready');
      if (!solved && typeof window !== 'undefined') {
        initial = restoreGridlockProgress({
          storage: window.localStorage,
          scope: effectiveScope,
          puzzleId,
          dailyIdentity: effectiveDailyIdentity,
          data: puzzle,
        }) ?? initial;
      }
      initial.attemptsUsed = Math.max(initial.attemptsUsed, responseState.submissionCount ?? 0);
      if (!solved && initial.attemptsUsed >= puzzle.maximumAttempts) {
        initial.status = 'failed';
        initial.message = 'Maximum attempts reached. This file is locked.';
      }
      initial.hintsUsed = initial.hintsUsed.length
        ? initial.hintsUsed
        : puzzle.hints?.slice(0, responseState.hintsUsed ?? 0).map(hint => hint.id) ?? [];
      if (solved) initial.message = 'File already declassified.';
      setServerState(responseState);
      setData(puzzle);
      setPlayer(initial);
      setDeclassifiedRule(responseState.ruleExplanation ?? null);

      if (!solved && typeof window !== 'undefined' && window.localStorage.getItem(ONBOARDING_KEY) !== 'seen') {
        setHelpOpen(true);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load this file.';
      setLoadFailure(message);
      setPlayer(current => ({ ...current, status: 'network-error', message }));
    }
  }, [clientPuzzleData, effectiveDailyIdentity, effectiveScope, guestMode, puzzleId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => () => { if (completionTimer.current) clearTimeout(completionTimer.current); }, []);

  useEffect(() => {
    if (!started || !data || !['ready', 'playing', 'completion-pending'].includes(player.status)) return;
    const timer = setInterval(() => setPlayer(current => ({ ...current, elapsedMs: current.elapsedMs + 1000 })), 1000);
    return () => clearInterval(timer);
  }, [data, player.status, started]);

  useEffect(() => {
    if (!data || typeof window === 'undefined') return;
    const key = gridlockStorageKey(effectiveScope, puzzleId, effectiveDailyIdentity);
    if (!key) return;
    if (player.status === 'won') {
      window.localStorage.removeItem(key);
      return;
    }
    if (!['ready', 'playing', 'completion-pending', 'network-error', 'failed'].includes(player.status)) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(serializeGridlockState(player, getGridlockPuzzleSignature(data))));
    } catch { /* Storage may be unavailable in private browsing. */ }
  }, [data, effectiveDailyIdentity, effectiveScope, player, puzzleId]);

  useEffect(() => {
    if (!data || !onPresentationChange) return;
    onPresentationChange({
      status: player.status,
      elapsedMs: player.elapsedMs,
      selectedCount: selectedCount(player),
      requiredCount: data.answerMode === 'selection' ? data.requiredSelections : player.answer.mode === 'value-entry' ? player.answer.values.length : 0,
      attemptsUsed: player.attemptsUsed,
      maximumAttempts: data.maximumAttempts,
      completionPending: player.completionPending,
      rulePanelOpen: player.rulePanelOpen,
    });
  }, [data, onPresentationChange, player]);

  const requestReset = useCallback(() => {
    if (!data || player.status === 'won') return;
    const hasProgress = selectedCount(player) > 0 || player.hintsUsed.length > 0;
    if (hasProgress && !window.confirm('Clear this Gridlock attempt? This cannot be undone.')) return;
    setPlayer(current => ({ ...clearGridlockSelection(createInitialGridlockState(data, 'playing')), elapsedMs: current.elapsedMs }));
  }, [data, player]);

  useImperativeHandle(forwardedRef, () => ({
    openHelp: () => setHelpOpen(true),
    requestReset,
    focusBoard: () => boardRef.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus(),
  }), [requestReset]);

  const closeHelp = useCallback(() => {
    setHelpOpen(false);
    try { window.localStorage.setItem(ONBOARDING_KEY, 'seen'); } catch {}
    requestAnimationFrame(() => boardRef.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus());
  }, []);

  useEffect(() => {
    if (!helpOpen) return;
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelectorAll<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])');
    focusable?.[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeHelp(); return; }
      if (event.key !== 'Tab' || !focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [closeHelp, helpOpen]);

  const moveFocus = useCallback((cellId: string, key: string, metaKey: boolean) => {
    if (!data) return;
    const cells = data.grid.flat();
    const current = cells.find(cell => cell.id === cellId);
    if (!current) return;
    let row = current.row;
    let column = current.column;
    if (key === 'ArrowLeft') column--;
    if (key === 'ArrowRight') column++;
    if (key === 'ArrowUp') row--;
    if (key === 'ArrowDown') row++;
    if (key === 'Home') { row = metaKey ? 0 : current.row; column = 0; }
    if (key === 'End') { row = metaKey ? data.rows - 1 : current.row; column = data.columns - 1; }
    const target = data.grid[row]?.[column];
    if (!target) return;
    setPlayer(state => ({ ...state, focusedCellId: target.id }));
    requestAnimationFrame(() => boardRef.current?.querySelector<HTMLElement>(`[data-cell-id="${CSS.escape(target.id)}"]`)?.focus());
  }, [data]);

  const handleCellKey = useCallback((event: ReactKeyboardEvent<HTMLElement>, cellId: string) => {
    if (event.key === '?') { event.preventDefault(); setHelpOpen(true); return; }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      moveFocus(cellId, event.key, event.metaKey || event.ctrlKey);
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && data?.answerMode === 'selection') {
      event.preventDefault();
      setPlayer(state => applyGridlockSelection(state, data, cellId));
    }
  }, [data, moveFocus]);

  const submit = useCallback(async () => {
    if (!data || preview || submitInFlight.current || player.status === 'won' || player.status === 'failed') return;
    if (!isGridlockStateComplete(player, data)) {
      setPlayer(current => ({ ...current, message: data.answerMode === 'selection'
        ? `Select ${data.requiredSelections - selectedCount(current)} more cell${data.requiredSelections - selectedCount(current) === 1 ? '' : 's'}.`
        : 'Complete every open cell before checking.' }));
      return;
    }
    const submissionId = player.pendingSubmissionId ?? createSubmissionId();
    submitInFlight.current = true;
    setPlayer(current => ({ ...current, status: 'checking', completionPending: true, pendingSubmissionId: submissionId, message: 'Checking the evidence…' }));
    try {
      const endpoint = guestMode
        ? `/api/gridlock/guest/${encodeURIComponent(puzzleId)}/submit`
        : `/api/puzzles/${encodeURIComponent(puzzleId)}/gridlock/submit`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: gridlockAnswerValues(player.answer),
          elapsedSeconds: Math.floor(player.elapsedMs / 1000),
          submissionId,
          ...(guestMode ? { submissionCount: player.attemptsUsed + 1, anonId: getAnonId() } : {}),
        }),
      });
      const result = await response.json().catch(() => ({})) as GridlockSubmitResult;
      if (response.status === 429) {
        setPlayer(current => ({ ...current, status: 'failed', attemptsUsed: data.maximumAttempts, completionPending: false, pendingSubmissionId: null, message: result.error || 'Maximum attempts reached. This file is locked.' }));
        return;
      }
      if (!response.ok && !result.alreadySolved) throw new Error(result.error || 'The evidence desk did not respond.');
      if (result.correct || result.alreadySolved) {
        const attemptsUsed = result.submissionCount ?? player.attemptsUsed + (result.alreadySolved ? 0 : 1);
        setDeclassifiedRule(result.ruleExplanation ?? serverState?.ruleExplanation ?? null);
        setCompletionAnimating(true);
        setPlayer(current => ({ ...current, status: 'checking', completionPending: false, pendingSubmissionId: null, attemptsUsed, message: 'Match confirmed. Declassifying file…' }));
        if (guestMode && !result.alreadySolved) {
          const elapsedSeconds = Math.floor(player.elapsedMs / 1000);
          setAnonSolved(puzzleId, { rank: result.rank ?? 'A', elapsedSeconds, date: new Date().toISOString().slice(0, 10), arcDay: result.arcDay, submissionCount: attemptsUsed });
          updateAnonStreak(getAnonStreak(), result.arcDay ?? 0, result.retentionUnlock);
          addPendingRewards(result.xpReward ?? 100, result.pointsReward ?? 100);
        }
        completionTimer.current = setTimeout(() => {
          setCompletionAnimating(false);
          setPlayer(current => ({ ...current, status: 'won', message: 'File declassified.' }));
          onSolved?.();
        }, 1050);
      } else {
        const attemptsUsed = result.submissionCount ?? player.attemptsUsed + 1;
        const failed = attemptsUsed >= data.maximumAttempts;
        setPlayer(current => ({
          ...current,
          status: failed ? 'failed' : 'playing',
          attemptsUsed,
          completionPending: false,
          pendingSubmissionId: null,
          message: failed ? 'Maximum attempts reached. This file is locked.' : 'No match yet. Recheck the pattern and try again.',
        }));
      }
    } catch (error) {
      setPlayer(current => ({
        ...current,
        status: 'completion-pending',
        completionPending: true,
        pendingSubmissionId: submissionId,
        message: error instanceof Error ? `${error.message} Your completed board is saved.` : 'Submission failed. Your completed board is saved.',
      }));
    } finally {
      submitInFlight.current = false;
    }
  }, [data, guestMode, onSolved, player, preview, puzzleId, serverState?.ruleExplanation]);

  const missingCells = useMemo(() => data?.grid.flat().filter(cell => cell.isMissing) ?? [], [data]);
  const chosenIds = player.answer.mode === 'selection' ? player.answer.cellIds : [];
  const revealedHints = data?.hints?.filter(hint => player.hintsUsed.includes(hint.id)) ?? [];
  const nextHint = data?.hints?.find(hint => !player.hintsUsed.includes(hint.id));

  if (player.status === 'loading') {
    return <div className="gridlock-state-panel" role="status"><span className="gridlock-spinner" /> Opening encrypted file…</div>;
  }
  if (!data || player.status === 'config-error' || (player.status === 'network-error' && loadFailure)) {
    return (
      <div className="gridlock-state-panel gridlock-state-panel--error" role="alert">
        <strong>{player.status === 'config-error' ? 'File configuration error' : 'Connection interrupted'}</strong>
        <span>{loadFailure ?? player.message}</span>
        <button type="button" onClick={() => void load()}>Try again</button>
      </div>
    );
  }

  return (
    <section className={`gridlock-console ${displayMode === 'app-shell' ? 'gridlock-console--app-shell' : ''}`} aria-label="Gridlock File puzzle">
      {!hideHeader && displayMode !== 'app-shell' && (
        <header className="gridlock-file-header">
          <div><span>GRIDLOCK FILE</span><strong>Case #{String(data.fileNumber).padStart(3, '0')}</strong></div>
          <button type="button" onClick={() => setHelpOpen(true)} aria-label="Open Gridlock help">?</button>
        </header>
      )}

      <div className="gridlock-status-strip" aria-label="Puzzle progress">
        <span className={`gridlock-status-dot gridlock-status-dot--${player.status}`} aria-hidden="true" />
        <span>{player.status === 'won' ? 'DECLASSIFIED' : player.status === 'failed' ? 'LOCKED' : player.status === 'completion-pending' ? 'AWAITING SERVER' : 'ACTIVE FILE'}</span>
        <span>{selectedCount(player)}/{data.answerMode === 'selection' ? data.requiredSelections : missingCells.length} marked</span>
        <time>{formatTime(player.elapsedMs)}</time>
      </div>

      <div className="gridlock-workspace">
        <div className="gridlock-board-panel">
          <div className="gridlock-brief">
            <span>CASE #{String(data.fileNumber).padStart(3, '0')}</span>
            <h2>{data.fileTitle}</h2>
            <p>{data.objective || data.flavorText}</p>
          </div>

          <div
            ref={boardRef}
            className="gridlock-grid"
            role="grid"
            aria-label={`${data.fileTitle}, ${data.rows} rows by ${data.columns} columns`}
            aria-rowcount={data.rows}
            aria-colcount={data.columns}
            style={{ '--gridlock-columns': data.columns } as React.CSSProperties}
          >
            {data.grid.flatMap((row, rowIndex) => row.map((cell, columnIndex) => {
              const selected = chosenIds.includes(cell.id);
              const missingIndex = missingCells.findIndex(candidate => candidate.id === cell.id);
              const tabIndex = player.focusedCellId === cell.id || (!player.focusedCellId && rowIndex === 0 && columnIndex === 0) ? 0 : -1;
              const locked = Boolean(cell.disabled || cell.locked || player.status === 'won' || player.status === 'failed' || player.status === 'checking');
              if (data.answerMode === 'value-entry' && cell.isMissing) {
                return (
                  <div key={cell.id} role="gridcell" aria-rowindex={rowIndex + 1} aria-colindex={columnIndex + 1} className="gridlock-cell gridlock-cell--input">
                    <input
                      data-cell-id={cell.id}
                      tabIndex={tabIndex}
                      value={player.answer.mode === 'value-entry' ? player.answer.values[missingIndex] ?? '' : ''}
                      onFocus={() => setPlayer(current => ({ ...current, focusedCellId: cell.id }))}
                      onChange={event => setPlayer(current => setGridlockValue(current, missingIndex, event.target.value))}
                      onKeyDown={event => handleCellKey(event, cell.id)}
                      disabled={locked}
                      aria-label={`Missing value at row ${rowIndex + 1}, column ${columnIndex + 1}`}
                      autoComplete="off"
                    />
                  </div>
                );
              }
              return (
                <button
                  type="button"
                  key={cell.id}
                  role="gridcell"
                  data-cell-id={cell.id}
                  aria-rowindex={rowIndex + 1}
                  aria-colindex={columnIndex + 1}
                  aria-selected={data.answerMode === 'selection' ? selected : undefined}
                  aria-disabled={locked}
                  tabIndex={tabIndex}
                  className={`gridlock-cell ${selected ? 'gridlock-cell--selected' : ''} ${locked ? 'gridlock-cell--locked' : ''}`}
                  onFocus={() => setPlayer(current => ({ ...current, focusedCellId: cell.id }))}
                  onKeyDown={event => handleCellKey(event, cell.id)}
                  onClick={() => !locked && data.answerMode === 'selection' && setPlayer(current => applyGridlockSelection(current, data, cell.id))}
                >
                  {cell.icon && <span className="gridlock-cell-icon" aria-hidden="true">{cell.icon}</span>}
                  <strong>{cell.label || String(cell.value)}</strong>
                  {cell.category && <small>{cell.category}</small>}
                  {(cell.evidence || cell.description) && <span className="gridlock-cell-evidence">{cell.evidence || cell.description}</span>}
                  {cell.locked || cell.disabled ? <span className="gridlock-cell-lock" aria-hidden="true">LOCKED</span> : null}
                </button>
              );
            }))}
          </div>
        </div>

        <aside className="gridlock-rule-panel" aria-label="Case rules">
          <div className="gridlock-panel-title"><span>ANALYST NOTES</span><button type="button" onClick={() => setHelpOpen(true)}>HELP</button></div>
          {(data.rules.length ? data.rules : [{ id: 'objective', text: data.objective || data.flavorText, initiallyVisible: true }]).map(rule => (
            <article key={rule.id}><span>{String(data.rules.indexOf(rule as never) + 1).padStart(2, '0')}</span><p>{rule.text}</p></article>
          ))}
          {revealedHints.map((hint, index) => <article key={hint.id} className="gridlock-hint"><span>H{index + 1}</span><p>{hint.text}</p></article>)}
          {nextHint && player.status !== 'won' && player.status !== 'failed' && (
            <button
              type="button"
              className="gridlock-hint-button"
              onClick={() => setPlayer(current => ({ ...current, status: 'playing', hintsUsed: [...current.hintsUsed, nextHint.id], message: `Hint ${current.hintsUsed.length + 1} revealed.` }))}
            >
              REVEAL HINT{nextHint.cost > 0 ? ` · ${nextHint.cost} SIGNAL` : ''}
            </button>
          )}
          <div className="gridlock-attempts"><span>Attempts</span><strong>{player.attemptsUsed}/{data.maximumAttempts}</strong></div>
          {declassifiedRule && player.status === 'won' && <div className="gridlock-declassified"><strong>DECLASSIFIED RULE</strong><p>{declassifiedRule}</p></div>}
        </aside>
      </div>

      <div className="gridlock-command-bar">
        <div className="gridlock-live-message" aria-live="polite">{player.message || (data.answerMode === 'selection' ? `Select ${data.requiredSelections} evidence cells.` : 'Complete the open evidence cells.')}</div>
        <button type="button" className="gridlock-secondary" onClick={requestReset} disabled={selectedCount(player) === 0 || ['won', 'checking'].includes(player.status)}>Clear</button>
        <button
          type="button"
          className="gridlock-primary"
          onClick={() => void submit()}
          disabled={preview || player.status === 'checking' || player.status === 'won' || player.status === 'failed' || !isGridlockStateComplete(player, data)}
        >
          {preview ? 'PREVIEW ONLY' : player.status === 'completion-pending' ? 'RETRY CONFIRMATION' : player.status === 'checking' ? 'CHECKING…' : player.status === 'won' ? 'DECLASSIFIED' : 'VERIFY EVIDENCE'}
        </button>
      </div>

      {requireStart && !started && player.status !== 'won' && (
        <div className="gridlock-overlay" role="dialog" aria-modal="true" aria-labelledby="gridlock-start-title">
          <div><span>SECURE TERMINAL</span><h2 id="gridlock-start-title">Ready to open the file?</h2><p>The case timer begins when you start.</p><button type="button" onClick={() => setStarted(true)}>OPEN FILE</button></div>
        </div>
      )}

      {helpOpen && (
        <div className="gridlock-overlay" role="presentation">
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="gridlock-help-title" className="gridlock-help-dialog">
            <span>FIELD MANUAL</span>
            <h2 id="gridlock-help-title">How to solve Gridlock</h2>
            <ol><li>Read the objective and visible analyst notes.</li><li>Select the required evidence cells, or fill each open legacy cell.</li><li>Verify your evidence. Correctness is confirmed only by the server.</li></ol>
            <p>Keyboard: arrow keys move, Home/End jump across a row, Ctrl/Command+Home/End jump to the grid edges, and Enter or Space selects.</p>
            <button type="button" onClick={closeHelp}>RETURN TO FILE</button>
          </div>
        </div>
      )}

      {completionAnimating && <div className="gridlock-completion" role="status" aria-live="assertive"><span /> <strong>MATCH CONFIRMED</strong><small>DECLASSIFYING FILE</small></div>}
    </section>
  );
});

export default GridlockFilePuzzle;
