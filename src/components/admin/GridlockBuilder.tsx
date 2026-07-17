'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  GRIDLOCK_RULE_TYPES,
  GRIDLOCK_SIZE_LIMITS,
  getGridlockCellSize,
  normalizeGridlockFileData,
  validateGridlockFileData,
  type GridCell,
  type GridlockFileData,
  type GridlockRule,
  type RuleFamily,
} from '@/lib/gridlockFile';
import {
  createGridlockDraft,
  createUniqueGridlockId,
  importGridlockCsv,
  importGridlockJson,
  reorderGridlockRule,
  resizeGridlockDraft,
  toggleGridlockSolution,
} from '@/lib/gridlockBuilder';
import GridlockFilePuzzle from '@/components/puzzle/GridlockFilePuzzle';

type Mode = 'cells' | 'solution' | 'rules' | 'preview' | 'advanced';

export interface GridlockBuilderProps {
  value?: unknown;
  onChange: (value: GridlockFileData) => void;
  onValidityChange?: (valid: boolean) => void;
}

function fieldClass(extra = ''): string {
  return `w-full rounded-lg border border-slate-600 bg-slate-950/60 px-3 py-2 text-sm text-white ${extra}`;
}

function populated(draft: GridlockFileData): boolean {
  return draft.grid.flat().some(cell => String(cell.label ?? cell.value ?? '').trim()) || draft.correctAnswers.length > 0;
}

export function GridlockSafePreview({ draft, phone }: { draft: GridlockFileData; phone: boolean }) {
  const previewCellIds = new Set(draft.grid.flat().map(cell => cell.id).filter(Boolean));
  const previewDraft = {
    ...draft,
    fileTitle: draft.fileTitle || 'Untitled Gridlock File',
    rules: (draft.rules ?? []).map((rule, index) => ({
      ...rule,
      id: rule.id || `preview-rule-${index + 1}`,
      text: rule.text || 'Rule details pending.',
      relatedCellIds: (rule.relatedCellIds ?? []).filter(id => previewCellIds.has(id)),
    })),
  };
  return (
    <div data-testid="gridlock-safe-preview" className="mx-auto overflow-hidden rounded-xl border border-slate-700 bg-slate-950" style={{ maxWidth: phone ? 390 : 920, height: phone ? 720 : 760 }}>
      <GridlockFilePuzzle puzzleId="admin-gridlock-preview" clientPuzzleData={previewDraft} mode="preview" persistenceScope="none" preview />
    </div>
  );
}

