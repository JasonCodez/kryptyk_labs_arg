'use client';

import { useState } from 'react';

interface Clue {
  id: string;
  clue: string;
  hint: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface RelaySolverViewProps {
  roomId: string;
  clues: Clue[];
  onSubmitAnswer: (answer: string) => Promise<{ correct: boolean; feedback: string }>;
  isSubmitted?: boolean;
  feedback?: string;
}

export default function RelaySolverView({
  roomId,
  clues,
  onSubmitAnswer,
  isSubmitted = false,
  feedback = '',
}: RelaySolverViewProps) {
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [currentFeedback, setCurrentFeedback] = useState(feedback);
  const [revealedHints, setRevealedHints] = useState<Set<string>>(new Set());

  const handleRevealHint = (clueId: string) => {
    setRevealedHints((prev) => new Set(prev).add(clueId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim() || submitting) return;

    setSubmitting(true);
    try {
      const result = await onSubmitAnswer(answer);
      setIsCorrect(result.correct);
      setCurrentFeedback(result.feedback);
      if (result.correct) {
        setAnswer('');
      }
    } catch (error) {
      console.error('Failed to submit answer:', error);
      setCurrentFeedback('Error submitting answer. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header */}
      <div className="border-b pb-4" style={{ borderBottomColor: 'rgba(56, 145, 166, 0.2)' }}>
        <h2 className="text-2xl font-bold text-white mb-1">🔍 Clue Solver</h2>
        <p style={{ color: '#DDDBF1' }}>Find the key by solving these clues</p>
      </div>

      {/* Clues List */}
      <div className="flex-1 space-y-3 overflow-y-auto">
        {clues.map((clue) => (
          <div
            key={clue.id}
            className="border rounded-lg p-4"
            style={{
              backgroundColor: 'rgba(56, 145, 166, 0.08)',
              borderColor: '#3891A6',
            }}
          >
            <div className="flex items-start justify-between mb-2">
              <p className="text-sm font-semibold text-white">{clue.clue}</p>
              <span
                className="text-xs px-2 py-1 rounded capitalize"
                style={{
                  backgroundColor:
                    clue.difficulty === 'easy'
                      ? 'rgba(76, 175, 80, 0.2)'
                      : clue.difficulty === 'medium'
                        ? 'rgba(253, 231, 76, 0.2)'
                        : 'rgba(171, 159, 157, 0.2)',
                  color:
                    clue.difficulty === 'easy'
                      ? '#4CAF50'
                      : clue.difficulty === 'medium'
                        ? '#FDE74C'
                        : '#AB9F9D',
                }}
              >
                {clue.difficulty}
              </span>
            </div>

            {revealedHints.has(clue.id) && (
              <div
                className="text-xs p-2 rounded mb-2"
                style={{ backgroundColor: 'rgba(124, 58, 237, 0.15)', color: '#DDDBF1' }}
              >
                💡 <strong>Hint:</strong> {clue.hint}
              </div>
            )}

            <button
              onClick={() => handleRevealHint(clue.id)}
              disabled={revealedHints.has(clue.id)}
              className="text-xs px-3 py-1 rounded transition disabled:opacity-50"
              style={{
                backgroundColor: revealedHints.has(clue.id)
                  ? 'rgba(56, 145, 166, 0.3)'
                  : 'rgba(124, 58, 237, 0.3)',
                color: '#7C3AED',
                cursor: revealedHints.has(clue.id) ? 'default' : 'pointer',
              }}
            >
              {revealedHints.has(clue.id) ? '✓ Hint Revealed' : '💡 Show Hint'}
            </button>
          </div>
        ))}
      </div>

      {/* Answer Input */}
      <div className="border-t pt-4" style={{ borderTopColor: 'rgba(56, 145, 166, 0.2)' }}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-semibold mb-2 text-white">
              Your Answer (Key)
            </label>
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={isCorrect || submitting}
              placeholder="Enter the key or answer..."
              className="w-full px-4 py-3 rounded-lg border text-white placeholder-gray-500 transition"
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                borderColor: isCorrect ? '#4CAF50' : '#3891A6',
              }}
            />
          </div>

          {/* Feedback */}
          {currentFeedback && (
            <div
              className="text-sm p-3 rounded"
              style={{
                backgroundColor: isCorrect
                  ? 'rgba(76, 175, 80, 0.2)'
                  : 'rgba(171, 159, 157, 0.2)',
                color: isCorrect ? '#4CAF50' : '#AB9F9D',
              }}
            >
              {isCorrect ? '✓' : '×'} {currentFeedback}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!answer.trim() || submitting || isCorrect}
            className="w-full px-4 py-3 rounded-lg font-semibold transition disabled:opacity-50"
            style={{
              backgroundColor: isCorrect ? '#4CAF50' : '#3891A6',
              color: 'white',
              cursor: !answer.trim() || submitting || isCorrect ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? '⏳ Submitting...' : isCorrect ? '✓ Answer Submitted!' : 'Submit Answer'}
          </button>

          {isCorrect && (
            <p className="text-xs text-center" style={{ color: '#FDE74C' }}>
              Share your key with your Decoder partner via chat! 🔑
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
