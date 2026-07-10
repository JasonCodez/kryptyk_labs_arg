"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";
import ActionModal from "@/components/ActionModal";
import { AlertTriangle, CheckCircle2, Crown, LogOut, Mail, MessageSquareText, Play, Power, RefreshCw, Send, Shield, Sparkles, UserPlus, Users } from "lucide-react";
import type { Socket } from "socket.io-client";

interface TeamMemberUser {
  id?: string;
  name?: string;
  email?: string;
  image?: string;
}
interface TeamMember {
  user?: TeamMemberUser;
  [key: string]: unknown;
}
interface LobbyInvite {
  id?: string;
  userId?: string;
  email?: string;
  displayName?: string;
  invitedBy?: string;
  status?: string;
  createdAt?: number;
}
interface ChatMessage {
  id?: string;
  userId?: string;
  user?: TeamMemberUser;
  createdAt?: string | number;
  content?: string;
}
interface TeamPuzzle {
  id: string;
  title?: string;
  puzzleType?: string;
  escapeRoom?: { roomTitle?: string };
  parts?: unknown[];
  partsCount?: number;
  minTeamSize?: number;
  requiredPlayers?: number;
  [key: string]: unknown;
}
interface Lobby {
  participants?: (string | { userId?: string; id?: string; name?: string; userName?: string; user?: TeamMemberUser })[];
  invites?: LobbyInvite[];
  ready?: Record<string, boolean>;
  leaderId?: string;
  started?: boolean;
  puzzleOpenedAt?: number;
  [key: string]: unknown;
}

function getPuzzleDisplayTitle(p: TeamPuzzle): string {
  const escapeTitle = typeof p?.escapeRoom?.roomTitle === 'string' ? p.escapeRoom.roomTitle.trim() : '';
  const puzzleTitle = typeof p?.title === 'string' ? p.title.trim() : '';
  if (p?.puzzleType === 'escape_room' && escapeTitle) return escapeTitle;
  if ((puzzleTitle === '' || puzzleTitle === 'Untitled Puzzle') && escapeTitle) return escapeTitle;
  return puzzleTitle || escapeTitle || 'Untitled Puzzle';
}

