'use client';

import { useState } from 'react';

interface RelayDecoderViewProps {
  roomId: string;
  encryptedMessage: string;
  cipherType: string; // e.g., "shift", "substitution", "reverse"
  onSubmitSolution: (decodedMessage: string) => Promise<{ solved: boolean; feedback: string }>;
  solverReady?: boolean;
}

export default function RelayDecoderView({
  roomId,
  encryptedMessage,
  cipherType,
  onSubmitSolution,
  solverReady = false,
}: RelayDecoderViewProps) {
  const [key, setKey] = useState('');
  const [decoded, setDecoded] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isSolved, setIsSolved] = useState(false);
  const [feedback, setFeedback] = useState('');

  // Simple decode helper (example cipher types)
  const attemptDecode = (msg: string, k: string): string => {
    if (!msg) return '';
    if (!k) return '';
    
    if (cipherType === 'shift') {
      const shift = parseInt(k) || 0;
      return msg
        .split('')
        .map((c) => {
          if (/[a-z]/.test(c)) {
            return String.fromCharCode(((c.charCodeAt(0) - 97 - shift + 26) % 26) + 97);
          }
          if (/[A-Z]/.test(c)) {
            return String.fromCharCode(((c.charCodeAt(0) - 65 - shift + 26) % 26) + 65);
          }
          return c;
        })
        .join('');
    }

    if (cipherType === 'reverse') {
      // Reverse cipher with key validation
      const reversed = msg.split('').reverse().join('');
      return k === 'reverse' ? reversed : '';
    }

    if (cipherType === 'substitution') {
      // Example: replace vowels with key pattern
      if (k.length < 5) return ''; // Must have 5-char key for a,e,i,o,u
      const vowels = 'aeiouAEIOU';
      return msg
        .split('')
        .map((c) => {
          const idx = vowels.indexOf(c);
          return idx >= 0 ? k[idx % k.length] : c;
        })
        .join('');
    }

    return '';
  };

  const handleDecode = () => {
    if (!key) return;
    const result = attemptDecode(encryptedMessage, key);
    setDecoded(result);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decoded.trim() || submitting) return;

    setSubmitting(true);
    try {
      const result = await onSubmitSolution(decoded);
      setIsSolved(result.solved);
      setFeedback(result.feedback);
    } catch (error) {
      console.error('Failed to submit solution:', error);
      setFeedback('Error submitting solution. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header */}
      <div className="border-b pb-4" style={{ borderBottomColor: 'rgba(56, 145, 166, 0.2)' }}>
        <h2 className="text-2xl font-bold text-white mb-1">🔐 Decoder</h2>
        <p style={{ color: '#DDDBF1' }}>Decrypt the message using the key from your Solver</p>
      </div>

      {/* Cipher Info */}
      <div
        className="border rounded-lg p-4"
        style={{
          backgroundColor: 'rgba(124, 58, 237, 0.08)',
          borderColor: '#7C3AED',
        }}
      >
        <p className="text-sm" style={{ color: '#AB9F9D' }}>
          Cipher Type: <strong style={{ color: '#7C3AED' }}>{cipherType.toUpperCase()}</strong>
        </p>
        <p className="text-xs mt-1" style={{ color: '#DDDBF1' }}>
          {cipherType === 'shift' && 'Shift cipher - key is a number'}
          {cipherType === 'reverse' && 'Reverse cipher - key is "reverse"'}
          {cipherType === 'substitution' && 'Substitution cipher - key replaces vowels'}
        </p>
      </div>

      {/* Encrypted Message */}
      <div
        className="border rounded-lg p-4"
        style={{
          backgroundColor: 'rgba(56, 145, 166, 0.08)',
          borderColor: '#3891A6',
        }}
      >
        <p className="text-sm mb-2" style={{ color: '#AB9F9D' }}>
          Encrypted Message
        </p>
        <div
          className="p-3 rounded font-mono text-sm break-all"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            color: '#FDE74C',
          }}
        >
          {encryptedMessage}
        </div>
      </div>

      {/* Key Input & Decode */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-semibold mb-2 text-white">
            Decryption Key
          </label>
          <input
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            disabled={!solverReady || isSolved}
            placeholder="Wait for your Solver to share the key..."
            className="w-full px-4 py-3 rounded-lg border text-white placeholder-gray-500 transition"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              borderColor: !solverReady ? '#AB9F9D' : '#3891A6',
              opacity: !solverReady ? 0.5 : 1,
            }}
          />
          {!solverReady && (
            <p className="text-xs mt-1" style={{ color: '#AB9F9D' }}>
              ⏳ Waiting for Solver to submit their answer...
            </p>
          )}
        </div>

        <button
          onClick={handleDecode}
          disabled={!key || !solverReady || isSolved}
          className="w-full px-4 py-3 rounded-lg font-semibold transition disabled:opacity-50"
          style={{
            backgroundColor: 'rgba(124, 58, 237, 0.3)',
            color: '#7C3AED',
            cursor: !key || !solverReady || isSolved ? 'not-allowed' : 'pointer',
          }}
        >
          {isSolved ? '✓ Solved!' : '🔓 Attempt Decode'}
        </button>
      </div>

      {/* Decoded Result */}
      {decoded && (
        <div
          className="border rounded-lg p-4"
          style={{
            backgroundColor: 'rgba(76, 175, 80, 0.08)',
            borderColor: '#4CAF50',
          }}
        >
          <p className="text-sm mb-2" style={{ color: '#AB9F9D' }}>
            Decoded Message
          </p>
          <div
            className="p-3 rounded font-mono text-sm break-all"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              color: '#4CAF50',
            }}
          >
            {decoded}
          </div>
        </div>
      )}

      {/* Feedback */}
      {feedback && (
        <div
          className="text-sm p-3 rounded"
          style={{
            backgroundColor: isSolved
              ? 'rgba(76, 175, 80, 0.2)'
              : 'rgba(171, 159, 157, 0.2)',
            color: isSolved ? '#4CAF50' : '#AB9F9D',
          }}
        >
          {isSolved ? '✓' : '×'} {feedback}
        </div>
      )}

      {/* Submit Button */}
      <form onSubmit={handleSubmit}>
        <button
          type="submit"
          disabled={!decoded || submitting || isSolved}
          className="w-full px-4 py-3 rounded-lg font-semibold transition disabled:opacity-50"
          style={{
            backgroundColor: isSolved ? '#4CAF50' : '#FDE74C',
            color: isSolved ? 'white' : '#020202',
            cursor: !decoded || submitting || isSolved ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? '⏳ Submitting...' : isSolved ? '🎉 Puzzle Solved!' : 'Confirm & Submit'}
        </button>
      </form>
    </div>
  );
}
