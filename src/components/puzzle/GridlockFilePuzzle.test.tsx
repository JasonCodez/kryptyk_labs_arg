/** @jest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import GridlockFilePuzzle from './GridlockFilePuzzle';

const CLIENT_DATA = {
  schemaVersion: 2,
  answerMode: 'selection',
  fileNumber: 17,
  fileTitle: 'Signal Ledger',
  flavorText: 'Four records recovered from a relay.',
  objective: 'Mark two linked records.',
  gridType: 'logic',
  rows: 2,
  columns: 2,
  requiredSelections: 2,
  maximumAttempts: 3,
  grid: [
    [{ id: 'alpha', label: 'Alpha', value: 'Alpha' }, { id: 'beta', label: 'Beta', value: 'Beta' }],
    [{ id: 'gamma', label: 'Gamma', value: 'Gamma' }, { id: 'delta', label: 'Delta', value: 'Delta', locked: true }],
  ],
  rules: [{ id: 'visible-rule', type: 'constraint', text: 'Linked records share a signal.', relatedCellIds: [], displayOrder: 0, initiallyVisible: true }],
  hints: [{ id: 'hint-1', text: 'Compare the first column.', cost: 1 }],
};

beforeAll(() => {
  Object.defineProperty(window, 'requestAnimationFrame', { writable: true, value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0) });
  Object.defineProperty(global, 'CSS', { writable: true, value: { escape: (value: string) => value } });
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('gridlock:onboarding:v1', 'seen');
});

afterEach(() => {
  cleanup();
  jest.useRealTimers();
  jest.clearAllMocks();
});

async function renderPreview(overrides: Partial<React.ComponentProps<typeof GridlockFilePuzzle>> = {}) {
  const view = render(<GridlockFilePuzzle puzzleId="gridlock-test" clientPuzzleData={CLIENT_DATA} preview {...overrides} />);
  await screen.findByRole('grid', { name: /Signal Ledger/ });
  return view;
}

test('preview renders the real grid without exposing answer state or submitting', async () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;
  const view = await renderPreview({ clientPuzzleData: { ...CLIENT_DATA, correctAnswers: ['alpha', 'gamma'], privateAnswerNote: 'top secret' } });
  expect(screen.getAllByRole('gridcell')).toHaveLength(4);
  expect((screen.getByRole('button', { name: 'PREVIEW ONLY' }) as HTMLButtonElement).disabled).toBe(true);
  expect(view.container.textContent).not.toContain('top secret');
  expect(view.container.innerHTML).not.toContain('correctAnswers');
  expect(fetchMock).not.toHaveBeenCalled();
});

test('supports roving keyboard navigation, selection, limits, and locked cells', async () => {
  await renderPreview();
  const alpha = screen.getByRole('gridcell', { name: /Alpha/ });
  act(() => alpha.focus());
  fireEvent.keyDown(alpha, { key: 'Enter' });
  expect(alpha.getAttribute('aria-selected')).toBe('true');
  fireEvent.keyDown(alpha, { key: 'ArrowRight' });
  await waitFor(() => expect(document.activeElement?.getAttribute('data-cell-id')).toBe('beta'));
  fireEvent.keyDown(document.activeElement as HTMLElement, { key: ' ' });
  expect(screen.getByText('2/2 marked')).toBeTruthy();
  fireEvent.click(screen.getByRole('gridcell', { name: /Delta/ }));
  expect(screen.getByText('2/2 marked')).toBeTruthy();
});

test('keeps a complete board retryable when server confirmation fails', async () => {
  global.fetch = jest.fn(async () => ({ ok: false, json: async () => ({ error: 'Offline' }) })) as jest.Mock;
  render(<GridlockFilePuzzle puzzleId="gridlock-test" clientPuzzleData={CLIENT_DATA} mode="catalog" persistenceScope="catalog" />);
  await screen.findByRole('grid');
  fireEvent.click(screen.getByRole('gridcell', { name: /Alpha/ }));
  fireEvent.click(screen.getByRole('gridcell', { name: /Gamma/ }));
  fireEvent.click(screen.getByRole('button', { name: 'VERIFY EVIDENCE' }));
  expect(await screen.findByRole('button', { name: 'RETRY CONFIRMATION' })).toBeTruthy();
  expect(screen.getByRole('gridcell', { name: /Alpha/ }).getAttribute('aria-selected')).toBe('true');
  await waitFor(() => expect(localStorage.getItem('gridlock-progress:v1:catalog:gridlock-test')).toContain('completionPending'));
});

test('celebrates only after a successful server response and calls completion once', async () => {
  jest.useFakeTimers();
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ correct: true, submissionCount: 1, ruleExplanation: 'The signals align.' }) })) as jest.Mock;
  const onSolved = jest.fn();
  render(<GridlockFilePuzzle puzzleId="gridlock-test" clientPuzzleData={CLIENT_DATA} onSolved={onSolved} />);
  await act(async () => {});
  fireEvent.click(screen.getByRole('gridcell', { name: /Alpha/ }));
  fireEvent.click(screen.getByRole('gridcell', { name: /Gamma/ }));
  fireEvent.click(screen.getByRole('button', { name: 'VERIFY EVIDENCE' }));
  await act(async () => {});
  expect(screen.getByText('MATCH CONFIRMED')).toBeTruthy();
  expect(onSolved).not.toHaveBeenCalled();
  act(() => { jest.advanceTimersByTime(1050); });
  expect(onSolved).toHaveBeenCalledTimes(1);
  expect(screen.getByText('DECLASSIFIED RULE')).toBeTruthy();
});

test('Warz and preview scopes never read or write catalog persistence', async () => {
  localStorage.setItem('gridlock-progress:v1:catalog:gridlock-test', JSON.stringify({ version: 1, secret: true }));
  await renderPreview({ mode: 'warz', persistenceScope: 'none' });
  fireEvent.click(screen.getByRole('gridcell', { name: /Alpha/ }));
  expect(localStorage.getItem('gridlock-progress:v1:catalog:gridlock-test')).toContain('secret');
  expect([...Array(localStorage.length)].map((_, index) => localStorage.key(index)).filter(key => key?.includes('none'))).toHaveLength(0);
});

test('reveals hints without correctness feedback and includes them in resumable progress', async () => {
  render(<GridlockFilePuzzle puzzleId="gridlock-test" clientPuzzleData={CLIENT_DATA} persistenceScope="catalog" />);
  await screen.findByRole('grid');
  fireEvent.click(screen.getByRole('button', { name: /REVEAL HINT/ }));
  expect(screen.getByText('Compare the first column.')).toBeTruthy();
  await waitFor(() => expect(localStorage.getItem('gridlock-progress:v1:catalog:gridlock-test')).toContain('hint-1'));
  expect(document.body.textContent).not.toContain('correct answer');
});
