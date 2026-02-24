"use client";

import React, { useState } from 'react';

export default function EditEscapeRoomForm({ room, onUpdated }: { room: any, onUpdated?: () => void }) {
  const [roomTitle, setRoomTitle] = useState(room.roomTitle || '');
  const [roomDescription, setRoomDescription] = useState(room.roomDescription || '');
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(room.timeLimitSeconds || 1200);
  const [puzzleId, setPuzzleId] = useState(room.puzzleId || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/escape-rooms/${room.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          puzzleId,
          roomTitle,
          roomDescription,
          timeLimitSeconds,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to update escape room');
      } else {
        if (onUpdated) onUpdated();
      }
    } catch (err) {
      setError('Network error');
    }
    setLoading(false);
  };

  return (
    <form className="border p-4 rounded mb-6" onSubmit={handleSubmit}>
      <h2 className="text-lg font-semibold mb-2">Edit Escape Room</h2>
      <div className="mb-2">
        <label className="block text-sm">Puzzle ID</label>
        <input value={puzzleId} onChange={e => setPuzzleId(e.target.value)} required className="border rounded px-2 py-1 w-full" />
      </div>
      <div className="mb-2">
        <label className="block text-sm">Room Title</label>
        <input value={roomTitle} onChange={e => setRoomTitle(e.target.value)} required className="border rounded px-2 py-1 w-full" />
      </div>
      <div className="mb-2">
        <label className="block text-sm">Room Description</label>
        <input value={roomDescription} onChange={e => setRoomDescription(e.target.value)} required className="border rounded px-2 py-1 w-full" />
      </div>
      <div className="mb-2">
        <label className="block text-sm">Team Size</label>
        <div className="text-sm text-gray-700">Team-only puzzle (min players set below)</div>
      </div>
      <div className="mb-2">
        <label className="block text-sm">Time Limit (seconds)</label>
        <input type="number" value={timeLimitSeconds} min={60} onChange={e => setTimeLimitSeconds(Number(e.target.value))} required className="border rounded px-2 py-1 w-32" />
      </div>
      {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded" disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</button>
    </form>
  );
}