export default function TeamLobbyPage() {
  const params = useParams();
  const teamId = params.id as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const puzzleIdFromQuery = searchParams.get('puzzleId') || '';

  const [puzzleId, setPuzzleId] = useState("");
  const [teamPuzzles, setTeamPuzzles] = useState<TeamPuzzle[]>([]);
  const [selectedPuzzle, setSelectedPuzzle] = useState<TeamPuzzle | null>(null);
  const [navHeight, setNavHeight] = useState<number | null>(null);
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [teamLeaderId, setTeamLeaderId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatAbortRef = useRef<AbortController | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const prevParticipantsRef = useRef<string[]>([]);
  const autoJoinAttemptRef = useRef<string | null>(null);
  const membersRef = useRef<TeamMember[]>([]);
  const skipLeaveOnUnmountRef = useRef(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | "ready" | "unready" | "start" | "refresh" | "invite" | "leave" | "destroy">(null);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionModalVariant, setActionModalVariant] = useState<"success" | "error" | "info">("info");
  const [actionModalTitle, setActionModalTitle] = useState<string | undefined>(undefined);
  const [actionModalMessage, setActionModalMessage] = useState<string | undefined>(undefined);
  const [redirectUrlOnClose, setRedirectUrlOnClose] = useState<string | null>(null);

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
            body: JSON.stringify({ action: "join", teamId, puzzleId }),
          });
        } catch {
          // ignore
        }
      }

      // Best-effort: prompt socket server to broadcast latest lobbyState
      try {
        const uid = currentUserId;
        if (socketRef.current && socketRef.current.connected && teamId && puzzleId && uid) {
          const member = (membersRef.current || []).find((m: TeamMember) => m.user?.id === uid);
          const adminFlag = !!member && ["admin", "moderator"].includes(String(member.role));
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
      const normalized = list.map((p: Record<string, unknown>) => {
        const partsCount = Array.isArray(p.parts) ? p.parts.length : 0;
        const minTeamSize = typeof p.minTeamSize === 'number' ? p.minTeamSize : 0;
        const isEscapeRoom = p?.puzzleType === 'escape_room' || !!p?.escapeRoom;
        const escaperoomMinPlayers = typeof p?.minTeamSize === 'number' && p.minTeamSize > 0 ? p.minTeamSize : 1;
        const requiredPlayers = isEscapeRoom ? escaperoomMinPlayers : (minTeamSize > 0 ? minTeamSize : (partsCount > 0 ? partsCount : 1));
        return { ...p, partsCount, requiredPlayers };
      });
      setTeamPuzzles(normalized);
      if (!puzzleId) {
        const fromQuery = puzzleIdFromQuery && normalized.find((p: TeamPuzzle) => p.id === puzzleIdFromQuery);
        const pick = fromQuery || normalized[0];
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
    } catch {
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
      if (e instanceof Error && e.name === 'AbortError') return;
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
      } catch {
        // ignore
      }
    } catch (e) {
      console.error('Failed to post chat', e);
      openActionModal('error', 'Chat Error', (e instanceof Error ? e.message : '') || 'Failed to post message');
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
      openActionModal('error', 'Chat Error', (e instanceof Error ? e.message : '') || 'Failed to delete message');
    }
  };

  useEffect(() => {
    fetchMembers();
    // fetchMembers is a plain function redefined every render; only re-fetch on teamId change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  useEffect(() => {
    membersRef.current = members || [];
  }, [members]);

  useEffect(() => {
    fetchTeamPuzzles();
    // Mount-only fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If the URL puzzleId changes (e.g. clicking a card/invite), sync selection.
  useEffect(() => {
    if (!puzzleIdFromQuery) return;
    if (puzzleIdFromQuery === puzzleId) return;
    // if we have puzzle list, validate it; otherwise still set so downstream effects run
    const found = teamPuzzles.find((p: TeamPuzzle) => p.id === puzzleIdFromQuery);
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
      } catch {
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
        const postLobbyAction = async (action: "join" | "create") => {
          const res = await fetch("/api/team/lobby", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, teamId, puzzleId }),
          });
          const payload = await res.json().catch(() => ({}));
          return { res, payload };
        };

        // Prefer joining an existing lobby first.
        let { res: joinRes, payload: joinPayload } = await postLobbyAction("join");

        if (!joinRes.ok && joinPayload?.activePuzzleId && typeof joinPayload.activePuzzleId === 'string') {
          try {
            const notice = encodeURIComponent(joinPayload?.error || 'A different team puzzle is currently active.');
            router.push(`/teams/${teamId}/lobby?puzzleId=${encodeURIComponent(joinPayload.activePuzzleId)}&notice=${notice}`);
            return;
          } catch {
            // ignore
          }
        }

        const joinError = String(joinPayload?.error || '');
        const shouldCreate = !joinRes.ok && joinRes.status === 409 && /lobby not found/i.test(joinError);

        if (shouldCreate) {
          // If no lobby exists yet for this puzzle, create/join it.
          const createResult = await postLobbyAction("create");
          joinRes = createResult.res;
          joinPayload = createResult.payload;
        }

        if (!joinRes.ok) {
          if (joinPayload?.activePuzzleId && typeof joinPayload.activePuzzleId === 'string') {
            try {
              const notice = encodeURIComponent(joinPayload?.error || 'Only the lobby leader can change the team puzzle.');
              router.push(`/teams/${teamId}/lobby?puzzleId=${encodeURIComponent(joinPayload.activePuzzleId)}&notice=${notice}`);
              return;
            } catch {
              // ignore
            }
          }

          openActionModal('error', 'Unable to Join Lobby', joinPayload?.error || joinRes.statusText);
          return;
        }

        // refresh lobby and seed prevParticipants to avoid false "removed" modal during immediate join
        const newLobby = await fetchLobby();
        try { prevParticipantsRef.current = (newLobby?.participants || []).slice(); } catch {}
        // Ensure we have a current user id for ready/chat/socket flows.
        if (!currentUserId) {
          try { await fetchCurrentUser(); } catch { /* ignore */ }
        }
      } catch (e) {
        console.error("Auto-join failed", e);
      }
    }
    joinIfNeeded();
    // fetchLobby is a plain function redefined every render, and currentUserId is only read as
    // a "do we already have one" check here (not something that should re-trigger auto-join) —
    // both intentionally omitted. router is stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, puzzleId, router]);

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
            const member = currentMembers.find((m: TeamMember) => m.user?.id === currentUserId);
            const adminFlag = !!member && ["admin", "moderator"].includes(String(member.role));
            const displayName = member?.user?.name || member?.user?.email || '';
            socket.emit('joinLobby', { teamId, puzzleId, userId: currentUserId, name: displayName, isAdmin: adminFlag });
          } catch {
            socket.emit('joinLobby', { teamId, puzzleId, userId: currentUserId, name: '', isAdmin: false });
          }
        });

        socket.on('lobbyState', (state: Record<string, unknown>) => {
          if (!mounted) return;
          // merge into local lobby shape minimally
          const participants = Array.isArray(state.participants)
            ? (state.participants as Record<string, unknown>[]).map((p) => p.userId as string)
            : [];
          setLobby((prev) => ({
            ...(prev || {}),
            participants,
            ready: state.ready as Record<string, boolean> | undefined,
            leaderId: (state.leaderId as string | undefined) ?? prev?.leaderId,
            started: (state.started as boolean | undefined) ?? prev?.started,
            puzzleOpenedAt: (state.puzzleOpenedAt as number | undefined) ?? prev?.puzzleOpenedAt,
          }));
        });

        socket.on('chatMessage', (msg: Record<string, unknown>) => {
          if (!mounted) return;
          setChatMessages((prev) => (prev || []).concat(msg));
        });

        socket.on('lobbyDestroyed', ({ puzzleId: p, reason }: { teamId?: string; puzzleId?: string; reason?: string }) => {
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
          skipLeaveOnUnmountRef.current = true;
          const effectiveTeamId = t || teamId;
          const effectivePuzzleId = p || puzzleId;
          if (!effectiveTeamId || !effectivePuzzleId) return;
          router.push(`/puzzles/${effectivePuzzleId}?teamId=${encodeURIComponent(effectiveTeamId)}`);
        });

        socket.on('teamPuzzleChanged', ({ toPuzzleId }: { toPuzzleId?: string }) => {
          if (!mounted) return;
          if (!toPuzzleId) return;
          try {
            router.push(`/teams/${teamId}/lobby?puzzleId=${encodeURIComponent(toPuzzleId)}&notice=${encodeURIComponent('The lobby leader changed the team puzzle.')}`);
          } catch {
            // ignore
          }
        });

        socket.on('startFailed', (err: Record<string, unknown>) => {
          if (!mounted) return;
          openActionModal('error', 'Start Failed', (err?.error as string | undefined) || 'Failed to start puzzle');
        });

        // beforeunload handler: try to notify server that user left
        beforeUnloadHandler = () => {
          try {
            if (socketRef.current && socketRef.current.connected && currentUserId) {
              try { socketRef.current.emit('leaveLobby', { teamId, puzzleId, userId: currentUserId }); } catch {}
            }
          } catch {
            // ignore
          }
          try {
            const payload = JSON.stringify({ action: 'leave', teamId, puzzleId });
            try { navigator.sendBeacon('/api/team/lobby', payload); } catch { /* ignore */ }
          } catch {
            // ignore
          }
        };
        try { window.addEventListener('beforeunload', beforeUnloadHandler); } catch { /* ignore */ }
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
            try { socketRef.current.emit('leaveLobby', { teamId, puzzleId, userId: currentUserId }); } catch {}
          }
          // attempt an async leave request
          (async () => {
            try { await fetch('/api/team/lobby', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'leave', teamId, puzzleId }) }); } catch { /* ignore */ }
          })();
        }
      } catch {
        // ignore
      }
      try { if (beforeUnloadHandler) window.removeEventListener('beforeunload', beforeUnloadHandler); } catch {}
      try { socketRef.current?.disconnect(); } catch {}
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, puzzleId, currentUserId]);

  // Ensure server gets updated isAdmin flag if members or currentUserId change after socket connected
  useEffect(() => {
    try {
      const member = members.find((m: TeamMember) => m.user?.id === currentUserId);
      const adminFlag = !!member && ["admin", "moderator"].includes(String(member.role));
      if (socketRef.current && socketRef.current.connected) {
        try {
          const displayName = member?.user?.name || member?.user?.email || '';
          socketRef.current.emit('joinLobby', { teamId, puzzleId, userId: currentUserId, name: displayName, isAdmin: adminFlag });
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, currentUserId]);

  // Listen for explicit server-side removal events rather than inferring removals from state diffs.
  useEffect(() => {
    // 'kicked' will be emitted by the lobby API when an admin removes a participant
    try {
      const handler = (payload: Record<string, unknown>) => {
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
            const removedMember = members.find((m: TeamMember) => m.user?.id === target);
            const label = removedMember ? (removedMember.user?.name || removedMember.user?.email) : target;
            setActionModalVariant('info');
            setActionModalTitle('Player Removed');
            setActionModalMessage(`${label} has been removed from the lobby.`);
            setActionModalOpen(true);
          }
        } catch {
          // ignore
        }
      };

      socketRef.current?.on('kicked', handler);
      return () => { try { socketRef.current?.off('kicked', handler); } catch {} };
    } catch {
      // ignore
    }
     
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
    } catch {
      // ignore
    }
  }, []);

  // determine if current user is admin/moderator of the team
  const currentMember = members.find((m: TeamMember) => m.user?.id === currentUserId);
  const isAdmin = !!currentMember && ["admin", "moderator"].includes(String(currentMember.role));
  const isLeader = !!teamLeaderId && !!currentUserId && teamLeaderId === currentUserId;

  // Keep selectedPuzzle in sync when we arrive via ?puzzleId before teamPuzzles loads.
  useEffect(() => {
    if (!puzzleId) {
      setSelectedPuzzle(null);
      return;
    }
    const found = teamPuzzles.find((p: TeamPuzzle) => p.id === puzzleId) || null;
    setSelectedPuzzle((prev) => {
      if (prev?.id && found?.id && prev.id === found.id) return prev;
      if (!prev && !found) return prev;
      return found;
    });
  }, [teamPuzzles, puzzleId]);

  const getRequiredPlayersForPuzzle = (puzzle: TeamPuzzle): number => {
    if (!puzzle) return 0;
    if (puzzle?.puzzleType === 'escape_room' || puzzle?.escapeRoom) {
      const m = typeof puzzle.minTeamSize === 'number' && puzzle.minTeamSize > 0 ? puzzle.minTeamSize : 1;
      return m;
    }
    const partsCount = typeof puzzle.partsCount === 'number'
      ? puzzle.partsCount
      : (Array.isArray(puzzle.parts) ? puzzle.parts.length : 0);
    const minTeamSize = typeof puzzle.minTeamSize === 'number' ? puzzle.minTeamSize : 0;
    const required = minTeamSize > 0 ? minTeamSize : (partsCount > 0 ? partsCount : 0);
    return required > 0 ? required : 1;
  };

  const participantIds = Array.from(
    new Set(
      (lobby?.participants || [])
        .map((p) => (typeof p === 'string' ? p : p?.userId))
        .filter(Boolean),
    ),
  ) as string[];

  const participantsCount = participantIds.length;
  const requiredPlayers = selectedPuzzle ? getRequiredPlayersForPuzzle(selectedPuzzle) : 0;
  const hasEnoughPlayers = !!selectedPuzzle && requiredPlayers > 0 && participantsCount >= requiredPlayers;
  const allReady = participantsCount > 0 && participantIds.every((id: string) => !!(lobby?.ready && lobby.ready[id]));

  // Fallback redirect for cases where realtime socket events are delayed/missed.
  // If the lobby has started and this user is a participant, move them to the puzzle page.
  useEffect(() => {
    if (!teamId || !puzzleId || !currentUserId) return;
    if (skipLeaveOnUnmountRef.current) return;

    const hasStarted = !!lobby?.started || !!lobby?.puzzleOpenedAt;
    if (!hasStarted) return;

    if (!participantIds.includes(currentUserId)) return;

    skipLeaveOnUnmountRef.current = true;
    router.push(`/puzzles/${puzzleId}?teamId=${encodeURIComponent(teamId)}`);
  }, [
    teamId,
    puzzleId,
    currentUserId,
    lobby?.started,
    lobby?.puzzleOpenedAt,
    participantIds,
    router,
  ]);

  const openActionModal = (variant: "success" | "error" | "info", title?: string, message?: string) => {
    setActionModalVariant(variant);
    setActionModalTitle(title);
    setActionModalMessage(message);
    setActionModalOpen(true);
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
      if (confirmAction === "ready" || confirmAction === "unready") {
        const action = confirmAction === "ready" ? "ready" : "unready";
        const res = await fetch("/api/team/lobby", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, teamId, puzzleId }) });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) return openActionModal("error", "Failed", j?.error || res.statusText);
        await fetchLobby();
        if (confirmAction === "ready") {
          return openActionModal("success", undefined, "You're ready to go!");
        }
        return openActionModal("success", "You are Not Ready", "You are no longer marked ready.");
      }

      if (confirmAction === "start") {
        const res = await fetch("/api/team/lobby", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start", teamId, puzzleId }) });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) return openActionModal("error", "Start Failed", j?.error || res.statusText);
        // success -> navigate directly to the puzzle
        skipLeaveOnUnmountRef.current = true;
        if (!teamId || !puzzleId) {
          return openActionModal('error', 'Navigation Error', 'Missing team or puzzle id; unable to start puzzle.');
        }
        router.push(`/puzzles/${puzzleId}?teamId=${encodeURIComponent(teamId)}`);
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
        try { router.replace('/dashboard'); } catch { /* ignore */ }
        try { window.location.assign('/dashboard'); } catch { window.location.href = '/dashboard'; }
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

  const readyCount = participantIds.filter((id: string) => !!lobby?.ready?.[id]).length;
  const inviteCount = Array.isArray(lobby?.invites) ? lobby.invites.length : 0;
  const readinessPercent = participantsCount > 0 ? Math.round((readyCount / participantsCount) * 100) : 0;
  const participantProgress = selectedPuzzle && requiredPlayers > 0
    ? Math.min(100, Math.round((participantsCount / requiredPlayers) * 100))
    : 0;
  const currentUserInLobby = !!currentUserId && participantIds.includes(currentUserId);
  const roleLabel = isLeader ? "Leader" : isAdmin ? "Admin" : "Member";

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{
        paddingTop: navHeight ? `${navHeight}px` : undefined,
        background:
          "radial-gradient(1200px 600px at 10% -10%, rgba(56,189,248,0.14), transparent 60%), radial-gradient(900px 500px at 90% 0%, rgba(20,184,166,0.12), transparent 55%), #020617",
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-50 [background:linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] [background-size:34px_34px]" />

      <div className="relative mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-cyan-400/20 bg-slate-950/70 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
                <Sparkles className="h-3.5 w-3.5" />
                Team Coordination
              </div>
              <h1 className="mt-4 text-2xl font-black tracking-tight text-white sm:text-4xl">Team Lobby</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300 sm:text-base">
                Get everyone synced, lock in readiness, and launch with precision.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2">
                <div className="text-[11px] uppercase tracking-wider text-slate-400">Role</div>
                <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-100">
                  {isLeader ? <Crown className="h-4 w-4 text-amber-300" /> : <Shield className="h-4 w-4 text-cyan-300" />}
                  {roleLabel}
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2">
                <div className="text-[11px] uppercase tracking-wider text-slate-400">Players</div>
                <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-100">
                  <Users className="h-4 w-4 text-sky-300" />
                  {participantsCount}/{requiredPlayers || "-"}
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 col-span-2 sm:col-span-1">
                <div className="text-[11px] uppercase tracking-wider text-slate-400">Ready</div>
                <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-100">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  {readyCount}/{participantsCount || 0}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/60 hover:bg-slate-800"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          <section className="lg:col-span-8 rounded-3xl border border-slate-800 bg-slate-950/70 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-white">Puzzle Setup</h2>
              <div className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-300">
                {selectedPuzzle ? "Selected" : "Pending"}
              </div>
            </div>

            <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-slate-400">Choose Team Puzzle</label>
            <select
              value={puzzleId}
              onChange={(e) => {
                if (lobby && !isLeader) {
                  openActionModal('error', 'Not Allowed', 'Only the lobby leader can change the team puzzle.');
                  return;
                }
                const id = e.target.value;
                const found = teamPuzzles.find((p) => p.id === id) || null;
                setPuzzleId(id);
                setSelectedPuzzle(found);
                try {
                  router.replace(`/teams/${teamId}/lobby?puzzleId=${encodeURIComponent(id)}`);
                } catch {
                  // ignore
                }
              }}
              disabled={!!lobby && !isLeader}
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400"
            >
              <option value="">-- Select a puzzle --</option>
              {teamPuzzles.map((p) => (
                <option key={p.id} value={p.id}>
                  {getPuzzleDisplayTitle(p)} (players: {p.requiredPlayers || 1})
                </option>
              ))}
            </select>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                <div className="text-[11px] uppercase tracking-wider text-slate-400">Required</div>
                <div className="mt-1 text-lg font-bold text-slate-100">{requiredPlayers || 1}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                <div className="text-[11px] uppercase tracking-wider text-slate-400">Participants</div>
                <div className="mt-1 text-lg font-bold text-slate-100">{participantsCount}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                <div className="text-[11px] uppercase tracking-wider text-slate-400">Queued Invites</div>
                <div className="mt-1 text-lg font-bold text-slate-100">{inviteCount}</div>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wider text-slate-400">
                <span>Player Requirement Progress</span>
                <span>{participantProgress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-900">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-400 transition-all"
                  style={{ width: `${participantProgress}%` }}
                />
              </div>
            </div>

            {selectedPuzzle && members.length < requiredPlayers && (
              <div className="mt-4 rounded-xl border border-amber-600/40 bg-amber-950/20 p-3 text-sm text-amber-100">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  <div>
                    Your team has <strong className="text-white">{members.length}</strong> member(s), but this puzzle requires <strong className="text-white">{requiredPlayers}</strong> players.
                    <div className="mt-1">
                      <a className="underline text-amber-200 hover:text-white" href={`/teams/${teamId}`}>Manage team members</a>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isLeader && (
              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/65 p-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">Invitations</h3>
                <p className="mt-1 text-xs text-slate-400">Invite by email or instantly invite existing team members.</p>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="teammate@email.com"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-white outline-none transition focus:border-cyan-400"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={onInviteClick}
                    disabled={!inviteEmail.trim() || !puzzleId.trim() || hasEnoughPlayers}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Send className="h-4 w-4" />
                    Invite Email
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  {hasEnoughPlayers ? (
                    <div className="rounded-lg border border-emerald-600/30 bg-emerald-900/20 px-3 py-2 text-xs font-semibold text-emerald-300">
                      Required players met - additional invites are blocked.
                    </div>
                  ) : (
                    members
                      .filter((m: TeamMember) => m.user?.id && m.user.id !== currentUserId)
                      .map((m: TeamMember) => {
                        const memberId = m.user?.id as string;
                        const alreadyParticipant = participantIds.includes(memberId);
                        const alreadyInvited = (lobby?.invites || []).some((inv: LobbyInvite) => inv.userId === memberId || inv.email === m.user?.email);
                        const inviteLimitReached = selectedPuzzle && (((participantsCount) + (lobby?.invites?.length || 0)) >= requiredPlayers || hasEnoughPlayers);
                        return (
                          <div key={memberId} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
                            <div className="text-sm text-slate-200">{m.user?.name || m.user?.email}</div>
                            <div>
                              {alreadyParticipant ? (
                                <span className="rounded-full bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-400">Participant</span>
                              ) : alreadyInvited ? (
                                <span className="rounded-full bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-400">Invited</span>
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
                                      openActionModal('success', 'Invited', `Invitation sent to ${m.user?.name || m.user?.email}`);
                                    } catch (err) {
                                      console.error('Invite failed', err);
                                      openActionModal('error', 'Invite Failed', 'An unexpected error occurred.');
                                    }
                                  }}
                                  disabled={!selectedPuzzle || !!inviteLimitReached}
                                  className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <UserPlus className="h-3.5 w-3.5" />
                                  Invite
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            )}
          </section>

          <aside className="lg:col-span-4 rounded-3xl border border-slate-800 bg-slate-950/70 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-6">
            <h2 className="text-lg font-bold text-white">Control Panel</h2>
            <p className="mt-1 text-sm text-slate-400">Run core lobby actions from one place.</p>

            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="flex items-center justify-between text-xs uppercase tracking-wider text-slate-400">
                <span>Readiness</span>
                <span>{readinessPercent}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-950">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all" style={{ width: `${readinessPercent}%` }} />
              </div>
              <div className="mt-2 text-xs text-slate-300">{readyCount}/{participantsCount || 0} participants ready</div>
            </div>

            <div className="mt-4 space-y-2">
              {currentUserInLobby ? (
                <button
                  onClick={onToggleReadyClick}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:brightness-110"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {isReady ? 'Set Not Ready' : 'Set Ready'}
                </button>
              ) : (
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
                  Lobby membership is automatic. Use Refresh if your status is out of sync.
                </div>
              )}

              {isLeader && (
                <button
                  onClick={onStartClick}
                  disabled={!selectedPuzzle || !hasEnoughPlayers || !allReady}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  title={
                    !selectedPuzzle
                      ? 'Select a puzzle to start'
                      : !hasEnoughPlayers
                        ? `Requires at least ${requiredPlayers} player${requiredPlayers !== 1 ? 's' : ''}`
                        : !allReady
                          ? 'All participants must be marked ready before starting'
                          : undefined
                  }
                >
                  <Play className="h-4 w-4" />
                  Start Puzzle
                </button>
              )}

              {isLeader && (
                <button
                  onClick={onShutdownClick}
                  disabled={!puzzleId}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-700/70 bg-red-950/40 px-4 py-2.5 text-sm font-bold text-red-200 transition hover:bg-red-950/60 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Shut down the current lobby"
                >
                  <Power className="h-4 w-4" />
                  Shut Down Lobby
                </button>
              )}

              {currentUserInLobby && (
                <button
                  onClick={onLeaveClick}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-rose-700/70 bg-rose-950/40 px-4 py-2.5 text-sm font-bold text-rose-200 transition hover:bg-rose-950/60"
                >
                  <LogOut className="h-4 w-4" />
                  Leave Lobby
                </button>
              )}
            </div>
          </aside>

          <section className="lg:col-span-7 rounded-3xl border border-slate-800 bg-slate-950/70 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-white">Participants</h2>
              <div className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-300">
                {participantsCount}/{requiredPlayers || '-'}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {participantsCount === 0 && (
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-400">
                  No participants yet. Select a puzzle and the lobby will auto-sync participants.
                </div>
              )}

              {(() => {
                interface DisplayParticipant { userId?: string; name?: string; _index: number }
                const rawParts: DisplayParticipant[] = (lobby?.participants || []).map((p, index): DisplayParticipant | null => {
                  if (!p) return null;
                  if (typeof p === 'string') return { userId: p, name: undefined, _index: index };
                  const userId = p.userId || p.id || p.user?.id;
                  const name = p.name || p.userName || p.user?.name || undefined;
                  return { userId, name, _index: index };
                }).filter((p): p is DisplayParticipant => p !== null);

                const parts = (() => {
                  const seen = new Set<string>();
                  const deduped: DisplayParticipant[] = [];
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

                return parts.map((part) => {
                  const uid: string | undefined = part.userId;
                  const member = members.find((m: TeamMember) => m.user?.id === uid);
                  const label = member ? (member.user?.name || member.user?.email) : (part.name || uid);
                  const initial = (label || "?").charAt(0).toUpperCase();
                  return (
                    <div key={uid ? `user:${uid}` : `idx:${part._index}`} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-cyan-200">
                          {initial}
                        </div>
                        <div className="truncate text-sm font-semibold text-white">{label}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs font-semibold uppercase tracking-wide">
                          {uid && lobby?.ready?.[uid] ? (
                            <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-emerald-300">Ready</span>
                          ) : (
                            <span className="rounded-full bg-rose-500/20 px-2 py-1 text-rose-300">Not Ready</span>
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
                            className="rounded-md bg-rose-700 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-rose-600"
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
              <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/55 p-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">Pending Invites</h3>
                <div className="mt-3 space-y-2">
                  {lobby.invites.map((inv: LobbyInvite, idx: number) => {
                    const inviter = members.find((m: TeamMember) => m.user?.id === inv.invitedBy);
                    const inviterLabel = inviter ? (inviter.user?.name || inviter.user?.email) : inv.invitedBy;
                    const invitedMember = inv.userId ? members.find((m: TeamMember) => m.user?.id === inv.userId) : null;
                    const inviteeLabel =
                      (invitedMember?.user?.name as string | undefined) ||
                      (inv.displayName as string | undefined) ||
                      (inv.userId as string | undefined) ||
                      'Invited player';

                    return (
                      <div key={inv.id ?? `${inv.userId ?? inv.email ?? 'inv'}:${idx}`} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/75 px-3 py-2">
                        <div className="text-sm text-slate-200">
                          {inviteeLabel}
                          <span className="ml-1 text-[11px] uppercase tracking-wide text-slate-500">({inv.status})</span>
                          <div className="text-[11px] text-slate-500">Invited by: {inviterLabel}</div>
                        </div>
                        {isLeader && (
                          <button
                            onClick={async () => {
                              try {
                                const res = await fetch('/api/team/lobby', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'uninvite', teamId, puzzleId, inviteId: inv.id }) });
                                const j = await res.json().catch(() => ({}));
                                if (!res.ok) return openActionModal('error', 'Uninvite Failed', j?.error || res.statusText);
                                await fetchLobby();
                                openActionModal('success', 'Invite Revoked', `Invitation revoked for ${inviteeLabel}`);
                              } catch (err) {
                                console.error('Uninvite failed', err);
                                openActionModal('error', 'Uninvite Failed', 'An unexpected error occurred.');
                              }
                            }}
                            className="rounded-md bg-rose-700 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-rose-600"
                          >
                            Uninvite
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          <section className="lg:col-span-5 rounded-3xl border border-slate-800 bg-slate-950/70 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                <MessageSquareText className="h-5 w-5 text-cyan-300" />
                Lobby Chat
              </h2>
              <div className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-300">
                {chatMessages.length} message{chatMessages.length === 1 ? '' : 's'}
              </div>
            </div>

            <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/85 p-2.5">
              {chatMessages.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-700 px-3 py-4 text-center text-sm text-slate-400">
                  No messages yet. Break the silence.
                </div>
              )}

              {chatMessages.map((m, idx) => {
                const member = (members || []).find((mm: TeamMember) => mm.user?.id && m?.userId && mm.user.id === m.userId);
                const senderLabel =
                  (m?.user?.name as string | undefined) ||
                  (m?.user?.email as string | undefined) ||
                  (member?.user?.name as string | undefined) ||
                  (member?.user?.email as string | undefined) ||
                  (m?.userId as string | undefined) ||
                  'Unknown';
                const key = m?.id ?? `${m?.userId ?? 'u'}:${m?.createdAt ?? idx}:${idx}`;
                const initial = senderLabel.charAt(0).toUpperCase();

                return (
                  <div key={key} className="flex items-start justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-2">
                    <div className="flex min-w-0 flex-1 gap-2">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-cyan-200">
                        {initial}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs text-slate-300">
                          <span className="font-semibold text-white">{senderLabel}</span>
                          <span className="ml-2 text-slate-500">{m.createdAt ? new Date(m.createdAt).toLocaleTimeString() : ''}</span>
                        </div>
                        <div className="mt-0.5 break-words text-sm text-slate-200">{m.content}</div>
                      </div>
                    </div>

                    {isAdmin && (
                      <button
                        onClick={async () => { if (m.id && confirm('Delete this message?')) await deleteChatMessage(m.id); }}
                        className="rounded-md border border-rose-700/70 bg-rose-950/40 px-2 py-1 text-[11px] font-semibold text-rose-200 transition hover:bg-rose-950/60"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400"
              />
              <button
                onClick={() => postChatMessage(chatInput)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-cyan-500"
              >
                <Send className="h-4 w-4" />
                Send
              </button>
            </div>
          </section>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmOpen}
        theme="teamLobby"
        confirmTone={
          confirmAction === 'destroy' || confirmAction === 'leave'
            ? 'danger'
            : confirmAction === 'start'
              ? 'success'
              : 'brand'
        }
        title={
          confirmAction === 'start'
            ? 'Start Puzzle'
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
        theme="teamLobby"
        title={actionModalTitle}
        message={actionModalMessage}
        onClose={() => {
          setActionModalOpen(false);
          if (redirectUrlOnClose) {
            try { router.push(redirectUrlOnClose); } catch { /* ignore */ }
            setRedirectUrlOnClose(null);
          }
        }}
      />
    </div>
  );
}
