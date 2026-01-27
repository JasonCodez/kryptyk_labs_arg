"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";
import ActionModal from "@/components/ActionModal";

export default function TeamLobbyPage() {
  const params = useParams();
  const teamId = params.id as string;
  const router = useRouter();

  const [puzzleId, setPuzzleId] = useState("");
  const [teamPuzzles, setTeamPuzzles] = useState<any[]>([]);
  const [selectedPuzzle, setSelectedPuzzle] = useState<any | null>(null);
  const [navHeight, setNavHeight] = useState<number | null>(null);
  const [lobby, setLobby] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  // Chat state
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatAbortRef = useRef<AbortController | null>(null);
  const socketRef = useRef<any>(null);
  const prevParticipantsRef = useRef<string[]>([]);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | "create" | "ready" | "unready" | "start" | "refresh" | "invite" | "leave" | "destroy">(null);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionModalVariant, setActionModalVariant] = useState<"success" | "error" | "info">("info");
  const [actionModalTitle, setActionModalTitle] = useState<string | undefined>(undefined);
  const [actionModalMessage, setActionModalMessage] = useState<string | undefined>(undefined);
  const [redirectOnClose, setRedirectOnClose] = useState(false);
  const [selfLeaving, setSelfLeaving] = useState(false);

  async function fetchMembers() {
    try {
      const res = await fetch(`/api/teams/${teamId}`);
      if (res.ok) {
        const team = await res.json();
        setMembers(team.members || []);
      }
    } catch (e) {
      console.error("Failed load members", e);
    }
  }

  async function fetchTeamPuzzles() {
    try {
      const res = await fetch(`/api/puzzles?limit=100&isTeam=true`);
      if (!res.ok) return;
      const list = await res.json();
      const normalized = list.map((p: any) => ({ ...p, partsCount: Array.isArray(p.parts) ? p.parts.length : 0 }));
      setTeamPuzzles(normalized);
      if (normalized.length > 0 && !puzzleId) {
        setPuzzleId(normalized[0].id);
        setSelectedPuzzle(normalized[0]);
      }
    } catch (e) {
      console.error("Failed load team puzzles", e);
    }
  }

  async function fetchCurrentUser() {
    try {
      const res = await fetch("/api/user/info");
      if (!res.ok) return;
      const j = await res.json();
      setCurrentUserId(j.id || null);
    } catch (e) {
      // ignore
    }
  }

  async function fetchLobby() {
    if (!teamId || !puzzleId) return;
    try {
      const res = await fetch(`/api/team/lobby?teamId=${encodeURIComponent(teamId)}&puzzleId=${encodeURIComponent(puzzleId)}`);
      if (res.ok) {
        const j = await res.json();
        // if lobby no longer exists, leave `lobby` null so auto-join can create it
        if (j && j.exists === false) {
          setLobby(null);
          return;
        }
        setLobby(j);
        return j;
      }
    } catch (e) {
      console.error("Failed load lobby", e);
    }
  }

  // Chat fetch/post helpers
  const fetchChat = async () => {
    if (!teamId || !puzzleId) return;
    try {
      chatAbortRef.current?.abort();
      const c = new AbortController();
      chatAbortRef.current = c;
      const res = await fetch(`/api/team/lobby/chat?teamId=${encodeURIComponent(teamId)}&puzzleId=${encodeURIComponent(puzzleId)}&limit=200`, { signal: c.signal });
      if (!res.ok) return;
      const j = await res.json();
      setChatMessages(Array.isArray(j.messages) ? j.messages : []);
    } catch (e) {
      if (e && (e as any).name === 'AbortError') return;
      console.error('Failed to fetch chat', e);
    }
  };

  const postChatMessage = async (content: string) => {
    if (!teamId || !puzzleId || !content.trim()) return;
    try {
      const res = await fetch('/api/team/lobby/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teamId, puzzleId, content }) });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || res.statusText);
      }
      setChatInput('');
      await fetchChat();
      // emit via socket so other clients see it immediately
      try {
        if (socketRef.current) {
          socketRef.current.emit('chatMessage', { teamId, puzzleId, message: { userId: currentUserId, content, createdAt: new Date().toISOString() } });
        }
      } catch (e) {
        // ignore
      }
    } catch (e) {
      console.error('Failed to post chat', e);
      openActionModal('error', 'Chat Error', (e as any).message || 'Failed to post message');
    }
  };

  const deleteChatMessage = async (messageId: string) => {
    try {
      const res = await fetch('/api/team/lobby/chat', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messageId }) });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || res.statusText);
      }
      await fetchChat();
    } catch (e) {
      console.error('Failed to delete chat message', e);
      openActionModal('error', 'Chat Error', (e as any).message || 'Failed to delete message');
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [teamId]);

  useEffect(() => {
    fetchTeamPuzzles();
  }, []);

  // Measure navbar height
  useEffect(() => {
    function measure() {
      try {
        const nav = document.getElementById("global-nav");
        const h = nav ? nav.offsetHeight : 0;
        setNavHeight(h ? h + 12 : 72);
      } catch (e) {
        setNavHeight(72);
      }
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    const t = setInterval(fetchLobby, 2000);
    fetchLobby();
    // start chat polling a bit less frequently
    const tc = setInterval(fetchChat, 3000);
    fetchChat();
    return () => {
      clearInterval(t);
      clearInterval(tc);
      chatAbortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, puzzleId]);

  // Auto-join lobby when visiting: add current user as participant if not present
  useEffect(() => {
    async function joinIfNeeded() {
      if (!teamId || !puzzleId || !currentUserId) return;
      try {
        const res = await fetch(`/api/team/lobby?teamId=${encodeURIComponent(teamId)}&puzzleId=${encodeURIComponent(puzzleId)}`);
        if (!res.ok) return;
        const j = await res.json();
        const participants = j?.participants || [];
        if (participants.includes(currentUserId)) return;
        await fetch("/api/team/lobby", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", teamId, puzzleId }) });
        // refresh lobby and seed prevParticipants to avoid false "removed" modal during immediate join
        const newLobby = await fetchLobby();
        try { prevParticipantsRef.current = (newLobby?.participants || []).slice(); } catch (e) {}
      } catch (e) {
        console.error("Auto-join failed", e);
      }
    }
    joinIfNeeded();
  }, [teamId, puzzleId, currentUserId]);

  useEffect(() => {
    if (!lobby || !currentUserId) return;
    setIsReady(!!lobby.ready?.[currentUserId]);
  }, [lobby, currentUserId]);

  
  // Socket.IO realtime sync
  useEffect(() => {
    let mounted = true;
    if (!teamId || !puzzleId || !currentUserId) return;

    let beforeUnloadHandler: (() => void) | null = null;
    (async () => {
      try {
        const { io } = await import('socket.io-client');
        const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000', { transports: ['websocket'] });
        socketRef.current = socket;

        socket.on('connect', () => {
          try {
            const member = members.find((m: any) => m.user?.id === currentUserId);
            const adminFlag = !!member && ["admin", "moderator"].includes(member.role);
            socket.emit('joinLobby', { teamId, puzzleId, userId: currentUserId, name: '', isAdmin: adminFlag });
          } catch (e) {
            socket.emit('joinLobby', { teamId, puzzleId, userId: currentUserId, name: '', isAdmin: false });
          }
        });

        socket.on('lobbyState', (state: any) => {
          if (!mounted) return;
          // merge into local lobby shape minimally
          setLobby((prev: any) => ({ ...(prev || {}), participants: (state.participants || []).map((p: any) => p.userId), ready: state.ready }));
        });

        socket.on('chatMessage', (msg: any) => {
          if (!mounted) return;
          setChatMessages((prev) => (prev || []).concat(msg));
        });

        socket.on('lobbyDestroyed', ({ teamId: t, puzzleId: p, reason }: any) => {
          if (!mounted) return;
          setActionModalVariant('info');
          setActionModalTitle('Lobby Closed');
          setActionModalMessage('The team leader left the lobby. Click Close to go to the dashboard.');
          setRedirectOnClose(true);
          setActionModalOpen(true);
        });

        socket.on('puzzleStarting', ({ teamId: t, puzzleId: p }) => {
          if (!mounted) return;
          // navigate to planning/role assignment screen
          router.push(`/teams/${teamId}/puzzle/${puzzleId}/planning`);
        });

        socket.on('startFailed', (err: any) => {
          if (!mounted) return;
          openActionModal('error', 'Start Failed', err?.error || 'Failed to start puzzle');
        });

        // beforeunload handler: try to notify server that user left
        beforeUnloadHandler = () => {
          try {
            if (socketRef.current && socketRef.current.connected && currentUserId) {
              try { socketRef.current.emit('leaveLobby', { teamId, puzzleId, userId: currentUserId }); } catch (e) {}
            }
          } catch (e) {
            // ignore
          }
          try {
            const payload = JSON.stringify({ action: 'leave', teamId, puzzleId });
            try { navigator.sendBeacon('/api/team/lobby', payload); } catch (e) { /* ignore */ }
          } catch (e) {
            // ignore
          }
        };
        try { window.addEventListener('beforeunload', beforeUnloadHandler); } catch (e) { /* ignore */ }
      } catch (e) {
        console.error('Socket setup failed', e);
      }
    })();

    return () => {
      mounted = false;
      try {
        // inform server we are leaving the lobby (SPA navigation)
        if (socketRef.current && currentUserId) {
          try { socketRef.current.emit('leaveLobby', { teamId, puzzleId, userId: currentUserId }); } catch (e) {}
        }
        // attempt an async leave request
        (async () => {
          try { await fetch('/api/team/lobby', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'leave', teamId, puzzleId }) }); } catch (e) { /* ignore */ }
        })();
      } catch (e) {
        // ignore
      }
      try { if (beforeUnloadHandler) window.removeEventListener('beforeunload', beforeUnloadHandler); } catch (e) {}
      try { socketRef.current?.disconnect(); } catch (e) {}
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, puzzleId, currentUserId, members]);

  // Ensure server gets updated isAdmin flag if members or currentUserId change after socket connected
  useEffect(() => {
    try {
      const member = members.find((m: any) => m.user?.id === currentUserId);
      const adminFlag = !!member && ["admin", "moderator"].includes(member.role);
      if (socketRef.current && socketRef.current.connected) {
        try {
          socketRef.current.emit('joinLobby', { teamId, puzzleId, userId: currentUserId, name: '', isAdmin: adminFlag });
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, currentUserId]);

  // Listen for explicit server-side removal events rather than inferring removals from state diffs.
  useEffect(() => {
    // 'kicked' will be emitted by the lobby API when an admin removes a participant
    try {
      const handler = (payload: any) => {
        try {
          const target = payload?.targetUserId;
          if (target && target === currentUserId) {
            setActionModalVariant('info');
            setActionModalTitle('Removed from Lobby');
            setActionModalMessage('An admin removed you from the puzzle lobby. Click Close to go to the dashboard.');
            setRedirectOnClose(true);
            setActionModalOpen(true);
          } else {
            // someone else was kicked — show a small info modal
            const removedMember = members.find((m: any) => m.user?.id === target);
            const label = removedMember ? (removedMember.user.name || removedMember.user.email) : target;
            setActionModalVariant('info');
            setActionModalTitle('Player Removed');
            setActionModalMessage(`${label} has been removed from the lobby.`);
            setActionModalOpen(true);
          }
        } catch (e) {
          // ignore
        }
      };

      socketRef.current?.on('kicked', handler);
      return () => { try { socketRef.current?.off('kicked', handler); } catch (e) {} };
    } catch (e) {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, members]);

  // Show notice passed through URL (e.g., ?notice=...)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const notice = params.get('notice');
      if (notice) {
        setActionModalVariant('info');
        setActionModalTitle('Notice');
        setActionModalMessage(notice);
        setActionModalOpen(true);
        // remove the notice param so it doesn't re-show
        params.delete('notice');
        const base = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
        history.replaceState({}, '', base);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // determine if current user is admin/moderator of the team
  const currentMember = members.find((m: any) => m.user?.id === currentUserId);
  const isAdmin = !!currentMember && ["admin", "moderator"].includes(currentMember.role);
  
  const participantsCount = (lobby?.participants || []).length;
  const requiredPlayers = selectedPuzzle?.partsCount || 0;
  const requiredMet = selectedPuzzle && participantsCount >= requiredPlayers;
  const allReady = (lobby?.participants || []).length > 0 && (lobby?.participants || []).every((p: string) => !!(lobby?.ready && lobby.ready[p]));

  const openActionModal = (variant: "success" | "error" | "info", title?: string, message?: string) => {
    setActionModalVariant(variant);
    setActionModalTitle(title);
    setActionModalMessage(message);
    setActionModalOpen(true);
  };

  const onCreateClick = () => {
    if (!puzzleId.trim()) return openActionModal("error", "Missing Puzzle", "Select a puzzle to create a lobby.");
    setConfirmAction("create");
    setConfirmOpen(true);
  };

  const onInviteClick = () => {
    if (!inviteEmail.trim()) return openActionModal("error", "Missing email", "Enter an email to invite");
    if (!puzzleId.trim()) return openActionModal("error", "Missing Puzzle", "Select a puzzle before inviting");
    setConfirmAction("invite");
    setConfirmOpen(true);
  };

  const onToggleReadyClick = () => {
    if (!currentUserId) return openActionModal("error", "Not signed in", "Sign in to ready up");
    if (!puzzleId.trim()) return openActionModal("error", "Missing Puzzle", "Select a puzzle before readying up");
    setConfirmAction(isReady ? "unready" : "ready");
    setConfirmOpen(true);
  };

  const onLeaveClick = () => {
    if (!currentUserId) return openActionModal("error", "Not signed in", "Sign in to leave the lobby");
    if (isAdmin) {
      // admins destroying the lobby when they leave
      setConfirmAction("destroy");
    } else {
      setConfirmAction("leave");
    }
    setConfirmOpen(true);
  };

  const onStartClick = () => {
    if (!puzzleId.trim()) return openActionModal("error", "Missing Puzzle", "Select a puzzle before starting");
    setConfirmAction("start");
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    setConfirmOpen(false);
    if (!confirmAction) return;

    try {
      if (confirmAction === "create") {
        const res = await fetch("/api/team/lobby", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", teamId, puzzleId }) });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) return openActionModal("error", "Create Lobby Failed", j?.error || res.statusText);
        await fetchLobby();
        return openActionModal("success", "Lobby Created", "Lobby created — members can now ready up.");
      }

      if (confirmAction === "ready" || confirmAction === "unready") {
        const action = confirmAction === "ready" ? "ready" : "unready";
        const res = await fetch("/api/team/lobby", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, teamId, puzzleId }) });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) return openActionModal("error", "Failed", j?.error || res.statusText);
        await fetchLobby();
        return openActionModal("success", confirmAction === "ready" ? "You are Ready" : "You are Not Ready", confirmAction === "ready" ? "You have marked yourself ready." : "You are no longer marked ready.");
      }

      if (confirmAction === "start") {
        const res = await fetch("/api/team/lobby", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start", teamId, puzzleId }) });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) return openActionModal("error", "Start Failed", j?.error || res.statusText);
        // success -> navigate to team planning so leader can assign roles
        router.push(`/teams/${teamId}/puzzle/${puzzleId}/planning`);
      }
      if (confirmAction === "destroy") {
        const res = await fetch("/api/team/lobby", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "destroy", teamId, puzzleId }) });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) return openActionModal("error", "Destroy Failed", j?.error || res.statusText);
        // on destroy, redirect current user (and others will be redirected when fetchLobby sees no lobby)
        router.push("/dashboard");
        return;
      }
      if (confirmAction === "leave") {
        const res = await fetch("/api/team/lobby", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "leave", teamId, puzzleId }) });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) return openActionModal("error", "Leave Failed", j?.error || res.statusText);
        // redirect the user to the dashboard immediately after leaving the lobby
        try { router.push('/dashboard'); } catch (e) { window.location.href = '/dashboard'; }
        return;
      }
      if (confirmAction === "invite") {
        try {
          const res = await fetch("/api/team/lobby", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "invite", teamId, puzzleId, inviteeEmail: inviteEmail.trim() }) });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) return openActionModal("error", "Invite Failed", j?.error || res.statusText);
          await fetchLobby();
          setInviteEmail("");
          return openActionModal("success", "Invited", `Invitation sent to ${inviteEmail}`);
        } catch (e) {
          console.error("Invite failed", e);
          return openActionModal("error", "Invite Failed", "An unexpected error occurred.");
        }
      }
    } catch (err) {
      console.error("Confirm action failed", err);
      openActionModal("error", "Error", "An unexpected error occurred.");
    } finally {
      setConfirmAction(null);
    }
  };

  return (
    <div className="min-h-screen p-6" style={{ background: "#020202", paddingTop: navHeight ? `${navHeight}px` : undefined }}>
      <div className="max-w-3xl mx-auto bg-slate-900 border rounded-lg p-6">
        <h2 className="text-2xl text-white font-bold mb-4">Team Lobby</h2>

        <div className="mb-4">
          <label className="text-sm text-gray-300 block mb-2">{isAdmin ? 'Choose Team Puzzle' : 'Team Puzzle'}</label>
          {isAdmin ? (
            <select value={puzzleId} onChange={(e) => {
              const id = e.target.value;
              setPuzzleId(id);
              const found = teamPuzzles.find((p) => p.id === id) || null;
              setSelectedPuzzle(found);
            }} className="w-full px-3 py-2 rounded bg-black text-white border">
              <option value="">-- Select a puzzle --</option>
              {teamPuzzles.map((p) => (
                <option key={p.id} value={p.id}>{p.title} (players: {p.partsCount || 0})</option>
              ))}
            </select>
          ) : (
            <div className="w-full px-3 py-2 rounded bg-black text-white border">
              {selectedPuzzle?.title || (puzzleId ? puzzleId : 'No puzzle selected')}
            </div>
          )}
          <div className="flex gap-2 mt-3">
            <button onClick={fetchLobby} className="px-4 py-2 bg-slate-700 text-white rounded">Refresh</button>
          </div>

          {selectedPuzzle && (
            <div className="mt-3 text-sm text-gray-300">
              Required players: <span className="font-semibold text-white">{selectedPuzzle.partsCount || 0}</span>
            </div>
          )}

          {selectedPuzzle && members.length < (selectedPuzzle.partsCount || 0) && (
            <div className="mt-3 p-3 rounded border bg-slate-800 border-slate-700">
              {isAdmin ? (
                <div className="text-sm text-amber-200">
                  Your team has <strong className="text-white">{members.length}</strong> member(s), but this puzzle requires <strong className="text-white">{selectedPuzzle.partsCount}</strong> players.
                  <div>If you don't have enough members yet, invite teammates or add them to the team before starting the puzzle.</div>
                  <div className="mt-2"><a className="text-sky-400 underline" href={`/teams/${teamId}`}>Manage team members</a></div>
                </div>
              ) : (
                <div className="text-sm text-gray-300">
                  This puzzle requires <strong className="text-white">{selectedPuzzle.partsCount}</strong> players but your team currently has <strong className="text-white">{members.length}</strong>.
                  Ask a team admin to add members or invite teammates to join the lobby.
                </div>
              )}
            </div>
          )}

          {isAdmin && (
            <div className="mt-4">
              <label className="text-sm text-gray-300 block mb-2">Invite members to lobby</label>
              {requiredMet ? (
                <div className="p-3 rounded bg-slate-800 text-sm text-emerald-300">Required players met — cannot invite more members.</div>
              ) : (
                <div className="space-y-2">
                  {members
                    .filter((m: any) => m.user?.id && m.user.id !== currentUserId)
                    .map((m: any) => {
                      const memberId = m.user.id;
                      const alreadyParticipant = (lobby?.participants || []).includes(memberId);
                      const alreadyInvited = (lobby?.invites || []).some((inv: any) => inv.userId === memberId || inv.email === m.user.email);
                      const inviteLimitReached = selectedPuzzle && (((lobby?.participants || []).length + (lobby?.invites?.length || 0)) >= (selectedPuzzle?.partsCount || 0) || requiredMet);
                      return (
                        <div key={memberId} className="flex items-center justify-between p-2 bg-slate-800 rounded">
                          <div className="text-gray-200">{m.user.name || m.user.email}</div>
                          <div>
                            {alreadyParticipant ? (
                              <span className="text-xs text-gray-400">Participant</span>
                            ) : alreadyInvited ? (
                              <span className="text-xs text-gray-400">Invited</span>
                            ) : (
                              <button
                                onClick={async () => {
                                  if (!selectedPuzzle) return openActionModal('error', 'Missing Puzzle', 'Select a puzzle before inviting');
                                  if (inviteLimitReached) return openActionModal('error', 'Invite Limit', 'Invite limit reached for selected puzzle.');
                                  try {
                                    const res = await fetch('/api/team/lobby', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'invite', teamId, puzzleId, inviteeUserId: memberId }) });
                                    const j = await res.json().catch(() => ({}));
                                    if (!res.ok) return openActionModal('error', 'Invite Failed', j?.error || res.statusText);
                                    await fetchLobby();
                                    openActionModal('success', 'Invited', `Invitation sent to ${m.user.name || m.user.email}`);
                                  } catch (err) {
                                    console.error('Invite failed', err);
                                    openActionModal('error', 'Invite Failed', 'An unexpected error occurred.');
                                  }
                                }}
                                disabled={!selectedPuzzle || inviteLimitReached}
                                className="px-3 py-1 rounded bg-indigo-600 text-white disabled:opacity-50 text-xs"
                              >
                                Invite
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mb-4">
          <h3 className="text-white font-semibold">Participants in lobby: {participantsCount}/{requiredPlayers || '—'}</h3>
          <div className="mt-2 space-y-2">
            {participantsCount === 0 && (
              <div className="text-sm text-gray-400">No participants yet. Click "Create / Join Lobby" to join.</div>
            )}
            
          {(() => {
            const parts = (lobby?.participants || []).map((p: any) => {
              if (!p) return null;
              if (typeof p === 'string') return { userId: p, name: undefined };
              return { userId: p.userId || p.userId, name: p.name || p.userName || undefined };
            }).filter(Boolean as any);

            return parts.map((part: any) => {
              const uid = part.userId;
              const member = members.find((m: any) => m.user?.id === uid);
              const label = member ? (member.user.name || member.user.email) : (part.name || uid);
              return (
                <div key={uid} className="flex items-center justify-between p-2 bg-slate-800 rounded">
                  <div className="text-white">{label}</div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm">
                      {lobby?.ready && lobby.ready[uid] ? (
                        <span className="text-emerald-400 font-bold">READY!</span>
                      ) : (
                        <span className="text-red-500">Not ready</span>
                      )}
                    </div>
                    {isAdmin && uid !== currentUserId && (
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch('/api/team/lobby', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'kick', teamId, puzzleId, targetUserId: uid }) });
                            const j = await res.json().catch(() => ({}));
                            if (!res.ok) return openActionModal('error', 'Remove Failed', j?.error || res.statusText);
                            await fetchLobby();
                            openActionModal('info', 'Removed', `${label} was removed from the lobby.`);
                          } catch (err) {
                            console.error('Remove participant failed', err);
                            openActionModal('error', 'Remove Failed', 'An unexpected error occurred.');
                          }
                        }}
                        className="px-2 py-1 rounded bg-red-600 text-white text-xs"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            });
          })()}
          </div>

          {lobby?.invites && lobby.invites.length > 0 && (
            <div className="mt-3">
              <h4 className="text-sm text-gray-300">Invites</h4>
              <div className="mt-2 space-y-2">
                {lobby.invites.map((inv: any) => {
                  const inviter = members.find((m: any) => m.user?.id === inv.invitedBy);
                  const inviterLabel = inviter ? (inviter.user.name || inviter.user.email) : inv.invitedBy;
                  return (
                    <div key={inv.id} className="flex items-center justify-between p-2 bg-slate-800 rounded">
                      <div className="text-gray-200">{inv.email || inv.userId} <span className="text-xs text-gray-400">({inv.status})</span></div>
                      <div className="flex items-center gap-3">
                        <div className="text-xs text-gray-400">Invited by: {inviterLabel}</div>
                        {isAdmin && (
                          <button
                            onClick={async () => {
                              try {
                                const res = await fetch('/api/team/lobby', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'uninvite', teamId, puzzleId, inviteId: inv.id }) });
                                const j = await res.json().catch(() => ({}));
                                if (!res.ok) return openActionModal('error', 'Uninvite Failed', j?.error || res.statusText);
                                await fetchLobby();
                                openActionModal('success', 'Invite Revoked', `Invitation revoked for ${inv.email || inv.userId}`);
                              } catch (err) {
                                console.error('Uninvite failed', err);
                                openActionModal('error', 'Uninvite Failed', 'An unexpected error occurred.');
                              }
                            }}
                            className="px-2 py-1 rounded bg-red-600 text-white text-xs"
                          >
                            Uninvite
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={onToggleReadyClick} className="w-full sm:w-auto text-sm px-3 py-2 bg-amber-500 text-black rounded">Ready / Unready</button>
          {isAdmin && (
            <button
              onClick={onStartClick}
              disabled={!selectedPuzzle || (lobby?.participants || []).length !== (selectedPuzzle?.partsCount || 0) || !allReady}
              className="w-full sm:w-auto text-sm px-3 py-2 bg-emerald-600 text-white rounded disabled:opacity-50"
              title={!allReady ? 'All participants must be marked ready before starting' : undefined}
            >
              Start Puzzle
            </button>
          )}
          {(lobby?.participants || []).includes(currentUserId) && (
            <button onClick={onLeaveClick} className="w-full sm:w-auto text-sm px-3 py-2 bg-red-600 text-white rounded">Leave Lobby</button>
          )}
        </div>

        <div className="mt-4 bg-slate-900 border rounded-lg p-4 w-[98%] sm:max-w-7xl mx-auto">
          <h4 className="text-white font-semibold mb-2">Lobby Chat</h4>
          <div className="max-h-64 overflow-y-auto mb-3 space-y-3" style={{ background: '#050506', padding: '8px', borderRadius: 6 }}>
            {chatMessages.length === 0 && (
              <div className="text-sm text-gray-400">No messages yet — say hello!</div>
            )}
            {chatMessages.map((m) => (
              <div key={m.id} className="flex flex-col sm:flex-row items-start justify-between bg-slate-800 rounded w-full px-1 py-1">
                <div className="flex-1 min-w-0 px-3">
                  <div className="text-base text-gray-200"><strong className="text-white">{m.user?.name || m.user?.email || m.userId}</strong> <span className="text-xs text-gray-400">{new Date(m.createdAt).toLocaleTimeString()}</span></div>
                  <div className="text-base text-gray-300 break-words mt-1">{m.content}</div>
                </div>
                {isAdmin && (
                  <div className="mt-2 sm:mt-0 sm:ml-3">
                    <button onClick={async () => { if (confirm('Delete this message?')) await deleteChatMessage(m.id); }} className="px-2 py-1 bg-red-600 text-white rounded text-xs">Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center">
            <div className="flex w-full max-w-5xl gap-2 mx-auto justify-center items-center px-2">
              <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Type a message..." className="flex-1 min-w-0 px-3 py-2 rounded bg-black text-white border" />
              <button onClick={() => postChatMessage(chatInput)} className="px-4 py-2 bg-sky-600 text-white rounded">Send</button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmOpen}
        title={
          confirmAction === 'start'
            ? 'Start Puzzle'
            : confirmAction === 'create'
            ? 'Create Lobby'
            : confirmAction === 'ready'
            ? 'Mark Ready'
            : confirmAction === 'unready'
            ? 'Mark Not Ready'
            : confirmAction === 'invite'
            ? 'Invite Member'
            : confirmAction === 'refresh'
            ? 'Refresh Lobby'
            : 'Confirm'
        }
        message={
          confirmAction === 'start'
            ? `Start the puzzle now? This will open the puzzle for the team if start conditions are met.`
            : confirmAction === 'create'
            ? `Create or join the lobby for '${selectedPuzzle?.title || puzzleId}'?`
            : confirmAction === 'ready'
            ? `Mark yourself as ready for this puzzle?`
            : confirmAction === 'unready'
            ? `Remove your ready status?`
            : confirmAction === 'invite'
            ? `Invite ${inviteEmail} to the lobby?`
            : confirmAction === 'refresh'
            ? `Refresh the lobby state now?`
            : undefined
        }
        confirmLabel={confirmAction === 'start' ? 'Start' : 'Confirm'}
        onConfirm={handleConfirm}
        onCancel={() => { setConfirmOpen(false); setConfirmAction(null); }}
      />

      <ActionModal
        isOpen={actionModalOpen}
        variant={actionModalVariant}
        title={actionModalTitle}
        message={actionModalMessage}
        onClose={() => {
          setActionModalOpen(false);
          if (redirectOnClose) {
            try { router.push('/dashboard'); } catch (e) { /* ignore */ }
            setRedirectOnClose(false);
          }
        }}
      />
    </div>
  );
}
