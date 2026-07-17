/** @jest-environment jsdom */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { GridlockSafePreview } from './GridlockBuilder';
import { createGridlockDraft } from '@/lib/gridlockBuilder';

describe('Gridlock preview safety', () => {
  test('renders a player-like grid without correctness state or side effects', () => {
    const draft = createGridlockDraft(2, 2);
    draft.fileTitle = 'Safe Case';
    draft.grid[0][0].label = 'Alpha';
    draft.correctAnswers = [draft.grid[0][0].id!];
    const { container } = render(<GridlockSafePreview draft={draft} phone={false} />);

    expect(screen.getByTestId('gridlock-safe-preview')).toBeTruthy();
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('[data-correct], [data-answer], [aria-label*="correct"]')).toBeNull();
    expect(container.innerHTML).not.toContain('correctAnswers');
  });
});