export default function GridlockBuilder({ value, onChange, onValidityChange }: GridlockBuilderProps) {
  const [draft, setDraft] = useState<GridlockFileData>(() => normalizeGridlockFileData(value) ?? createGridlockDraft());
  const [mode, setMode] = useState<Mode>('cells');
  const [selectedId, setSelectedId] = useState<string>(() => draft.grid.flat()[0]?.id ?? '');
  const [moveSourceId, setMoveSourceId] = useState<string>('');
  const [phonePreview, setPhonePreview] = useState(false);
  const [advancedJson, setAdvancedJson] = useState(() => JSON.stringify(draft, null, 2));
  const [csvText, setCsvText] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [pendingResize, setPendingResize] = useState<{ rows: number; columns: number; removed: GridCell[] } | null>(null);
  const cellRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onChangeRef = useRef(onChange);
  const onValidityChangeRef = useRef(onValidityChange);
  const lastEmittedRef = useRef<GridlockFileData | null>(null);
  const validation = useMemo(() => validateGridlockFileData(draft), [draft]);
  const cells = draft.grid.flat();
  const selected = cells.find(cell => cell.id === selectedId) ?? null;
  const marked = new Set(draft.answerMode === 'selection' ? draft.correctAnswers.map(String) : draft.grid.flat().filter(cell => cell.isMissing).map(cell => cell.id as string));
  const completedCount = cells.filter(cell => String(cell.label ?? cell.value ?? '').trim()).length;
  const columns = draft.columns ?? draft.grid[0]?.length ?? 1;
  const phoneCellSize = getGridlockCellSize(columns, 320 - 32);

  useEffect(() => { onChangeRef.current = onChange; onValidityChangeRef.current = onValidityChange; });
  useEffect(() => {
    lastEmittedRef.current = draft;
    onChangeRef.current(draft);
    onValidityChangeRef.current?.(validation.valid);
  }, [draft, validation.valid]);
  useEffect(() => {
    if (value === lastEmittedRef.current) return;
    const external = normalizeGridlockFileData(value);
    if (!external) return;
    // An admin can switch directly between existing puzzles while this editor remains mounted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(external);
    setSelectedId(external.grid.flat()[0]?.id ?? '');
    setAdvancedJson(JSON.stringify(external, null, 2));
  }, [value]);

  const updateDraft = (patch: Partial<GridlockFileData>) => setDraft(current => ({ ...current, ...patch }));
  const updateCell = (id: string, patch: Partial<GridCell>) => setDraft(current => ({
    ...current,
    grid: current.grid.map(row => row.map(cell => cell.id === id
      ? { ...cell, ...patch, value: patch.label ?? cell.label ?? cell.value }
      : cell)),
  }));

  const requestResize = (rows: number, columns: number) => {
    try {
      const result = resizeGridlockDraft(draft, rows, columns);
      if (result.requiresConfirmation) setPendingResize({ rows, columns, removed: result.removedCells });
      else { setDraft(result.draft); setPendingResize(null); }
    } catch (error) { setImportMessage(error instanceof Error ? error.message : 'Unsupported grid size.'); }
  };

  const focusCell = (row: number, column: number) => {
    const target = draft.grid[row]?.[column];
    if (target?.id) { setSelectedId(target.id); cellRefs.current[target.id]?.focus(); }
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const target = cells.find(cell => !String(cell.label ?? cell.value ?? '').trim() && cell.id !== selected.id);
    if (!target?.id) { setImportMessage('Add or clear a cell before duplicating.'); return; }
    const copy = { ...selected };
    delete copy.id;
    delete copy.row;
    delete copy.column;
    updateCell(target.id, copy);
    setSelectedId(target.id);
  };

  const moveOrSwap = (targetId: string) => {
    if (!moveSourceId) { setMoveSourceId(targetId); return; }
    if (moveSourceId === targetId) { setMoveSourceId(''); return; }
    setDraft(current => {
      const source = current.grid.flat().find(cell => cell.id === moveSourceId);
      const target = current.grid.flat().find(cell => cell.id === targetId);
      if (!source || !target) return current;
      const sourcePosition = { row: source.row, column: source.column };
      const targetPosition = { row: target.row, column: target.column };
      return {
        ...current,
        grid: current.grid.map(row => row.map(cell => cell.id === source.id
          ? { ...target, ...sourcePosition }
          : cell.id === target.id ? { ...source, ...targetPosition } : cell)),
      };
    });
    setMoveSourceId('');
  };

  const applyJson = () => {
    const result = importGridlockJson(advancedJson);
    if (!result.ok) { setImportMessage(`${result.line ? `Line ${result.line}${result.column ? `, column ${result.column}` : ''}: ` : ''}${result.error}`); return; }
    if (populated(draft) && !window.confirm('Replace the populated visual draft with this imported JSON?')) return;
    setDraft(result.draft); setSelectedId(result.draft.grid.flat()[0]?.id ?? ''); setImportMessage('JSON imported. Review validation before saving.');
  };

  const applyCsv = () => {
    const result = importGridlockCsv(csvText, draft);
    if (!result.ok) { setImportMessage(result.error); return; }
    if (populated(draft) && !window.confirm('Replace grid cell data with this CSV import?')) return;
    setDraft(result.draft); setImportMessage('CSV imported into the visual editor. Validate before saving.'); setMode('cells');
  };

  const addRule = () => {
    const existing = (draft.rules ?? []).map(rule => rule.id);
    const next: GridlockRule = {
      id: createUniqueGridlockId('rule', existing), type: 'constraint', text: '',
      displayOrder: existing.length, initiallyVisible: true, relatedCellIds: [],
    };
    updateDraft({ rules: [...(draft.rules ?? []), next] });
  };

  return (
    <section className="space-y-5 rounded-2xl border border-cyan-900/70 bg-slate-900/70 p-4" aria-label="Gridlock visual builder">
      <div>
        <h3 className="text-lg font-bold text-cyan-200">Gridlock Visual Builder</h3>
        <p className="text-xs text-slate-400">JSON remains canonical. Build and validate the ordinary editing flow here.</p>
      </div>

      <fieldset className="grid gap-3 rounded-xl border border-slate-700 p-3 md:grid-cols-3">
        <legend className="px-2 text-sm font-semibold text-white">1. Setup</legend>
        <label className="text-xs text-slate-300">Title<input className={fieldClass()} value={draft.fileTitle} onChange={e => updateDraft({ fileTitle: e.target.value })} /></label>
        <label className="text-xs text-slate-300 md:col-span-2">Objective<input className={fieldClass()} value={draft.objective ?? ''} onChange={e => updateDraft({ objective: e.target.value, flavorText: e.target.value })} /></label>
        <label className="text-xs text-slate-300">Case / file number<input type="number" min={1} className={fieldClass()} value={draft.fileNumber} onChange={e => updateDraft({ fileNumber: Number(e.target.value) })} /></label>
        <label className="text-xs text-slate-300">Difficulty<select className={fieldClass()} value={draft.difficulty} onChange={e => updateDraft({ difficulty: e.target.value as GridlockFileData['difficulty'] })}>{['easy','medium','hard','expert','extreme'].map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="text-xs text-slate-300">Required selections<input type="number" min={1} className={fieldClass()} value={draft.requiredSelections} onChange={e => updateDraft({ requiredSelections: Number(e.target.value) })} /></label>
        <label className="text-xs text-slate-300">Rows<input type="number" min={GRIDLOCK_SIZE_LIMITS.minRows} max={GRIDLOCK_SIZE_LIMITS.maxRows} className={fieldClass()} value={draft.rows} onChange={e => requestResize(Number(e.target.value), draft.columns ?? columns)} /></label>
        <label className="text-xs text-slate-300">Columns<input type="number" min={GRIDLOCK_SIZE_LIMITS.minColumns} max={GRIDLOCK_SIZE_LIMITS.maxColumns} className={fieldClass()} value={draft.columns} onChange={e => requestResize(draft.rows ?? draft.grid.length, Number(e.target.value))} /></label>
        <label className="text-xs text-slate-300">Maximum attempts<input type="number" min={1} className={fieldClass()} value={draft.maximumAttempts} onChange={e => updateDraft({ maximumAttempts: Number(e.target.value) })} /></label>
        <label className="text-xs text-slate-300 md:col-span-3">Rule explanation<textarea className={fieldClass('min-h-20')} value={draft.ruleExplanation} onChange={e => updateDraft({ ruleExplanation: e.target.value })} /></label>
        <label className="text-xs text-slate-300">Points reward<input type="number" min={0} className={fieldClass()} value={Number(draft.rewardSettings?.points ?? 0)} onChange={e => updateDraft({ rewardSettings: { ...draft.rewardSettings, points: Number(e.target.value) } })} /></label>
        <label className="text-xs text-slate-300">XP reward<input type="number" min={0} className={fieldClass()} value={Number(draft.rewardSettings?.xp ?? 0)} onChange={e => updateDraft({ rewardSettings: { ...draft.rewardSettings, xp: Number(e.target.value) } })} /></label>
      </fieldset>

      {pendingResize && <div role="alertdialog" className="rounded-lg border border-amber-500 bg-amber-950/40 p-3 text-sm text-amber-100">
        Shrinking would remove {pendingResize.removed.length} configured cell{pendingResize.removed.length === 1 ? '' : 's'}: {pendingResize.removed.map(cell => cell.label || cell.id).join(', ')}.
        <div className="mt-2 flex gap-2"><button type="button" className="rounded bg-red-700 px-3 py-1" onClick={() => { setDraft(resizeGridlockDraft(draft, pendingResize.rows, pendingResize.columns, true).draft); setPendingResize(null); }}>Confirm destructive resize</button><button type="button" className="rounded bg-slate-700 px-3 py-1" onClick={() => setPendingResize(null)}>Cancel</button></div>
      </div>}

      <nav className="flex flex-wrap gap-2" aria-label="Builder modes">
        {([['cells','Grid editor'],['solution','Mark Solution'],['rules','Rules'],['preview','Preview'],['advanced','Advanced JSON / CSV']] as [Mode,string][]).map(([value,label]) => <button type="button" key={value} onClick={() => setMode(value)} className={`rounded-lg px-3 py-2 text-sm ${mode === value ? 'bg-cyan-700 text-white' : 'bg-slate-800 text-slate-300'}`}>{label}</button>)}
      </nav>

      {(mode === 'cells' || mode === 'solution') && <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div>
          {mode === 'solution' && <div className={`mb-3 rounded-lg border p-3 text-sm ${draft.correctAnswers.length === draft.requiredSelections ? 'border-emerald-700 text-emerald-200' : 'border-amber-600 text-amber-200'}`}>
            Marked {draft.correctAnswers.length} / required {draft.requiredSelections}. {draft.answerMode === 'value-entry' ? 'Legacy value-entry answers are preserved until you explicitly migrate.' : draft.correctAnswers.length !== draft.requiredSelections ? 'Counts must match before publishing.' : 'Counts match.'}
            {draft.answerMode === 'value-entry' && <button type="button" className="ml-2 rounded bg-amber-800 px-2 py-1 text-xs text-white" onClick={() => {
              if (!window.confirm('Intentionally migrate this legacy value-entry puzzle to cell-selection answers? This changes how players solve it.')) return;
              const missingIds = draft.grid.flat().filter(cell => cell.isMissing).map(cell => cell.id!);
              setDraft(current => ({
                ...current,
                answerMode: 'selection',
                grid: current.grid.map(row => row.map(cell => ({ ...cell, isMissing: undefined }))),
                correctAnswers: missingIds,
                requiredSelections: missingIds.length,
              }));
            }}>Migrate intentionally</button>}
          </div>}
          <div className="grid w-fit max-w-full gap-2 overflow-auto" role="grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(64px, 92px))` }}>
            {draft.grid.map((row, rowIndex) => row.map((cell, columnIndex) => {
              const incomplete = !String(cell.label ?? cell.value ?? '').trim();
              const isMarked = marked.has(cell.id ?? '');
              return <button
                type="button" role="gridcell" key={cell.id} ref={element => { if (cell.id) cellRefs.current[cell.id] = element; }}
                aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}${isMarked ? ', marked solution' : ''}`}
                onClick={() => { setSelectedId(cell.id ?? ''); if (mode === 'solution' && draft.answerMode === 'selection' && cell.id) setDraft(toggleGridlockSolution(draft, cell.id)); }}
                onKeyDown={event => {
                  if (event.key === 'ArrowLeft') { event.preventDefault(); focusCell(rowIndex, Math.max(0, columnIndex - 1)); }
                  if (event.key === 'ArrowRight') { event.preventDefault(); focusCell(rowIndex, Math.min(row.length - 1, columnIndex + 1)); }
                  if (event.key === 'ArrowUp') { event.preventDefault(); focusCell(Math.max(0, rowIndex - 1), columnIndex); }
                  if (event.key === 'ArrowDown') { event.preventDefault(); focusCell(Math.min(draft.grid.length - 1, rowIndex + 1), columnIndex); }
                  if ((event.key === 'Enter' || event.key === ' ') && mode === 'solution' && cell.id) { event.preventDefault(); setDraft(toggleGridlockSolution(draft, cell.id)); }
                }}
                className={`relative min-h-20 rounded-lg border p-2 text-center ${isMarked && mode === 'solution' ? 'border-emerald-400 bg-emerald-900/60' : selectedId === cell.id ? 'border-cyan-400 bg-cyan-950' : incomplete ? 'border-dashed border-amber-500 bg-amber-950/20' : 'border-slate-600 bg-slate-800'} ${cell.disabled || cell.locked ? 'opacity-50' : ''}`}
              ><div className="text-lg">{cell.icon}</div><div className="break-words text-xs font-semibold text-white">{cell.label || cell.value || 'Incomplete'}</div><div className="mt-1 text-[10px] text-slate-500">R{rowIndex + 1} C{columnIndex + 1}</div></button>;
            }))}
          </div>
          {mode === 'solution' && <ul className="mt-3 text-xs text-slate-300">{cells.filter(cell => marked.has(cell.id ?? '')).map(cell => <li key={cell.id}>{cell.label || '(unlabeled)'} — {cell.id}</li>)}</ul>}
        </div>

        {selected && mode === 'cells' && <aside className="space-y-2 rounded-xl border border-slate-700 p-3">
          <h4 className="font-semibold text-white">Cell R{(selected.row ?? 0) + 1} C{(selected.column ?? 0) + 1}</h4>
          <div className="select-all break-all text-[11px] text-slate-500">{selected.id}</div>
          <label className="text-xs text-slate-300">Label<input className={fieldClass()} value={selected.label ?? ''} onChange={e => updateCell(selected.id!, { label: e.target.value })} /></label>
          <label className="text-xs text-slate-300">Short description<textarea className={fieldClass()} value={selected.description ?? ''} onChange={e => updateCell(selected.id!, { description: e.target.value })} /></label>
          <label className="text-xs text-slate-300">Category<input className={fieldClass()} value={selected.category ?? ''} onChange={e => updateCell(selected.id!, { category: e.target.value })} /></label>
          <label className="text-xs text-slate-300">Icon<input className={fieldClass()} value={selected.icon ?? ''} onChange={e => updateCell(selected.id!, { icon: e.target.value })} /></label>
          <label className="text-xs text-slate-300">Player-visible evidence<textarea className={fieldClass()} value={selected.evidence ?? ''} onChange={e => updateCell(selected.id!, { evidence: e.target.value })} /></label>
          <label className="flex gap-2 text-xs text-slate-300"><input type="checkbox" checked={Boolean(selected.disabled)} onChange={e => updateCell(selected.id!, { disabled: e.target.checked })} />Disabled</label>
          <label className="flex gap-2 text-xs text-slate-300"><input type="checkbox" checked={Boolean(selected.locked)} onChange={e => updateCell(selected.id!, { locked: e.target.checked })} />Locked</label>
          <div className="flex flex-wrap gap-2 pt-2"><button type="button" className="rounded bg-slate-700 px-2 py-1 text-xs" onClick={duplicateSelected}>Duplicate</button><button type="button" className={`rounded px-2 py-1 text-xs ${moveSourceId ? 'bg-cyan-700' : 'bg-slate-700'}`} onClick={() => moveOrSwap(selected.id!)}>{moveSourceId ? 'Swap with this cell' : 'Move / swap'}</button><button type="button" className="rounded bg-red-900 px-2 py-1 text-xs" onClick={() => { if (window.confirm('Clear this cell?')) updateCell(selected.id!, { label: '', value: '', description: undefined, category: undefined, icon: undefined, evidence: undefined, disabled: false, locked: false }); }}>Clear</button></div>
        </aside>}
      </div>}

      {mode === 'rules' && <div className="space-y-3">
        {[...(draft.rules ?? [])].sort((a,b) => a.displayOrder - b.displayOrder).map((rule, index) => <article key={rule.id} className="rounded-xl border border-slate-700 p-3">
          <div className="mb-2 flex items-center justify-between"><span className="text-xs text-slate-500">{rule.id} · order {index + 1}</span><div className="flex gap-1"><button type="button" onClick={() => setDraft(reorderGridlockRule(draft, rule.id, -1))} disabled={index === 0}>↑</button><button type="button" onClick={() => setDraft(reorderGridlockRule(draft, rule.id, 1))} disabled={index === (draft.rules?.length ?? 0) - 1}>↓</button><button type="button" className="text-red-300" onClick={() => updateDraft({ rules: (draft.rules ?? []).filter(item => item.id !== rule.id).map((item, displayOrder) => ({ ...item, displayOrder })) })}>Remove</button></div></div>
          <div className="grid gap-2 md:grid-cols-2"><label className="text-xs text-slate-300">Supported rule type<select className={fieldClass()} value={rule.type} onChange={e => updateDraft({ rules: (draft.rules ?? []).map(item => item.id === rule.id ? { ...item, type: e.target.value as RuleFamily } : item) })}>{GRIDLOCK_RULE_TYPES.map(type => <option key={type}>{type}</option>)}</select></label><label className="flex items-end gap-2 pb-2 text-xs text-slate-300"><input type="checkbox" checked={rule.initiallyVisible} onChange={e => updateDraft({ rules: (draft.rules ?? []).map(item => item.id === rule.id ? { ...item, initiallyVisible: e.target.checked } : item) })} />Initially visible</label></div>
          <label className="text-xs text-slate-300">Player-facing text<textarea className={fieldClass()} value={rule.text} onChange={e => updateDraft({ rules: (draft.rules ?? []).map(item => item.id === rule.id ? { ...item, text: e.target.value } : item) })} /></label>
          <details className="mt-2"><summary className="cursor-pointer text-xs text-cyan-300">Choose related cells visually</summary><div className="mt-2 grid grid-cols-2 gap-1 md:grid-cols-4">{cells.map(cell => <label key={cell.id} className="flex gap-1 text-xs text-slate-300"><input type="checkbox" checked={(rule.relatedCellIds ?? []).includes(cell.id!)} onChange={e => updateDraft({ rules: (draft.rules ?? []).map(item => item.id === rule.id ? { ...item, relatedCellIds: e.target.checked ? [...(item.relatedCellIds ?? []), cell.id!] : (item.relatedCellIds ?? []).filter(id => id !== cell.id) } : item) })} />{cell.label || cell.id}</label>)}</div></details>
          <label className="mt-2 block text-xs text-slate-300">Unlock after attempts (optional)<input type="number" min={1} className={fieldClass()} value={rule.unlock?.afterAttempts ?? ''} onChange={e => updateDraft({ rules: (draft.rules ?? []).map(item => item.id === rule.id ? { ...item, unlock: e.target.value ? { ...item.unlock, afterAttempts: Number(e.target.value) } : undefined } : item) })} /></label>
        </article>)}
        <button type="button" className="rounded-lg bg-cyan-800 px-3 py-2 text-sm text-white" onClick={addRule}>Add rule card</button>
      </div>}

      {mode === 'preview' && <div><div className="mb-3 flex gap-2"><button type="button" className={`rounded px-3 py-1 ${!phonePreview ? 'bg-cyan-700' : 'bg-slate-700'}`} onClick={() => setPhonePreview(false)}>Desktop</button><button type="button" className={`rounded px-3 py-1 ${phonePreview ? 'bg-cyan-700' : 'bg-slate-700'}`} onClick={() => setPhonePreview(true)}>Phone</button></div><GridlockSafePreview draft={draft} phone={phonePreview} /></div>}

      {mode === 'advanced' && <div className="space-y-4"><div><div className="mb-1 flex justify-between"><label className="text-sm font-semibold text-white">Advanced JSON</label><button type="button" className="text-xs text-cyan-300" onClick={() => { const text = JSON.stringify(draft, null, 2); setAdvancedJson(text); navigator.clipboard?.writeText(text); setImportMessage('Canonical JSON copied when clipboard permission is available.'); }}>Export / copy current</button></div><textarea className={fieldClass('min-h-80 font-mono text-xs')} value={advancedJson} onChange={e => setAdvancedJson(e.target.value)} spellCheck={false} /><button type="button" className="mt-2 rounded bg-cyan-800 px-3 py-2 text-sm" onClick={applyJson}>Validate and apply JSON</button></div><div><label className="text-sm font-semibold text-white">CSV cells</label><p className="text-xs text-slate-400">Columns: row,col,label,description,category,correct,disabled (optional id supported).</p><textarea className={fieldClass('min-h-36 font-mono text-xs')} value={csvText} onChange={e => setCsvText(e.target.value)} /><button type="button" className="mt-2 rounded bg-cyan-800 px-3 py-2 text-sm" onClick={applyCsv}>Import CSV to draft</button></div></div>}

      {importMessage && <div role="status" className="rounded border border-slate-600 p-2 text-sm text-slate-200">{importMessage}</div>}
      <section className={`rounded-xl border p-3 ${validation.valid ? 'border-emerald-700' : 'border-red-700'}`} aria-label="Validation summary">
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 md:grid-cols-6"><span>Dimensions: {draft.rows}×{draft.columns}</span><span>Total: {cells.length}</span><span>Completed: {completedCount}</span><span>Required: {draft.requiredSelections}</span><span>Marked: {draft.correctAnswers.length}</span><span>Status: {validation.valid ? 'Valid' : `${validation.errors.length} errors`}</span></div>
        {phoneCellSize < GRIDLOCK_SIZE_LIMITS.mobileComfortableCellSize && <p className="mt-2 text-xs text-amber-300">Mobile warning: estimated cells are {phoneCellSize}px, below the recommended {GRIDLOCK_SIZE_LIMITS.mobileComfortableCellSize}px touch size.</p>}
        {[...validation.errors, ...validation.warnings].length > 0 && <ul className="mt-2 list-disc pl-5 text-xs">{[...validation.errors, ...validation.warnings].map((issue, index) => <li key={`${issue.code}-${index}`} className={issue.severity === 'error' ? 'text-red-300' : 'text-amber-300'}>{issue.message}</li>)}</ul>}
        {!validation.valid && <p className="mt-2 text-xs font-semibold text-red-300">Publishing is disabled until all validation errors are fixed.</p>}
      </section>
    </section>
  );
}
