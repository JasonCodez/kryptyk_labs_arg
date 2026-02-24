

"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import CreateEscapeRoomForm from './CreateEscapeRoomForm';

interface EscapeRoom {
  id: string;
  roomTitle: string;
  roomDescription: string;
  minTeamSize: number;
  maxTeamSize: number;
  // Add other properties as needed
}

export default function EscapeRoomsPage() {
  const [rooms, setRooms] = useState<EscapeRoom[]>([]);
  const [loading, setLoading] = useState(true);


  const fetchRooms = () => {
    setLoading(true);
    fetch('/api/escape-rooms')
      .then(res => res.json())
      .then(data => {
        setRooms(data.escapeRooms || []);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Escape Rooms</h1>
      <CreateEscapeRoomForm onCreated={fetchRooms} />
      {loading ? (
        <div>Loading...</div>
      ) : rooms.length === 0 ? (
        <div>No escape rooms found.</div>
      ) : (
        <ul className="space-y-4">
          {rooms.map(room => (
            <li key={room.id} className="border p-4 rounded shadow">
              <Link href={`/escape-rooms/${room.id}`}
                className="text-lg font-semibold hover:underline">
                {room.roomTitle}
              </Link>
              <div className="text-sm text-gray-600">{room.roomDescription}</div>
              <div className="text-xs mt-2">Multiplayer team puzzle</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
