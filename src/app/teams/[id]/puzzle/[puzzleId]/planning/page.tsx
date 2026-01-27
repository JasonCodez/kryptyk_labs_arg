"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";

export default function PlanningPage() {
  const params = useParams() as any;
  const teamId = params.id as string;
  const puzzleId = params.puzzleId as string;
  const router = useRouter();

  const [members, setMembers] = useState<any[]>([]);
  const [lobby, setLobby] = useState<any>(null);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [assignmentsDirty, setAssignmentsDirty] = useState(false);
  const assignmentsDirtyRef = useRef(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const socketRef = useRef<any>(null);
  const roles = ["Navigator", "Solver", "Researcher", "Observer"];

  useEffect(() => {
    fetchCurrentUser();
    fetchMembers();
    fetchLobby();
    const t = setInterval(fetchLobby, 3000);

    // setup socket to receive live assignment updates
    (async () => {
      try {
        const { io } = await import('socket.io-client');
        const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000', { transports: ['websocket'] });
        socketRef.current = socket;
        socket.on('connect', () => {
          // joinLobby will be emitted once currentUserId is available (see effect below)
        });
        socket.on('rolesAssigned', (payload: any) => {
          if (!payload) return;
          if (payload.assignments) {
            setAssignments(payload.assignments || {});
            setAssignmentsDirty(false);
            assignmentsDirtyRef.current = false;
          }
        });
        socket.on('participantLeft', (payload: any) => {
          try {
            const name = payload?.userName || payload?.userId || 'A player';
            // redirect back to lobby and show a notice
            const url = `/teams/${teamId}/lobby?puzzleId=${encodeURIComponent(puzzleId)}&notice=${encodeURIComponent(`${name} left the lobby`)}`;
            try { router.push(url); } catch (e) { window.location.href = url; }
          } catch (e) {
            // ignore
          }
        });
        socket.on('lobbyDestroyed', (payload: any) => {
          try {
            // leader left — notify and redirect to dashboard
            const msg = 'The team leader left the lobby. You will be returned to the dashboard.';
            try { alert(msg); } catch (e) {}
            try { router.push('/dashboard'); } catch (e) { window.location.href = '/dashboard'; }
          } catch (e) {
            // ignore
          }
        });
      } catch (e) {
        // ignore socket errors
      }
    })();

    return () => {
      clearInterval(t);
      try { socketRef.current?.disconnect(); } catch (e) {}
    };
  }, [teamId, puzzleId]);

  useEffect(() => {
    try {
      const member = members.find((m: any) => m.user?.id === currentUserId);
      const adminFlag = !!member && ["admin", "moderator"].includes(member.role);
      setIsAdmin(adminFlag);
      if (socketRef.current && socketRef.current.connected) {
        try {
          socketRef.current.emit('joinLobby', { teamId, puzzleId, userId: currentUserId || '', name: '', isAdmin: adminFlag });
        } catch (e) {}
      }
    } catch (e) {}
  }, [members, currentUserId]);

  async function fetchCurrentUser() {
    try {
      const res = await fetch('/api/user/info');
      if (!res.ok) return;
      const j = await res.json();
      setCurrentUserId(j.id || null);
    } catch (e) {}
  }

  async function fetchMembers() {
    try {
      const res = await fetch(`/api/teams/${teamId}`);
      if (!res.ok) return;
      const j = await res.json();
      setMembers(j.members || []);
    } catch (e) {
      // ignore
    }
  }

  async function fetchLobby() {
    try {
      const res = await fetch(`/api/team/lobby?teamId=${encodeURIComponent(teamId)}&puzzleId=${encodeURIComponent(puzzleId)}`);
      if (!res.ok) return;
      const j = await res.json();
      setLobby(j);
      // Only update assignments from server if local edits are not in progress
      if (j && j.assignments && !assignmentsDirtyRef.current) setAssignments(j.assignments || {});
    } catch (e) {
      // ignore
    }
  }

  function setRoleFor(userId: string, role: string) {
    setAssignments((s) => ({ ...(s || {}), [userId]: role }));
    setAssignmentsDirty(true);
    assignmentsDirtyRef.current = true;
  }

  async function saveAssignments() {
    setSaving(true);
    try {
      const res = await fetch('/api/team/lobby', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'assignRoles', teamId, puzzleId, assignments }) });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert('Failed to save: ' + (j?.error || res.statusText));
        return;
      }
      await fetchLobby();
      setAssignmentsDirty(false);
      assignmentsDirtyRef.current = false;
      alert('Roles saved');
    } catch (e) {
      alert('Failed to save roles');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen p-6" style={{ background: '#020202', paddingTop: 88 }}>
      <div className="max-w-3xl mx-auto bg-slate-900 border rounded-lg p-6">
        <h2 className="text-2xl text-white font-bold mb-4">Team Planning</h2>
        <p className="text-sm text-gray-300 mb-4">Assign roles to team participants before the puzzle starts. These assignments will be visible to the team.</p>

        <div className="space-y-3">
          {(lobby?.participants || []).length === 0 && <div className="text-sm text-gray-400">No participants in the lobby yet.</div>}

          {members.filter((m: any) => (lobby?.participants || []).includes(m.user?.id)).map((m: any) => {
            const uid = m.user.id;
            const current = assignments?.[uid] || '';
            // compute roles taken by others
            const takenByOthers = new Set(Object.entries(assignments || {})
              .filter(([k, v]) => k !== uid && !!v)
              .map(([k, v]) => v));
            const availableRoles = roles.filter((r) => !takenByOthers.has(r) || r === current);
            return (
              <div key={uid} className="flex items-center justify-between p-3 bg-slate-800 rounded">
                <div className="text-white">{m.user.name || m.user.email}</div>
                <div className="flex items-center gap-2">
                  {isAdmin ? (
                    <select value={current} onChange={(e) => setRoleFor(uid, e.target.value)} className="px-2 py-1 bg-black text-white border rounded">
                      <option value="">(unassigned)</option>
                      {availableRoles.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  ) : (
                    <div className="px-2 py-1 text-sm text-gray-300 bg-black border rounded">{current || '(unassigned)'}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex gap-2">
          {isAdmin && <button disabled={saving} onClick={saveAssignments} className="px-4 py-2 bg-emerald-600 text-white rounded">Save Roles</button>}
          <button onClick={() => router.back()} className="px-4 py-2 bg-slate-700 text-white rounded">Back</button>
        </div>
      </div>
    </div>
  );
}
