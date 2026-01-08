'use client';

import { useState } from 'react';
import { CipherPuzzleData, cipherFunctions } from '@/lib/argPuzzleTypes';

interface CipherPuzzleProps {
  puzzle: {
    id: string;
    title: string;
    description?: string;
    puzzleData: CipherPuzzleData;
    hints: string[];
  };
  onSolve: (answer: string) => Promise<{ success: boolean; feedback: string }>;
}

export default function CipherPuzzle({ puzzle, onSolve }: CipherPuzzleProps) {
  const [userAnswer, setUserAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [revealedHints, setRevealedHints] = useState<Set<number>>(new Set());
  const [solved, setSolved] = useState(false);

  const data = puzzle.puzzleData as CipherPuzzleData;

  const handleRevealHint = (index: number) => {
    setRevealedHints((prev) => new Set(prev).add(index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAnswer.trim() || submitting) return;

    setSubmitting(true);
    try {
      const result = await onSolve(userAnswer);
      if (result.success) {
        setSolved(true);
        setFeedback({ type: 'success', text: '✓ Correct! Well done!' });
        setUserAnswer('');
      } else {
        setFeedback({ type: 'error', text: result.feedback });
      }
    } catch (error) {
      setFeedback({ type: 'error', text: 'Failed to submit answer' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h3 className="text-2xl font-bold text-white mb-2">{puzzle.title}</h3>
        {puzzle.description && <p className="text-gray-400">{puzzle.description}</p>}
      </div>

      {/* Cipher Info */}
      <div
        className="p-4 rounded-lg border"
        style={{
          backgroundColor: 'rgba(56, 145, 166, 0.08)',
          borderColor: '#3891A6',
        }}
      >
        <div className="space-y-3">
          <div>
            <p className="text-sm text-gray-400 mb-1">Cipher Type</p>
            <p className="font-semibold text-white capitalize">{data.cipherType}</p>
          </div>

          <div>
            <p className="text-sm text-gray-400 mb-1">Encrypted Message</p>
            <p className="font-mono text-lg text-[#FDE74C] bg-black/30 p-3 rounded border border-[#FDE74C]/30">
              {data.encryptedText}
            </p>
          </div>

          {data.clue && (
            <div>
              <p className="text-sm text-gray-400 mb-1">Clue</p>
              <p className="text-gray-300 italic">{data.clue}</p>
            </div>
          )}
        </div>
      </div>

      {/* Hints */}
      {puzzle.hints.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-300">Available Hints</p>
          <div className="space-y-2">
            {puzzle.hints.map((hint, index) => (
              <button
                key={index}
                onClick={() => handleRevealHint(index)}
                disabled={revealedHints.has(index)}
                data-tour={index === 0 ? 'puzzle-hint-1' : undefined}
                className="w-full text-left px-4 py-3 rounded-lg transition"
                style={{
                  backgroundColor: revealedHints.has(index) ? 'rgba(124, 58, 237, 0.2)' : 'rgba(56, 145, 166, 0.15)',
                  borderLeft: revealedHints.has(index) ? '3px solid #7C3AED' : '3px solid #3891A6',
                }}
              >
                {revealedHints.has(index) ? (
                  <span className="text-gray-200">{hint}</span>
                ) : (
                  <span className="text-gray-400">💡 Show Hint {index + 1}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Answer Input */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">Your Answer</label>
          <input
            type="text"
            className="w-full px-4 py-3 rounded-lg border text-white placeholder-gray-500 transition"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              borderColor: solved ? '#4CAF50' : '#3891A6',
            }}
          />
        </div>

        {feedback && (
          <div
            className="p-3 rounded-lg text-sm"
            style={{
              backgroundColor:
                feedback.type === 'success'
                  ? 'rgba(76, 175, 80, 0.15)'
                  : feedback.type === 'error'
                    ? 'rgba(171, 159, 157, 0.15)'
                    : 'rgba(56, 145, 166, 0.15)',
              color:
                feedback.type === 'success'
                  ? '#4CAF50'
                  : feedback.type === 'error'
                    ? '#AB9F9D'
                    : '#3891A6',
            }}
          >
            {feedback.text}
          </div>
        )}

        <button
          type="submit"
          disabled={solved || submitting || !userAnswer.trim()}
          className="w-full px-4 py-3 rounded-lg font-semibold text-white transition disabled:opacity-50"
          style={{
            backgroundColor: solved ? '#4CAF50' : '#3891A6',
          }}
        >
          {solved ? '✓ Solved!' : submitting ? 'Submitting...' : 'Submit Answer'}
        </button>
      </form>
    </div>
  );
}
