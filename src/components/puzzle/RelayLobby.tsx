'use client';

import { useState, useEffect } from 'react';

interface RelayLobbyProps {
  roomId: string;
  onJoinSolver: () => void;
  onJoinDecoder: () => void;
  waitingFor?: string; // "solver" | "decoder"
  timeRemaining?: number; // seconds
}

export default function RelayLobby({
  roomId,
  onJoinSolver,
  onJoinDecoder,
  waitingFor,
  timeRemaining = 1800, // 30 min default
}: RelayLobbyProps) {
  const [countdown, setCountdown] = useState(timeRemaining);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
    >
      <div
        className="rounded-lg p-8 max-w-md w-full border"
        style={{ backgroundColor: '#0f172a', borderColor: '#3891A6' }}
      >
        <h1 className="text-3xl font-bold text-white mb-2 text-center">🔁 Relay Riddle</h1>
        <p className="text-center mb-6" style={{ color: '#DDDBF1' }}>
          Join a team and collaborate to solve this asymmetric puzzle!
        </p>

        {/* Room Code */}
        <div className="mb-6 p-4 rounded-lg text-center" style={{ backgroundColor: 'rgba(56, 145, 166, 0.15)', borderColor: '#3891A6', borderWidth: '1px' }}>
          <p className="text-sm" style={{ color: '#AB9F9D' }}>Room Code</p>
          <p className="text-2xl font-bold text-white font-mono">{roomId}</p>
        </div>

        {/* Timer */}
        <div className="mb-6 text-center">
          <p className="text-sm" style={{ color: '#AB9F9D' }}>Session expires in</p>
          <p className="text-xl font-bold" style={{ color: countdown < 300 ? '#FF6B6B' : '#FDE74C' }}>
            ⏱️ {formatTime(countdown)}
          </p>
        </div>

        {/* Role Selection */}
        <div className="space-y-3">
          <button
            onClick={onJoinSolver}
            disabled={waitingFor === 'decoder'}
            className="w-full px-6 py-3 rounded-lg font-semibold transition disabled:opacity-50"
            style={{
              backgroundColor: '#3891A6',
              color: 'white',
              cursor: waitingFor === 'decoder' ? 'not-allowed' : 'pointer',
            }}
          >
            {waitingFor === 'decoder' ? '✓ Solver Ready' : '🔍 Join as Solver'}
          </button>

          <button
            onClick={onJoinDecoder}
            disabled={waitingFor === 'solver'}
            className="w-full px-6 py-3 rounded-lg font-semibold transition disabled:opacity-50"
            style={{
              backgroundColor: '#FDE74C',
              color: '#020202',
              cursor: waitingFor === 'solver' ? 'not-allowed' : 'pointer',
            }}
          >
            {waitingFor === 'solver' ? '✓ Decoder Ready' : '🔐 Join as Decoder'}
          </button>
        </div>

        {/* Instructions */}
        <div className="mt-6 p-4 rounded-lg" style={{ backgroundColor: 'rgba(124, 58, 237, 0.1)', borderColor: '#7C3AED', borderWidth: '1px' }}>
          <p className="text-xs font-semibold text-white mb-2">How it works:</p>
          <ul className="text-xs space-y-1" style={{ color: '#DDDBF1' }}>
            <li>• <strong>Solver</strong> answers clues to find a key</li>
            <li>• <strong>Decoder</strong> unlocks encrypted message using that key</li>
            <li>• Use the chat to collaborate with your partner</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
