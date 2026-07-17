import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { POST } from './route';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    puzzle: { findUnique: jest.fn() },
    gridlockSolve: { create: jest.fn() },
  },
}));

const db = prisma as unknown as {
  puzzle: { findUnique: jest.Mock };
  gridlockSolve: { create: jest.Mock };
};

const puzzleData = {
  schemaVersion: 2,
  answerMode: 'selection',
  fileNumber: 1,
  fileTitle: 'API Matrix',
  flavorText: 'Find the linked records.',
  objective: 'Select two cells.',
  gridType: 'logic',
  rows: 2,
  columns: 2,
  requiredSelections: 2,
  maximumAttempts: 3,
  grid: [
    [{ id: 'alpha', label: 'Alpha', value: 'Alpha' }, { id: 'beta', label: 'Beta', value: 'Beta' }],
    [{ id: 'gamma', label: 'Gamma', value: 'Gamma' }, { id: 'delta', label: 'Delta', value: 'Delta' }],
  ],
  correctAnswers: ['alpha', 'gamma'],
  ruleExplanation: 'Alpha and Gamma share the signal.',
  primaryRuleFamily: 'constraint',
  primaryRuleAxis: 'both',
  rules: [{ id: 'rule-1', type: 'constraint', text: 'Match the signal.', relatedCellIds: [], displayOrder: 0, initiallyVisible: true }],
};

function request(body: string) {
  return new NextRequest('http://localhost/api/gridlock/guest/test/submit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  db.puzzle.findUnique.mockResolvedValue({ id: 'test', puzzleType: 'gridlock_file', data: { gridlockFile: puzzleData }, xpReward: 100 });
  db.gridlockSolve.create.mockResolvedValue({ id: 'solve' });
});

describe('POST guest Gridlock submission', () => {
  test('rejects malformed JSON as a client error', async () => {
    const response = await POST(request('{bad json'), { params: Promise.resolve({ id: 'test' }) });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(expect.objectContaining({ error: 'Malformed JSON submission' }));
  });

  test('rejects unknown, locked, duplicated, and wrong-count cell IDs before persistence', async () => {
    for (const answers of [['alpha', 'secret-id'], ['alpha', 'alpha'], ['alpha']]) {
      const response = await POST(request(JSON.stringify({ answers, submissionCount: 1 })), { params: Promise.resolve({ id: 'test' }) });
      expect(response.status).toBe(400);
    }
    expect(db.gridlockSolve.create).not.toHaveBeenCalled();
  });

  test('accepts order-independent canonical selections without returning per-cell correctness', async () => {
    const response = await POST(request(JSON.stringify({ answers: ['gamma', 'alpha'], submissionCount: 1, anonId: 'anon-1' })), { params: Promise.resolve({ id: 'test' }) });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.correct).toBe(true);
    expect(result.ruleExplanation).toBe(puzzleData.ruleExplanation);
    expect(JSON.stringify(result)).not.toContain('cellResults');
    expect(JSON.stringify(result)).not.toContain('alpha":true');
    expect(db.gridlockSolve.create).toHaveBeenCalledTimes(1);
  });
});
