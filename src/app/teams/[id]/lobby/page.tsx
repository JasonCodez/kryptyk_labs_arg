"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";
import ActionModal from "@/components/ActionModal";

export default function TeamLobbyPage() {
  const params = useParams();
  const teamId = params.id as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const puzzleIdFromQuery = searchParams.get('puzzleId') || '';

  const [puzzleId, setPuzzleId] = useState("");
  const [teamPuzzles, setTeamPuzzles] = useState<any[]>([]);
  const [selectedPuzzle, setSelectedPuzzle] = useState<any | null>(null);
  const [navHeight, setNavHeight] = useState<number | null>(null);
  const [lobby, setLobby] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [teamLeaderId, setTeamLeaderId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  // Chat state
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatAbortRef = useRef<AbortController | null>(null);
  const socketRef = useRef<any>(null);
  const prevParticipantsRef = useRef<string[]>([]);
  const autoJoinAttemptRef = useRef<string | null>(null);
  const membersRef = useRef<any[]>([]);
  const skipLeaveOnUnmountRef = useRef(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | "create" | "ready" | "unready" | "start" | "refresh" | "invite" | "leave" | "destroy">(null);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionModalVariant, setActionModalVariant] = useState<"success" | "error" | "info">("info");
  const [actionModalTitle, setActionModalTitle] = useState<string | undefined>(undefined);
  const [actionModalMessage, setActionModalMessage] = useState<string | undefined>(undefined);
  const [redirectUrlOnClose, setRedirectUrlOnClose] = useState<string | null>(null);
  const [selfLeaving, setSelfLeaving] = useState(false);

  const handleRefresh = async (e?: React.MouseEvent) => {
    try {
      e?.preventDefault();
      e?.stopPropagation();
    } catch {
      // ignore
    }

    try {
      // Pull latest lobby snapshot from the API
      await fetchLobby();

      // Ensure we have an identity for socket + join enforcement
      if (!currentUserId) {
        await fetchCurrentUser();
      }

      // Best-effort: ensure server-side lobby includes us (API is authoritative for start)
      if (teamId && puzzleId) {
        try {
          await fetch("/api/team/lobby", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "create", teamId, puzzleId }),
          });
        } catch {
          // ignore
        }
      }

      // Best-effort: prompt socket server to broadcast latest lobbyState
      try {
        const uid = currentUserId;
        if (socketRef.current && socketRef.current.connected && teamId && puzzleId && uid) {
          const member = (membersRef.current || []).find((m: any) => m.user?.id === uid);
          const adminFlag = !!member && ["admin", "moderator"].includes(member.role);
          const displayName = member?.user?.name || member?.user?.email || '';
          socketRef.current.emit('joinLobby', { teamId, puzzleId, userId: uid, name: displayName, isAdmin: adminFlag });
        }
      } catch {
        // ignore
      }

      // Re-fetch once more after join attempt so the UI updates immediately
      await fetchLobby();
    } catch (err) {
      console.error('Refresh failed', err);
      openActionModal('error', 'Refresh Failed', 'Unable to refresh lobby state.');
    }
  };

  async function fetchMembers() {
    try {
      const res = await fetch(`/api/teams/${teamId}`);
      if (res.ok) {
        const team = await res.json();
        setMembers(team.members || []);
        setTeamLeaderId((prev) => prev ?? team.createdBy ?? null);
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
      const normalized = list.map((p: any) => {
        const partsCount = Array.isArray(p.parts) ? p.parts.length : 0;
        const minTeamSize = typeof p.minTeamSize === 'number' ? p.minTeamSize : 0;
        const isEscapeRoom = p?.puzzleType === 'escape_room' || !!p?.escapeRoom;
        const requiredPlayers = isEscapeRoom ? 4 : ((partsCount > 0 ? partsCount : minTeamSize) || 1);
        const isLocked = isEscapeRoom && p?.escapeRoomFailed === true;
        return { ...p, partsCount, requiredPlayers, isLocked };
      });
      setTeamPuzzles(normalized);
      if (!puzzleId) {
        const fromQuery = puzzleIdFromQuery && normalized.find((p: any) => p.id === puzzleIdFromQuery && !p.isLocked);
        const pick = fromQuery || normalized.find((p: any) => !p.isLocked) || normalized[0];
        if (pick) {
          setPuzzleId(pick.id);
          setSelectedPuzzle(pick);
        }
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
        if (j?.leaderId) {
          setTeamLeaderId(j.leaderId);
        }
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
    membersRef.current = members || [];
  }, [members]);

  useEffect(() => {
    fetchTeamPuzzles();
  }, []);

  // If the URL puzzleId changes (e.g. clicking a card/invite), sync selection.
  useEffect(() => {
    if (!puzzleIdFromQuery) return;
    if (puzzleIdFromQuery === puzzleId) return;
    // if we have puzzle list, validate it; otherwise still set so downstream effects run
    const found = teamPuzzles.find((p: any) => p.id === puzzleIdFromQuery);
    setPuzzleId(puzzleIdFromQuery);
    if (found) setSelectedPuzzle(found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzleIdFromQuery]);

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
      if (!teamId || !puzzleId) return;
      const joinKey = `${teamId}::${puzzleId}`;
      if (autoJoinAttemptRef.current === joinKey) return;
      autoJoinAttemptRef.current = joinKey;
      try {
        // Always attempt to join via server session; the server will no-op if already joined.
        const joinRes = await fetch("/api/team/lobby", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create", teamId, puzzleId }),
        });
        if (!joinRes.ok) {
          const j = await joinRes.json().catch(() => ({}));
          if (j?.activePuzzleId && typeof j.activePuzzleId === 'string') {
            try {
              const notice = encodeURIComponent(j?.error || 'Only the lobby leader can change the team puzzle.');
              router.push(`/teams/${teamId}/lobby?puzzleId=${encodeURIComponent(j.activePuzzleId)}&notice=${notice}`);
              return;
            } catch {
              // ignore
            }
          }
          // If unauthorized, show a clearer message rather than silently staying at 0/4.
          openActionModal('error', 'Unable to Join Lobby', j?.error || joinRes.statusText);
          return;
        }
        // refresh lobby and seed prevParticipants to avoid false "removed" modal during immediate join
        const newLobby = await fetchLobby();
        try { prevParticipantsRef.current = (newLobby?.participants || []).slice(); } catch (e) {}
        // Ensure we have a current user id for ready/chat/socket flows.
        if (!currentUserId) {
          try { await fetchCurrentUser(); } catch (e) { /* ignore */ }
        }
      } catch (e) {
        console.error("Auto-join failed", e);
      }
    }
    joinIfNeeded();
  }, [teamId, puzzleId]);

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

        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || (process.env.NODE_ENV !== 'production' ? 'http://localhost:4000' : '');
        if (!socketUrl) return;

        const socket = io(socketUrl, { transports: ['polling', 'websocket'] });
        socketRef.current = socket;

        socket.on('connect', () => {
          try {
            const currentMembers = membersRef.current || [];
            const member = currentMembers.find((m: any) => m.user?.id === currentUserId);
            const adminFlag = !!member && ["admin", "moderator"].includes(member.role);
            const displayName = member?.user?.name || member?.user?.email || '';
            socket.emit('joinLobby', { teamId, puzzleId, userId: currentUserId, name: displayName, isAdmin: adminFlag });
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
          const r = reason ? String(reason) : '';
          const effectivePuzzleId = p || puzzleId;
          if (r === 'player_disconnected' || r === 'missing_player' || r === 'missing_player_navigation') {
            const notice =
              r === 'missing_player'
                ? 'A teammate did not join in time. The lobby was reset — please restart.'
                : r === 'missing_player_navigation'
                ? 'A teammate did not reach the puzzle page in time. The lobby was reset — please restart.'
                : 'A teammate disconnected. The lobby was reset — please restart.';
            setActionModalTitle('Lobby Reset');
            setActionModalMessage(notice);
            setRedirectUrlOnClose(`/teams/${teamId}/lobby?puzzleId=${encodeURIComponent(effectivePuzzleId)}&notice=${encodeURIComponent(notice)}`);
          } else {
            setActionModalTitle('Lobby Closed');
            setActionModalMessage('The leader shut down the lobby. Click Close to go to the dashboard.');
            setRedirectUrlOnClose('/dashboard');
          }
          setActionModalOpen(true);
        });

        socket.on('puzzleStarting', ({ teamId: t, puzzleId: p }) => {
          if (!mounted) return;
          // navigate to planning screen
          skipLeaveOnUnmountRef.current = true;
          const effectiveTeamId = t || teamId;
          const effectivePuzzleId = p || puzzleId;
          if (!effectiveTeamId || !effectivePuzzleId) {
            openActionModal('error', 'Navigation Error', 'Missing team or puzzle id; unable to open planning page.');
            return;
          }
          router.push(`/teams/${effectiveTeamId}/puzzle/${effectivePuzzleId}/planning`);
        });

        socket.on('teamPuzzleChanged', ({ toPuzzleId }: any) => {
          if (!mounted) return;
          if (!toPuzzleId) return;
          try {
            router.push(`/teams/${teamId}/lobby?puzzleId=${encodeURIComponent(toPuzzleId)}&notice=${encodeURIComponent('The lobby leader changed the team puzzle.')}`);
          } catch {
            // ignore
          }
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
        // On SPA navigation into the puzzle/planning flow, keep lobby participants intact.
        // Explicit leaving still happens via the Leave button or on beforeunload.
        if (!skipLeaveOnUnmountRef.current) {
          // inform server we are leaving the lobby (SPA navigation)
          if (socketRef.current && currentUserId) {
            try { socketRef.current.emit('leaveLobby', { teamId, puzzleId, userId: currentUserId }); } catch (e) {}
          }
          // attempt an async leave request
          (async () => {
            try { await fetch('/api/team/lobby', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'leave', teamId, puzzleId }) }); } catch (e) { /* ignore */ }
          })();
        }
      } catch (e) {
        // ignore
      }
      try { if (beforeUnloadHandler) window.removeEventListener('beforeunload', beforeUnloadHandler); } catch (e) {}
      try { socketRef.current?.disconnect(); } catch (e) {}
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, puzzleId, currentUserId]);

  // Ensure server gets updated isAdmin flag if members or currentUserId change after socket connected
  useEffect(() => {
    try {
      const member = members.find((m: any) => m.user?.id === currentUserId);
      const adminFlag = !!member && ["admin", "moderator"].includes(member.role);
      if (socketRef.current && socketRef.current.connected) {
        try {
          const displayName = member?.user?.name || member?.user?.email || '';
          socketRef.current.emit('joinLobby', { teamId, puzzleId, userId: currentUserId, name: displayName, isAdmin: adminFlag });
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
            setActionModalMessage('The leader removed you from the lobby. Click Close to go to the dashboard.');
            setRedirectUrlOnClose('/dashboard');
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
  const isLeader = !!teamLeaderId && !!currentUserId && teamLeaderId === currentUserId;

  // Keep selectedPuzzle in sync when we arrive via ?puzzleId before teamPuzzles loads.
  useEffect(() => {
    if (!puzzleId) {
      setSelectedPuzzle(null);
      return;
    }
    const found = teamPuzzles.find((p: any) => p.id === puzzleId) || null;
    setSelectedPuzzle((prev: any) => {
      if (prev?.id && found?.id && prev.id === found.id) return prev;
      if (!prev && !found) return prev;
      return found;
    });
  }, [teamPuzzles, puzzleId]);

  const getRequiredPlayersForPuzzle = (puzzle: any): number => {
    if (!puzzle) return 0;
    if (puzzle?.puzzleType === 'escape_room' || puzzle?.escapeRoom) return 4;
    const partsCount = typeof puzzle.partsCount === 'number'
      ? puzzle.partsCount
      : (Array.isArray(puzzle.parts) ? puzzle.parts.length : 0);
    const minTeamSize = typeof puzzle.minTeamSize === 'number' ? puzzle.minTeamSize : 0;
    const required = partsCount > 0 ? partsCount : minTeamSize;
    return required > 0 ? required : 1;
  };

  const participantIds = Array.from(
    new Set(
      (lobby?.participants || [])
        .map((p: any) => (typeof p === 'string' ? p : (p?.userId as string | undefined)))
        .filter(Boolean),
    ),
  ) as string[];

  const participantsCount = participantIds.length;
  const requiredPlayers = selectedPuzzle ? getRequiredPlayersForPuzzle(selectedPuzzle) : 0;
  const hasEnoughPlayers = !!selectedPuzzle && requiredPlayers > 0 && participantsCount >= requiredPlayers;
  const hasExactPlayers = !!selectedPuzzle && requiredPlayers > 0 && participantsCount === requiredPlayers;
  const allReady = participantsCount > 0 && participantIds.every((id: string) => !!(lobby?.ready && lobby.ready[id]));

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
    // Only the team leader can destroy/shut down the lobby.
    setConfirmAction(isLeader ? "destroy" : "leave");
    setConfirmOpen(true);
  };

  const onShutdownClick = () => {
    if (!isLeader) return;
    if (!puzzleId.trim()) return openActionModal("error", "Missing Puzzle", "Select a puzzle to shut down its lobby.");
    setConfirmAction("destroy");
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
        await fetchMembers();
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
        // success -> navigate to team planning so leader can open the puzzle
        skipLeaveOnUnmountRef.current = true;
        if (!teamId || !puzzleId) {
          return openActionModal('error', 'Navigation Error', 'Missing team or puzzle id; unable to open planning page.');
        }
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
        // Redirect the user to the dashboard immediately after leaving the lobby.
        // Use a hard navigation fallback because some socket/update flows can re-trigger lobby joins.
        skipLeaveOnUnmountRef.current = true;
        try { router.replace('/dashboard'); } catch (e) { /* ignore */ }
        try { window.location.assign('/dashboard'); } catch (e) { window.location.href = '/dashboard'; }
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
          <label className="text-sm text-gray-300 block mb-2">Choose Team Puzzle</label>
          <select
            value={puzzleId}
            onChange={(e) => {
              if (lobby && !isLeader) {
                openActionModal('error', 'Not Allowed', 'Only the lobby leader can change the team puzzle.');
                return;
              }
              const id = e.target.value;
              const found = teamPuzzles.find((p) => p.id === id) || null;
              if (found?.isLocked) {
                openActionModal('error', 'Locked Puzzle', 'You already failed this escape room. It is locked and cannot be replayed.');
                return;
              }
              setPuzzleId(id);
              setSelectedPuzzle(found);
              try {
                router.replace(`/teams/${teamId}/lobby?puzzleId=${encodeURIComponent(id)}`);
              } catch {
                // ignore
              }
            }}
            disabled={!!lobby && !isLeader}
            className="w-full px-3 py-2 rounded bg-black text-white border"
          >
            <option value="">-- Select a puzzle --</option>
            {teamPuzzles.map((p) => (
              <option key={p.id} value={p.id} disabled={!!p.isLocked}>
                {p.title} (players: {p.requiredPlayers || 1}){p.isLocked ? ' — LOCKED' : ''}
              </option>
            ))}
          </select>
          <div className="flex gap-2 mt-3">
            <button type="button" onClick={handleRefresh} className="px-4 py-2 bg-slate-700 text-white rounded">Refresh</button>
          </div>

          {selectedPuzzle && (
            <div className="mt-3 text-sm text-gray-300">
              Required players: <span className="font-semibold text-white">{requiredPlayers || 1}</span>
            </div>
          )}

          {selectedPuzzle && members.length < requiredPlayers && (
            <div className="mt-3 p-3 rounded border bg-slate-800 border-slate-700">
              <div className="text-sm text-amber-200">
                Your team has <strong className="text-white">{members.length}</strong> member(s), but this puzzle requires <strong className="text-white">{requiredPlayers}</strong> players.
                <div className="mt-2"><a className="text-sky-400 underline" href={`/teams/${teamId}`}>Manage team members</a></div>
              </div>
            </div>
          )}

          {isLeader && (
            <div className="mt-4">
              <label className="text-sm text-gray-300 block mb-2">Invite members to lobby</label>
              {hasEnoughPlayers ? (
                <div className="p-3 rounded bg-slate-800 text-sm text-emerald-300">Required players met — cannot invite more members.</div>
              ) : (
                <div className="space-y-2">
                  {members
                    .filter((m: any) => m.user?.id && m.user.id !== currentUserId)
                    .map((m: any) => {
                      const memberId = m.user.id;
                      const alreadyParticipant = participantIds.includes(memberId);
                      const alreadyInvited = (lobby?.invites || []).some((inv: any) => inv.userId === memberId || inv.email === m.user.email);
                      const inviteLimitReached = selectedPuzzle && (((participantsCount) + (lobby?.invites?.length || 0)) >= requiredPlayers || hasEnoughPlayers);
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
            const rawParts = (lobby?.participants || []).map((p: any, index: number) => {
              if (!p) return null;
              if (typeof p === 'string') return { userId: p, name: undefined, _index: index };
              const userId = p.userId || p.id || p.user?.id;
              const name = p.name || p.userName || p.user?.name || undefined;
              return { userId, name, _index: index };
            }).filter(Boolean as any);

            const parts = (() => {
              const seen = new Set<string>();
              const deduped: any[] = [];
              for (const part of rawParts) {
                const uid = part?.userId;
                if (uid && !seen.has(uid)) {
                  seen.add(uid);
                  deduped.push(part);
                  continue;
                }
                if (!uid) deduped.push(part);
              }
              return deduped;
            })();

            return parts.map((part: any) => {
              const uid: string | undefined = part.userId;
              const member = members.find((m: any) => m.user?.id === uid);
              const label = member ? (member.user.name || member.user.email) : (part.name || uid);
              return (
                <div key={uid ? `user:${uid}` : `idx:${part._index}`} className="flex items-center justify-between p-2 bg-slate-800 rounded">
                  <div className="text-white">{label}</div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm">
                      {uid && lobby?.ready?.[uid] ? (
                        <span className="text-emerald-400 font-bold">READY!</span>
                      ) : (
                        <span className="text-red-500">Not ready</span>
                      )}
                    </div>
                    {isLeader && uid && uid !== currentUserId && (
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
                {lobby.invites.map((inv: any, idx: number) => {
                  const inviter = members.find((m: any) => m.user?.id === inv.invitedBy);
                  const inviterLabel = inviter ? (inviter.user.name || inviter.user.email) : inv.invitedBy;

                  const invitedMember = inv.userId ? members.find((m: any) => m.user?.id === inv.userId) : null;
                  const inviteeLabel =
                    (invitedMember?.user?.name as string | undefined) ||
                    (inv.displayName as string | undefined) ||
                    (inv.userId as string | undefined) ||
                    'Invited player';
                  return (
                    <div key={inv.id ?? `${inv.userId ?? inv.email ?? 'inv'}:${idx}`} className="flex items-center justify-between p-2 bg-slate-800 rounded">
                      <div className="text-gray-200">{inviteeLabel} <span className="text-xs text-gray-400">({inv.status})</span></div>
                      <div className="flex items-center gap-3">
                        <div className="text-xs text-gray-400">Invited by: {inviterLabel}</div>
                        {isLeader && (
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
          {isLeader && (
            <button
              onClick={onStartClick}
              disabled={!selectedPuzzle || !hasExactPlayers || !allReady}
              className="w-full sm:w-auto text-sm px-3 py-2 bg-emerald-600 text-white rounded disabled:opacity-50"
              title={
                !selectedPuzzle
                  ? 'Select a puzzle to start'
                  : !hasExactPlayers
                    ? `Player count mismatch: requires exactly ${requiredPlayers} players`
                    : !allReady
                      ? 'All participants must be marked ready before starting'
                      : undefined
              }
            >
              Start Puzzle
            </button>
          )}
          {isLeader && (
            <button
              onClick={onShutdownClick}
              disabled={!puzzleId}
              className="w-full sm:w-auto text-sm px-3 py-2 bg-slate-800 border border-red-700 text-red-200 rounded hover:bg-slate-700 disabled:opacity-50"
              title="Shut down the current lobby"
            >
              Shut Down Lobby
            </button>
          )}
          {!!currentUserId && participantIds.includes(currentUserId) && (
            <button onClick={onLeaveClick} className="w-full sm:w-auto text-sm px-3 py-2 bg-red-600 text-white rounded">Leave Lobby</button>
          )}
        </div>

        <div className="mt-4 bg-slate-900 border rounded-lg p-4 w-[98%] sm:max-w-7xl mx-auto">
          <h4 className="text-white font-semibold mb-2">Lobby Chat</h4>
          <div className="max-h-64 overflow-y-auto mb-3 space-y-3" style={{ background: '#050506', padding: '8px', borderRadius: 6 }}>
            {chatMessages.length === 0 && (
              <div className="text-sm text-gray-400">No messages yet — say hello!</div>
            )}
            {chatMessages.map((m, idx) => {
              const member = (members || []).find((mm: any) => mm.user?.id && m?.userId && mm.user.id === m.userId);
              const senderLabel =
                (m?.user?.name as string | undefined) ||
                (m?.user?.email as string | undefined) ||
                (member?.user?.name as string | undefined) ||
                (member?.user?.email as string | undefined) ||
                (m?.userId as string | undefined) ||
                'Unknown';

              const key = m?.id ?? `${m?.userId ?? 'u'}:${m?.createdAt ?? idx}:${idx}`;
              return (
              <div key={key} className="flex flex-col sm:flex-row items-start justify-between bg-slate-800 rounded w-full px-1 py-1">
                <div className="flex-1 min-w-0 px-3">
                  <div className="text-base text-gray-200"><strong className="text-white">{senderLabel}</strong> <span className="text-xs text-gray-400">{new Date(m.createdAt).toLocaleTimeString()}</span></div>
                  <div className="text-base text-gray-300 break-words mt-1">{m.content}</div>
                </div>
                {isAdmin && (
                  <div className="mt-2 sm:mt-0 sm:ml-3">
                    <button onClick={async () => { if (confirm('Delete this message?')) await deleteChatMessage(m.id); }} className="px-2 py-1 bg-red-600 text-white rounded text-xs">Delete</button>
                  </div>
                )}
              </div>
              );
            })}
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
            : confirmAction === 'destroy'
            ? 'Shut Down Lobby'
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
            : confirmAction === 'destroy'
            ? `Shut down this lobby and send everyone back to the dashboard?`
            : confirmAction === 'ready'
            ? `Mark yourself as ready for this puzzle?`
            : confirmAction === 'unready'
            ? `Remove your ready status?`
            : confirmAction === 'leave'
            ? `Leave this lobby and return to the dashboard?`
            : confirmAction === 'invite'
            ? `Invite ${inviteEmail} to the lobby?`
            : confirmAction === 'refresh'
            ? `Refresh the lobby state now?`
            : undefined
        }
        confirmLabel={confirmAction === 'start' ? 'Start' : confirmAction === 'destroy' ? 'Shut Down' : 'Confirm'}
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
          if (redirectUrlOnClose) {
            try { router.push(redirectUrlOnClose); } catch (e) { /* ignore */ }
            setRedirectUrlOnClose(null);
          }
        }}
      />
    </div>
  );
}
