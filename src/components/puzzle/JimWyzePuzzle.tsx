"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import ActionModal from "@/components/ActionModal";
import PuzzleModal from "@/components/puzzle/PuzzleModal";
import StageCelebration from "@/components/puzzle/StageCelebration";
import MiniPuzzleModal from "@/components/puzzle/mini/MiniPuzzleModal";
import type { MiniPuzzleType } from "@/components/puzzle/mini/MiniPuzzleModal";
import RoomIntroPlayer from "@/components/puzzle/RoomIntroPlayer";
import type { RoomIntro } from "@/components/puzzle/RoomIntroPlayer";

/** Check whether a URL points to a video file (mp4, webm, mov, avi). */
const isVideoUrl = (url: string | undefined | null): boolean => {
  if (!url || typeof url !== 'string') return false;
  const clean = url.split(/[?#]/)[0].toLowerCase();
  return /\.(mp4|webm|mov|avi)$/.test(clean);
};

const normalizeStringList = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean);
};

const sceneVariantMatches = (variant: any, flags: Set<string>): boolean => {
  const allFlags = normalizeStringList(variant?.allFlags);
  const anyFlags = normalizeStringList(variant?.anyFlags);
  const noneFlags = normalizeStringList(variant?.noneFlags);

  if (allFlags.length > 0 && !allFlags.every((flag) => flags.has(flag))) return false;
  if (anyFlags.length > 0 && !anyFlags.some((flag) => flags.has(flag))) return false;
  if (noneFlags.length > 0 && noneFlags.some((flag) => flags.has(flag))) return false;
  return true;
};

// IMPORTANT: keep this at module scope.
// Defining React.lazy() inside the component recreates a new component type on every render,
// which causes repeated unmount/mount cycles (flicker + lost pointer interaction).
const PixiRoom = React.lazy(() => import("./PixiRoom"));

type InventoryLocksMap = Record<
  string,
  {
    lockedBy: string;
    lockedByName?: string | null;
    lockedAt: string;
    expiresAt?: string | null;
  }
>;

type InventoryItem = {
  id: string;
  key: string;
  name: string;
  imageUrl: string | null;
};

type PendingPickup = {
  hotspotId: string;
  itemId: string;
  itemKey: string;
  itemName: string;
  imageUrl: string | null;
  label: string;
  animationPreset: 'cinematic' | 'quickSpin' | 'floatIn' | 'powerDrop' | 'spiral' | 'bounce' | 'glitch' | 'flash';
  pickupAnimationUrl?: string;
};

type EscapeActivityEntry = {
  id: string;
  ts: string;
  type: string;
  title: string;
  actor?: { id: string; name: string };
  meta?: Record<string, unknown>;
};

type LobbyChatMessage = {
  id: string;
  teamId: string;
  puzzleId: string;
  userId: string;
  content: string;
  createdAt: string;
  user?: { id: string; name?: string | null; email?: string | null } | null;
};

type EscapeRoomStage = {
  id: string;
  order: number;
  title: string;
  description: string | null;
  puzzleType: string;
  puzzleData: unknown;
  hints: unknown;
  rewardItem: string | null;
  rewardDescription: string | null;
};

type EscapeRoomResponse = {
  id: string;
  stages: EscapeRoomStage[];
  minTeamSize?: number;
  puzzle?: {
    title: string;
    description: string | null;
    intro?: RoomIntro | null;
    outro?: RoomIntro | null;
  };
  layouts?: Array<{
    id: string;
    title?: string | null;
    backgroundUrl?: string | null;
    foregroundUrl?: string | null;
    stateVariants?: Array<any>;
    width?: number | null;
    height?: number | null;
    hotspots?: Array<any>;
    items?: Array<any>;
  }>;
};

export default function JimWyzePuzzle({
  puzzleId,
  onComplete,
}: {
  puzzleId: string;
  onComplete?: () => void;
}) {
  const teamId: string | undefined = undefined;
  const lobbyId: string | undefined = undefined;
  const isSoloSession = true;
  // sessionId identifies the active run context (solo, lobby, or team)
  const sessionId = isSoloSession ? `solo:${puzzleId}` : (lobbyId ?? teamId ?? null);
  // sessionParam is the query string fragment used in GET fetch URLs
  const sessionParam = isSoloSession
    ? 'solo=1'
    : lobbyId
    ? `lobbyId=${encodeURIComponent(lobbyId)}`
    : teamId
    ? `teamId=${encodeURIComponent(teamId)}`
    : '';
  // sessionBody is the partial body object sent to escape-room API POST routes
  const sessionBody = isSoloSession ? { solo: true } : (lobbyId ? { lobbyId } : { teamId });
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EscapeRoomResponse | null>(null);
  const [stageIndex, setStageIndex] = useState(1);
  const [stageAspect, setStageAspect] = useState<string | null>(null);
  // answer input/submission not needed for this project; removed UI and handler
  const [inventory, setInventory] = useState<string[]>([]);
  const [inventoryItems, setInventoryItems] = useState<Record<string, InventoryItem>>({});
  const [selectedInventoryKey, setSelectedInventoryKey] = useState<string | null>(null);
  const [inspectingItem, setInspectingItem] = useState<InventoryItem | null>(null);
  const [briefingAcks, setBriefingAcks] = useState<Record<string, string>>({});
  const [inventoryLocks, setInventoryLocks] = useState<InventoryLocksMap>({});
  const [sceneState, setSceneState] = useState<Record<string, unknown>>({});
  const [sideTab, setSideTab] = useState<'inventory' | 'activity'>('inventory');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'inventory' | 'chat'>('inventory');
  const [immersiveMode, setImmersiveMode] = useState(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [activity, setActivity] = useState<EscapeActivityEntry[]>([]);
  const [runStartedAt, setRunStartedAt] = useState<string | null>(null);
  const [runExpiresAt, setRunExpiresAt] = useState<string | null>(null);
  const [failedAt, setFailedAt] = useState<string | null>(null);
  const [failedReason, setFailedReason] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  // Per-session local state: has this player watched/skipped the intro?
  const [introWatched, setIntroWatched] = useState(false);
  // Outro: shown once when the run completes live (not on re-join of completed run).
  const [outroActive, setOutroActive] = useState(false);
  const [isLeader, setIsLeader] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [timeRemainingMs, setTimeRemainingMs] = useState<number | null>(null);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [clientTimedOut, setClientTimedOut] = useState(false);
  const [timeExpiredModalOpen, setTimeExpiredModalOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const completedRef = useRef(false);
  const initialCompletedAtRef = useRef<string | null | undefined>(undefined);
  const abortHandledRef = useRef(false);
  const timeExpiredHandledRef = useRef(false);
  const socketRef = useRef<any>(null);
  const soundEnabledRef = useRef(true);
  const minTeamSizeRef = useRef<number>(1);
  const currentUserNameRef = useRef<string>('');
  const isLeaderRef = useRef<boolean>(false);

  const isFullscreenView = immersiveMode || isNativeFullscreen;
  const isPhoneViewport = viewportWidth > 0 && viewportWidth < 640;
  const isTabletViewport = viewportWidth >= 640 && viewportWidth < 1100;
  const isLandscapeViewport = viewportWidth > 0 && viewportHeight > 0 && viewportWidth > viewportHeight;
  const isCompactMobileViewport = isPhoneViewport || (isLandscapeViewport && viewportHeight > 0 && viewportHeight <= 560);
  const isMobileFullscreen = isFullscreenView && isCompactMobileViewport;
  const shouldStretchFullscreenCanvas =
    isFullscreenView &&
    isLandscapeViewport &&
    (isPhoneViewport || viewportHeight <= 560);
  const canvasHeight = isPhoneViewport
    ? 'min(60dvh, 460px)'
    : isTabletViewport
      ? 'min(70dvh, 760px)'
      : 'min(80dvh, 920px)';
  const drawerWidth = isPhoneViewport ? 'min(94vw, 420px)' : isTabletViewport ? '420px' : '460px';

  useEffect(() => {
    soundEnabledRef.current = !!soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    const syncViewport = () => {
      const vv = window.visualViewport;
      const nextW = Math.round(vv?.width ?? window.innerWidth ?? 0);
      const nextH = Math.round(vv?.height ?? window.innerHeight ?? 0);
      setViewportWidth(nextW);
      setViewportHeight(nextH);
    };

    syncViewport();
    window.addEventListener('resize', syncViewport);
    window.addEventListener('orientationchange', syncViewport);
    window.visualViewport?.addEventListener('resize', syncViewport);

    return () => {
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('orientationchange', syncViewport);
      window.visualViewport?.removeEventListener('resize', syncViewport);
    };
  }, []);

  const openDrawer = useCallback((tab: 'inventory' | 'chat') => {
    setDrawerTab(tab);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const host = playAreaHostRef.current;
    if (!host) return;

    const docAny = document as any;
    const hostAny = host as any;
    const fullscreenElement =
      document.fullscreenElement || docAny.webkitFullscreenElement || docAny.msFullscreenElement;

    if (fullscreenElement) {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
          return;
        }
        if (docAny.webkitExitFullscreen) {
          await docAny.webkitExitFullscreen();
          return;
        }
        if (docAny.msExitFullscreen) {
          await docAny.msExitFullscreen();
          return;
        }
      } catch {
        // Fall through to immersive mode fallback.
      }
      setImmersiveMode(false);
      return;
    }

    try {
      if (hostAny.requestFullscreen) {
        await hostAny.requestFullscreen();
        return;
      }
      if (hostAny.webkitRequestFullscreen) {
        await hostAny.webkitRequestFullscreen();
        return;
      }
      if (hostAny.msRequestFullscreen) {
        await hostAny.msRequestFullscreen();
        return;
      }
    } catch {
      // Fall back to immersive mode if fullscreen API fails or is blocked.
    }

    setImmersiveMode((prev) => !prev);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const docAny = document as any;
      const active = !!(document.fullscreenElement || docAny.webkitFullscreenElement || docAny.msFullscreenElement);
      setIsNativeFullscreen(active);
      if (active) setImmersiveMode(false);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange as EventListener);
    document.addEventListener('msfullscreenchange', handleFullscreenChange as EventListener);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange as EventListener);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!immersiveMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setImmersiveMode(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [immersiveMode]);

  useEffect(() => {
    const shouldLockBodyScroll = drawerOpen || immersiveMode;
    if (!shouldLockBodyScroll) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [drawerOpen, immersiveMode]);

  const playSfx = useCallback((raw: any) => {
    try {
      if (!soundEnabledRef.current) return;
      if (!raw) return;
      const url = typeof raw === 'string' ? raw : (typeof raw?.url === 'string' ? raw.url : '');
      if (!url) return;
      const v = Number(typeof raw === 'object' ? raw?.volume : undefined);
      const volume = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
      const audio = new Audio(url);
      audio.volume = volume;
      void audio.play().catch(() => {
        // ignore autoplay/permission failures
      });
    } catch {
      // ignore
    }
  }, []);

  // Chat (reuses lobby chat storage for team+puzzle)
  const [chatMessages, setChatMessages] = useState<LobbyChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatAbortRef = useRef<AbortController | null>(null);

  const refreshState = useCallback(async () => {
    if (!sessionId) return;
    try {
      const st = await fetch(`/api/puzzles/escape-room/${puzzleId}/state?${sessionParam}`);
      if (!st.ok) return;
      const sj = await st.json().catch(() => null);
      if (sj && sj.inventory) setInventory(sj.inventory || []);
      if (sj && sj.inventoryItems) setInventoryItems(sj.inventoryItems || {});
      if (sj && sj.briefingAcks) setBriefingAcks(sj.briefingAcks || {});
      if (sj && sj.inventoryLocks) setInventoryLocks(sj.inventoryLocks || {});
      if (sj && sj.sceneState) setSceneState(sj.sceneState || {});
      if (sj && sj.currentStageIndex !== undefined) {
        const idx = Number(sj.currentStageIndex);
        if (Number.isFinite(idx) && idx >= 1) setStageIndex(Math.floor(idx));
      }
      setRunStartedAt(sj?.runStartedAt ? String(sj.runStartedAt) : null);
      setRunExpiresAt(sj?.runExpiresAt ? String(sj.runExpiresAt) : null);
      setFailedAt(sj?.failedAt ? String(sj.failedAt) : null);
      setFailedReason(sj?.failedReason ? String(sj.failedReason) : null);
      setCompletedAt(sj?.completedAt ? String(sj.completedAt) : null);
      const leader = !!sj?.isLeader;
      setIsLeader(leader);
      isLeaderRef.current = leader;
      setIsPaused(!!sj?.pausedAt);
    } catch {
      // ignore
    }
  }, [sessionId, puzzleId]);

  const exitToDashboard = useCallback(() => {
    try {
      if (sessionId && currentUserId) {
        try { socketRef.current?.emit('leaveEscapeRoom', { teamId: sessionId, puzzleId, userId: currentUserId }); } catch {}
      }
    } finally {
      try { socketRef.current?.disconnect(); } catch {}
      socketRef.current = null;
      router.push('/dashboard');
    }
  }, [router, sessionId, puzzleId, currentUserId]);


  useEffect(() => {
    completedRef.current = false;
    initialCompletedAtRef.current = undefined;
    timeExpiredHandledRef.current = false;
    setClientTimedOut(false);
    setTimeExpiredModalOpen(false);
    setActivity([]);
    setSideTab('inventory');

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        if (!sessionId) {
          throw new Error('This escape room must be played with a team or lobby. Open it from a team lobby.');
        }

        const res = await fetch(`/api/puzzles/escape-room/${puzzleId}?${sessionParam}`);
        if (!res.ok) throw new Error("Failed to load escape room");
        const j = await res.json();
        if (cancelled) return;
        setData(j as EscapeRoomResponse);
        if (typeof (j as any).minTeamSize === 'number' && (j as any).minTeamSize > 0) {
          minTeamSizeRef.current = (j as any).minTeamSize;
        }

        try {
          const u = await fetch('/api/user/info');
          if (u.ok) {
            const uj = await u.json().catch(() => null);
            if (uj?.id) setCurrentUserId(String(uj.id));
            if (uj?.name) currentUserNameRef.current = String(uj.name);
          }
        } catch {
          // ignore
        }

        try {
          const s = await fetch('/api/user/settings');
          if (s.ok) {
            const sj = await s.json().catch(() => null);
            if (sj && typeof sj.soundEnabled === 'boolean') setSoundEnabled(!!sj.soundEnabled);
          }
        } catch {
          // ignore
        }

        const st = await fetch(`/api/puzzles/escape-room/${puzzleId}/state?${sessionParam}`);
        if (st.ok) {
          const sj = await st.json().catch(() => null);
          if (sj && sj.inventory) setInventory(sj.inventory || []);
          if (sj && sj.inventoryItems) setInventoryItems(sj.inventoryItems || {});
          if (sj && sj.briefingAcks) setBriefingAcks(sj.briefingAcks || {});
          if (sj && sj.inventoryLocks) setInventoryLocks(sj.inventoryLocks || {});
          if (sj && sj.sceneState) setSceneState(sj.sceneState || {});
          if (sj && sj.currentStageIndex !== undefined) {
            const idx = Number(sj.currentStageIndex);
            if (Number.isFinite(idx) && idx >= 1) setStageIndex(Math.floor(idx));
          }
          setRunStartedAt(sj?.runStartedAt ? String(sj.runStartedAt) : null);
          setRunExpiresAt(sj?.runExpiresAt ? String(sj.runExpiresAt) : null);
          setFailedAt(sj?.failedAt ? String(sj.failedAt) : null);
          setFailedReason(sj?.failedReason ? String(sj.failedReason) : null);
          const initialCompletedAt = sj?.completedAt ? String(sj.completedAt) : null;
          initialCompletedAtRef.current = initialCompletedAt;
          setCompletedAt(initialCompletedAt);
          const initialLeader = !!sj?.isLeader;
          setIsLeader(initialLeader);
          isLeaderRef.current = initialLeader;
          setIsPaused(!!sj?.pausedAt);
        } else {
          // If we can't fetch initial state, treat as "not completed" baseline.
          initialCompletedAtRef.current = null;
        }
      } catch (e: any) {
        setError(e?.message || String(e));
        // If the initial load fails, treat as "not completed" baseline so a later state update can still trigger.
        initialCompletedAtRef.current = null;
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [puzzleId, sessionId]);

  useEffect(() => {
    if (isSoloSession || !sessionId || !currentUserId) return;
    let cancelled = false;
    (async () => {
      try {
        const { io } = await import('socket.io-client');
        if (cancelled) return;

        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || (process.env.NODE_ENV !== 'production' ? 'http://localhost:4000' : '');
        if (!socketUrl) return;

        const socket = io(socketUrl, { transports: ['polling', 'websocket'] });
        socketRef.current = socket;

        const pushActivity = (entry: EscapeActivityEntry) => {
          setActivity((prev) => {
            const next = [entry, ...prev];
            return next.length > 80 ? next.slice(0, 80) : next;
          });
        };

        socket.on('connect', () => {
          try {
            // For lobby-based runs, always pass requiredPlayers=1 so a single player
            // disconnect does not abort the session for everyone else. The contribution
            // gate was already removed; consistency requires the same here.
            const effectiveRequired = lobbyId ? 1 : minTeamSizeRef.current;
            socket.emit('joinEscapeRoom', { teamId: sessionId, puzzleId, userId: currentUserId, userName: currentUserNameRef.current, isHost: isLeaderRef.current, isLobby: !!lobbyId, requiredPlayers: effectiveRequired });
          } catch {
            // ignore
          }

          pushActivity({
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            ts: new Date().toISOString(),
            type: 'connected',
            title: 'Connected to team channel',
            actor: { id: currentUserId, name: 'You' },
          });
        });

        socket.on('escapeSessionUpdated', (payload: any) => {
          try {
            if (!payload) return;
            if (payload.teamId && payload.teamId !== sessionId) return;
            if (payload.puzzleId && payload.puzzleId !== puzzleId) return;
            if (payload.briefingAcks !== undefined) setBriefingAcks(payload.briefingAcks || {});
            if (payload.inventoryLocks) setInventoryLocks(payload.inventoryLocks || {});
            if (payload.runStartedAt !== undefined) setRunStartedAt(payload.runStartedAt ? String(payload.runStartedAt) : null);
            if (payload.runExpiresAt !== undefined) setRunExpiresAt(payload.runExpiresAt ? String(payload.runExpiresAt) : null);
            if (payload.failedAt !== undefined) setFailedAt(payload.failedAt ? String(payload.failedAt) : null);
            if (payload.failedReason !== undefined) setFailedReason(payload.failedReason ? String(payload.failedReason) : null);
            if (payload.completedAt !== undefined) setCompletedAt(payload.completedAt ? String(payload.completedAt) : null);
            if (payload.currentStageIndex !== undefined) {
              const idx = Number(payload.currentStageIndex);
              if (Number.isFinite(idx) && idx >= 1) setStageIndex(Math.floor(idx));
            }
            if (payload.inventory !== undefined) {
              if (Array.isArray(payload.inventory)) setInventory(payload.inventory);
            }
            if (payload.inventoryItems !== undefined) {
              setInventoryItems(payload.inventoryItems || {});
            }
            if (payload.sceneState !== undefined) {
              setSceneState(payload.sceneState || {});
            }
          } catch {
            // ignore
          }
        });

        socket.on('escapeActivity', (payload: any) => {
          try {
            if (!payload) return;
            if (payload.teamId && payload.teamId !== sessionId) return;
            if (payload.puzzleId && payload.puzzleId !== puzzleId) return;
            const entry = payload.entry as EscapeActivityEntry | undefined;
            if (!entry || !entry.id || !entry.ts || !entry.title) return;
            pushActivity(entry);
            playSfx((entry as any)?.meta?.sfx);
          } catch {
            // ignore
          }
        });

        socket.on('escapeHostChanged', (payload: any) => {
          try {
            if (payload?.teamId && payload.teamId !== sessionId) return;
            if (payload?.puzzleId && payload.puzzleId !== puzzleId) return;
            // Re-fetch state so every client gets the correct isLeader value.
            refreshState().catch(() => null);
          } catch {
            // ignore
          }
        });

        socket.on('escapePlayerLeft', (payload: any) => {
          try {
            if (payload?.teamId && payload.teamId !== sessionId) return;
            if (payload?.puzzleId && payload.puzzleId !== puzzleId) return;
            const name = payload?.userName || 'A teammate';
            pushActivity({
              id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
              ts: new Date().toISOString(),
              type: 'system' as any,
              title: `${name} left the game`,
              actor: { id: payload?.userId || '', name },
              meta: {},
            });
          } catch {
            // ignore
          }
        });

        socket.on('escapeAborted', (payload: any) => {
          try {
            if (abortHandledRef.current) return;
            if (payload?.teamId && payload.teamId !== sessionId) return;
            if (payload?.puzzleId && payload.puzzleId !== puzzleId) return;
            abortHandledRef.current = true;

            const reason = payload?.reason ? String(payload.reason) : 'abort';
            const notice =
              reason === 'missing_player'
                ? 'A teammate did not join in time. The lobby was reset — please restart.'
                : 'A teammate disconnected. The lobby was reset — please restart.';
            // Prefer going back to the escape room lobby page
            const url = lobbyId
              ? `/escape-rooms/${puzzleId}/lobby`
              : teamId
              ? `/teams/${teamId}/lobby?puzzleId=${encodeURIComponent(puzzleId)}&notice=${encodeURIComponent(notice)}`
              : '/dashboard';

            try {
              router.push(url);
            } catch {
              window.location.href = url;
            }
          } catch {
            // ignore
          }
        });
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
      try {
        socketRef.current?.emit('leaveEscapeRoom', { teamId: sessionId, puzzleId, userId: currentUserId });
      } catch {}
      try { socketRef.current?.disconnect(); } catch {}
      socketRef.current = null;
    };
  }, [isSoloSession, sessionId, puzzleId, currentUserId, router, playSfx, lobbyId, teamId]);

  // Fallback sync before the run starts. This prevents clients from getting stuck
  // on the briefing screen if a realtime event is delayed or missed.
  useEffect(() => {
    if (!sessionId) return;
    if (runStartedAt || failedAt || completedAt) return;

    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      await refreshState();
    };

    void tick();
    const t = setInterval(() => {
      void tick();
    }, 2500);

    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [sessionId, runStartedAt, failedAt, completedAt, refreshState]);

  useEffect(() => {
    if (isSoloSession || !sessionId) return;
    let cancelled = false;

    const fetchChat = async () => {
      try {
        chatAbortRef.current?.abort();
      } catch {
        // ignore
      }
      const c = new AbortController();
      chatAbortRef.current = c;
      try {
        const res = await fetch(
          `/api/team/lobby/chat?teamId=${encodeURIComponent(teamId ?? '')}&puzzleId=${encodeURIComponent(puzzleId)}&limit=200`,
          { signal: c.signal }
        );
        if (!res.ok) return;
        const j = await res.json().catch(() => null);
        if (cancelled) return;
        setChatMessages(Array.isArray(j?.messages) ? (j.messages as LobbyChatMessage[]) : []);
      } catch {
        // ignore
      }
    };

    const tc = setInterval(fetchChat, 3000);
    void fetchChat();

    return () => {
      cancelled = true;
      clearInterval(tc);
      try {
        chatAbortRef.current?.abort();
      } catch {
        // ignore
      }
    };
  }, [isSoloSession, teamId, puzzleId]);

  const postChatMessage = useCallback(async (content: string) => {
    const msg = (content || '').trim();
    if (!msg) return;
    if (!teamId) return;
    try {
      const res = await fetch('/api/team/lobby/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, puzzleId, content: msg }),
      });
      if (!res.ok) return;
      setChatInput('');
      // refresh after send
      try {
        const fres = await fetch(
          `/api/team/lobby/chat?teamId=${encodeURIComponent(teamId)}&puzzleId=${encodeURIComponent(puzzleId)}&limit=200`
        );
        if (fres.ok) {
          const j = await fres.json().catch(() => null);
          setChatMessages(Array.isArray(j?.messages) ? (j.messages as LobbyChatMessage[]) : []);
        }
      } catch {
        // ignore
      }
    } catch {
      // ignore
    }
  }, [teamId, puzzleId]);

  const formatActivityTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  useEffect(() => {
    if (!runExpiresAt || failedAt || completedAt) {
      setTimeRemainingMs(null);
      return;
    }
    const tick = () => {
      const end = new Date(runExpiresAt).getTime();
      const ms = end - Date.now();
      setTimeRemainingMs(ms);
      if (ms <= 0) {
        setTimeRemainingMs(0);
      }
    };
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [runExpiresAt, failedAt, completedAt]);

  // When the local countdown hits zero, immediately lock interactions and show the end modal.
  // Then refresh state so the server can mark the run as failed (Time expired).
  useEffect(() => {
    if (!runStartedAt) return;
    if (!runExpiresAt) return;
    if (completedAt || failedAt) return;
    if (timeRemainingMs !== 0) return;
    if (timeExpiredHandledRef.current) return;

    timeExpiredHandledRef.current = true;
    setClientTimedOut(true);
    setTimeExpiredModalOpen(true);
    void refreshState();
  }, [runStartedAt, runExpiresAt, timeRemainingMs, failedAt, completedAt, refreshState]);

  // If the server marks the run failed (e.g., after a refresh or another device hit state), show the modal.
  useEffect(() => {
    if (!failedAt) return;
    if (completedAt) return;
    if (timeExpiredModalOpen) return;
    if (typeof failedReason === 'string' && failedReason.toLowerCase().includes('time')) {
      setClientTimedOut(true);
      setTimeExpiredModalOpen(true);
    }
  }, [failedAt, failedReason, completedAt, timeExpiredModalOpen]);

  const stage = useMemo(() => {
    if (!data) return null;
    return data.stages?.find((s) => s.order === stageIndex) ?? data.stages?.[0] ?? null;
  }, [data, stageIndex]);

  useEffect(() => {
    if (loading) return;
    if (completedRef.current) return;
    // Only signal completion when the run is actually marked completed.
    // Avoid triggering on initial load (e.g., joining an already-completed run) by requiring
    // a transition from "not completed" baseline.
    if (initialCompletedAtRef.current === undefined) return;
    if (initialCompletedAtRef.current !== null) return;
    if (!completedAt) return;

    completedRef.current = true;
    // If an outro is configured, show it first; onComplete fires after dismissal.
    const outro = data?.puzzle?.outro;
    const hasOutro = !!(outro && (outro.videoUrl || outro.posterUrl || outro.title || outro.bodyText));
    if (hasOutro) {
      setOutroActive(true);
    } else {
      onComplete?.();
    }
  }, [loading, completedAt, onComplete, data]);

  const hints = useMemo(() => {
    if (!stage) return [] as string[];
    const raw = stage.hints;
    if (Array.isArray(raw)) return raw.map((h) => (typeof h === "string" ? h : JSON.stringify(h)));
    try { return typeof raw === "string" ? JSON.parse(raw) : []; } catch { return [] as string[]; }
  }, [stage]);

  /** Animation config for the current scene (transitionIn, solveCelebration). */
  const stageAnimConfig = useMemo(() => {
    if (!stage) return null;
    try {
      const pd = typeof stage.puzzleData === 'string' ? JSON.parse(stage.puzzleData as string) : (stage.puzzleData || {});
      const scene = (pd as any)?.scene || {};
      return {
        transitionIn: typeof scene.transitionIn === 'string' ? scene.transitionIn : 'fade',
        solveCelebration: typeof scene.solveCelebration === 'string' ? scene.solveCelebration : 'confetti',
        bgm: scene.bgm && typeof scene.bgm.url === 'string' && scene.bgm.url
          ? { url: scene.bgm.url, volume: typeof scene.bgm.volume === 'number' ? scene.bgm.volume : 0.5 }
          : null,
        enterSfx: typeof scene.enterSfx === 'string' && scene.enterSfx ? scene.enterSfx : null,
        solveSfx: typeof scene.solveSfx === 'string' && scene.solveSfx ? scene.solveSfx : null,
      };
    } catch {
      return { transitionIn: 'fade', solveCelebration: 'confetti', bgm: null, enterSfx: null, solveSfx: null };
    }
  }, [stage]);

  // submit handler removed — stage answers are not used in this variant

  const baseLayout = useMemo(() => {
    if (!data?.layouts || data.layouts.length === 0) return null;
    const currentSceneId = typeof (sceneState as any)?.currentSceneId === 'string'
      ? String((sceneState as any).currentSceneId).trim()
      : '';
    if (currentSceneId) {
      const sceneLayout = data.layouts.find((candidate) => candidate?.id === currentSceneId) || null;
      if (sceneLayout) return sceneLayout;
    }
    // Best-effort: align stage 1 -> layout[0], stage 2 -> layout[1], etc.
    const idx = Math.max(0, Math.min(stageIndex - 1, data.layouts.length - 1));
    return data.layouts[idx];
  }, [data, sceneState, stageIndex]);

  const layout = useMemo(() => {
    if (!baseLayout) return null;

    const itemsRaw = Array.isArray((baseLayout as any)?.items) ? ((baseLayout as any).items as any[]) : [];
    const hotspotsRaw = Array.isArray((baseLayout as any)?.hotspots) ? ((baseLayout as any).hotspots as any[]) : [];
    const flags = new Set<string>(normalizeStringList((sceneState as any)?.flags));
    const stateVariantsRaw = Array.isArray((baseLayout as any)?.stateVariants)
      ? ((baseLayout as any).stateVariants as any[])
      : (Array.isArray((baseLayout as any)?.variants) ? ((baseLayout as any).variants as any[]) : []);
    const activeVariant = stateVariantsRaw.find((candidate) => sceneVariantMatches(candidate, flags)) || null;

    const resolvedBackgroundUrl =
      (typeof activeVariant?.backgroundUrl === 'string' && activeVariant.backgroundUrl.trim())
        ? activeVariant.backgroundUrl.trim()
        : ((baseLayout as any)?.backgroundUrl || null);
    const resolvedForegroundUrl =
      (typeof activeVariant?.foregroundUrl === 'string' && activeVariant.foregroundUrl.trim())
        ? activeVariant.foregroundUrl.trim()
        : ((baseLayout as any)?.foregroundUrl || null);

    // Collected scene items (admin/designer items) are stored in inventory by key format: item_<escapeRoomId>_<designerItemId>
    const collected = new Set<string>();
    for (const k of inventory || []) {
      if (typeof k !== 'string') continue;
      const parts = k.split('_');
      const candidate = parts.length >= 3 ? parts[parts.length - 1] : '';
      if (candidate) collected.add(candidate);
    }

    const hiddenItemIds = new Set<string>(Array.isArray((sceneState as any)?.hiddenItemIds) ? (sceneState as any).hiddenItemIds : []);
    const shownItemIds = new Set<string>(Array.isArray((sceneState as any)?.shownItemIds) ? (sceneState as any).shownItemIds : []);
    const disabledHotspotIds = new Set<string>(Array.isArray((sceneState as any)?.disabledHotspotIds) ? (sceneState as any).disabledHotspotIds : []);
    const enabledHotspotIds = new Set<string>(Array.isArray((sceneState as any)?.enabledHotspotIds) ? (sceneState as any).enabledHotspotIds : []);
    const itemStates = ((sceneState as any)?.itemStates && typeof (sceneState as any).itemStates === 'object')
      ? ((sceneState as any).itemStates as Record<string, string>)
      : {};
    const itemImageOverrides = ((sceneState as any)?.itemImageOverrides && typeof (sceneState as any).itemImageOverrides === 'object')
      ? ((sceneState as any).itemImageOverrides as Record<string, string>)
      : {};
    const itemAlphaOverrides = ((sceneState as any)?.itemAlphaOverrides && typeof (sceneState as any).itemAlphaOverrides === 'object')
      ? ((sceneState as any).itemAlphaOverrides as Record<string, number>)
      : {};
    const itemScaleOverrides = ((sceneState as any)?.itemScaleOverrides && typeof (sceneState as any).itemScaleOverrides === 'object')
      ? ((sceneState as any).itemScaleOverrides as Record<string, number>)
      : {};
    const itemRotationOverrides = ((sceneState as any)?.itemRotationOverrides && typeof (sceneState as any).itemRotationOverrides === 'object')
      ? ((sceneState as any).itemRotationOverrides as Record<string, number>)
      : {};
    const itemTintOverrides = ((sceneState as any)?.itemTintOverrides && typeof (sceneState as any).itemTintOverrides === 'object')
      ? ((sceneState as any).itemTintOverrides as Record<string, string>)
      : {};

    const filteredItems = itemsRaw.filter((it: any) => {
      const id = typeof it?.id === 'string' ? it.id : '';
      if (id && collected.has(id)) return false;
      const hiddenByDefault = !!it?.properties?.hiddenByDefault;
      if (hiddenByDefault && id && !shownItemIds.has(id)) return false;
      if (id && hiddenItemIds.has(id) && !shownItemIds.has(id)) return false;
      return true;
    });

    const parseMeta = (raw: any) => {
      if (!raw) return {} as any;
      if (typeof raw === 'object') return raw as any;
      if (typeof raw !== 'string') return {} as any;
      try {
        return JSON.parse(raw) as any;
      } catch {
        return {} as any;
      }
    };

    const filteredHotspots = hotspotsRaw.filter((hs: any) => {
      const id = typeof hs?.id === 'string' ? hs.id : '';
      const meta = parseMeta(hs?.meta);
      const zoneId = typeof meta?.zoneId === 'string' ? meta.zoneId : '';
      const disabledByDefault = meta?.disabledByDefault === true;

      const identifiers = [id, zoneId].filter(Boolean);
      const isEnabled = identifiers.some((k) => enabledHotspotIds.has(k));
      const isDisabled = identifiers.some((k) => disabledHotspotIds.has(k));

      if (disabledByDefault && identifiers.length > 0 && !isEnabled) return false;
      if (identifiers.length > 0 && isDisabled && !isEnabled) return false;
      return true;
    });

    const resolvedItems = filteredItems.map((it: any) => {
      const id = typeof it?.id === 'string' ? it.id : '';
      const explicitOverride = id ? itemImageOverrides[id] : null;
      const stateKey = id ? itemStates[id] : null;
      const stateMap =
        (it?.properties?.spriteStates && typeof it.properties.spriteStates === 'object')
          ? (it.properties.spriteStates as Record<string, unknown>)
          : {};
      const stateImage =
        stateKey && typeof stateMap[stateKey] === 'string'
          ? (stateMap[stateKey] as string)
          : null;

      const imageUrl =
        (typeof explicitOverride === 'string' && explicitOverride.trim().length > 0)
          ? explicitOverride
          : (typeof stateImage === 'string' && stateImage.trim().length > 0)
          ? stateImage
          : it?.imageUrl;

      const alphaRaw = id ? itemAlphaOverrides[id] : undefined;
      const alphaNum = Number(alphaRaw);
      const visualAlpha = Number.isFinite(alphaNum) ? Math.max(0, Math.min(1, alphaNum)) : undefined;

      const scaleRaw = id ? itemScaleOverrides[id] : undefined;
      const scaleNum = Number(scaleRaw);
      const visualScale = Number.isFinite(scaleNum) && scaleNum > 0 ? Math.max(0.1, Math.min(5, scaleNum)) : undefined;

      const rotationRaw = id ? itemRotationOverrides[id] : undefined;
      const rotationNum = Number(rotationRaw);
      const visualRotationDeg = Number.isFinite(rotationNum) ? rotationNum : undefined;

      const tintRaw = id ? itemTintOverrides[id] : undefined;
      const visualTint = (typeof tintRaw === 'string' && tintRaw.trim().length > 0) ? tintRaw.trim() : undefined;

      return {
        ...it,
        imageUrl,
        ...(visualAlpha !== undefined ? { visualAlpha } : {}),
        ...(visualScale !== undefined ? { visualScale } : {}),
        ...(visualRotationDeg !== undefined ? { visualRotationDeg } : {}),
        ...(visualTint ? { visualTint } : {}),
      };
    });

    return {
      ...(baseLayout as any),
      backgroundUrl: resolvedBackgroundUrl,
      foregroundUrl: resolvedForegroundUrl,
      ...(activeVariant?.id ? { activeVariantId: activeVariant.id } : {}),
      items: resolvedItems,
      hotspots: filteredHotspots,
    };
  }, [baseLayout, inventory, sceneState]);

  // If the stage/layout changes, drop the previously inferred aspect ratio.
  // PixiRoom will report the new effective layout size once its background loads.
  useEffect(() => {
    setStageAspect(null);
  }, [stageIndex, (layout as any)?.id]);

  // Refs for scene transition & celebration tracking
  const prevStageIndexRef = useRef<number>(stageIndex);
  const prevStageAnimConfigRef = useRef<typeof stageAnimConfig>(null);
  const sceneTransTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sceneShakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const penaltyToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const bgmFadeRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Browsers block autoplay until a user gesture. On first interaction, resume BGM if it was blocked.
  useEffect(() => {
    const resumeBgm = () => {
      const el = bgmRef.current;
      if (el && el.paused && el.src && soundEnabledRef.current) {
        void el.play().catch(() => {});
      }
      window.removeEventListener('click', resumeBgm);
      window.removeEventListener('keydown', resumeBgm);
      window.removeEventListener('touchstart', resumeBgm);
    };
    window.addEventListener('click', resumeBgm);
    window.addEventListener('keydown', resumeBgm);
    window.addEventListener('touchstart', resumeBgm);
    return () => {
      window.removeEventListener('click', resumeBgm);
      window.removeEventListener('keydown', resumeBgm);
      window.removeEventListener('touchstart', resumeBgm);
    };
  }, []);

  useEffect(() => {
    const prev = prevStageIndexRef.current;
    prevStageIndexRef.current = stageIndex;
    const prevCfg = prevStageAnimConfigRef.current;
    prevStageAnimConfigRef.current = stageAnimConfig;

    // Skip the initial mount (prevCfg is null and stageIndex hasn't changed)
    if (prevCfg === null) return;
    if (prev === stageIndex) return;

    // Stage advanced — show solve celebration for the just-completed scene
    if (stageIndex > prev && prevCfg?.solveCelebration && prevCfg.solveCelebration !== 'none' && runStartedAt) {
      setCelebration({ variant: prevCfg.solveCelebration, key: Date.now() });
    }
    // Solve SFX
    if (stageIndex > prev && prevCfg?.solveSfx && runStartedAt) {
      playSfx(prevCfg.solveSfx);
    }

    // Trigger transition-in animation for the incoming scene
    const transType = stageAnimConfig?.transitionIn || 'fade';
    if (transType !== 'none') {
      setSceneTransitionType(transType);
      setSceneTransitionPhase('in');
      if (sceneTransTimerRef.current) clearTimeout(sceneTransTimerRef.current);
      sceneTransTimerRef.current = setTimeout(() => {
        setSceneTransitionPhase('idle');
        sceneTransTimerRef.current = null;
      }, 700);
    }
    // Enter SFX for incoming scene
    if (stageAnimConfig?.enterSfx) {
      playSfx(stageAnimConfig.enterSfx);
    }
  }, [stageIndex, stageAnimConfig, runStartedAt]);

  // Cleanup transition timer on unmount
  useEffect(() => {
    return () => {
      if (sceneTransTimerRef.current) clearTimeout(sceneTransTimerRef.current);
      if (sceneShakeTimerRef.current) clearTimeout(sceneShakeTimerRef.current);
      if (penaltyToastTimerRef.current) clearTimeout(penaltyToastTimerRef.current);
      if (bgmFadeRef.current) clearInterval(bgmFadeRef.current);
      if (bgmRef.current) { bgmRef.current.pause(); bgmRef.current = null; }
    };
  }, []);

  // BGM crossfade — starts/stops looping background music when scene changes
  useEffect(() => {
    if (!soundEnabledRef.current) {
      if (bgmRef.current) { bgmRef.current.pause(); bgmRef.current = null; }
      return;
    }
    const cfg = stageAnimConfig?.bgm;
    const newUrl = cfg?.url || '';
    const newVol = cfg?.volume ?? 0.5;
    const cur = bgmRef.current;
    const isSameTrack = cur && !cur.paused && cur.dataset.src === newUrl && !!newUrl;
    if (isSameTrack) return;
    // Fade out existing track
    if (cur && !cur.paused) {
      if (bgmFadeRef.current) clearInterval(bgmFadeRef.current);
      const startVol = cur.volume;
      let step = 0;
      const steps = 20;
      bgmFadeRef.current = setInterval(() => {
        step++;
        cur.volume = Math.max(0, startVol * (1 - step / steps));
        if (step >= steps) {
          cur.pause();
          clearInterval(bgmFadeRef.current!);
          bgmFadeRef.current = null;
        }
      }, 30) as unknown as ReturnType<typeof setInterval>;
    }
    // Start new track
    if (newUrl) {
      const el = new Audio(newUrl);
      el.loop = true;
      el.volume = 0;
      el.dataset.src = newUrl;
      bgmRef.current = el;
      void el.play().catch(() => {});
      if (bgmFadeRef.current) clearInterval(bgmFadeRef.current);
      let step = 0;
      const steps = 20;
      bgmFadeRef.current = setInterval(() => {
        step++;
        el.volume = Math.min(newVol, newVol * (step / steps));
        if (step >= steps) {
          clearInterval(bgmFadeRef.current!);
          bgmFadeRef.current = null;
        }
      }, 30) as unknown as ReturnType<typeof setInterval>;
    } else {
      bgmRef.current = null;
    }
   
  }, [stageAnimConfig]);

  // Pause/resume BGM when soundEnabled toggles
  useEffect(() => {
    if (!soundEnabled && bgmRef.current) {
      bgmRef.current.pause();
    } else if (soundEnabled && bgmRef.current?.paused && bgmRef.current.src) {
      void bgmRef.current.play().catch(() => {});
    }
  }, [soundEnabled]);

  const playAreaHostRef = useRef<HTMLDivElement | null>(null);
  const fullscreenOverlayPortalRef = useRef<HTMLDivElement | null>(null);
  const stageDropRef = useRef<HTMLDivElement | null>(null);
  const inventoryPanelRef = useRef<HTMLDivElement | null>(null);
  const pickupAnimTimerRef = useRef<number | null>(null);
  const actionInFlightRef = useRef(false);
  const hotspotCooldownRef = useRef<Map<string, number>>(new Map());
  const [isActionInFlight, setIsActionInFlight] = useState(false);
  const [effectiveLayoutSize, setEffectiveLayoutSize] = useState<{ w: number; h: number } | null>(null);

  const onEffectiveLayoutSize = useCallback((w: number, h: number) => {
    if (!w || !h) return;
    setStageAspect(`${w} / ${h}`);
    setEffectiveLayoutSize({ w, h });
  }, []);

  const actionModalTheme = useMemo(() => {
    const roomTitle = (data?.puzzle?.title || '').toLowerCase();
    const sceneTitle = (((layout as any)?.title as string | null) || '').toLowerCase();
    const isSpeakeasy = roomTitle.includes('speakeasy') || sceneTitle.includes('speakeasy');
    return isSpeakeasy ? 'escapeRoomSpeakeasy' : 'escapeRoom';
  }, [data?.puzzle?.title, layout]);

  const hotspots = useMemo(() => {
    const hs = (layout as any)?.hotspots;
    return Array.isArray(hs) ? hs : [];
  }, [layout]);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionModalTitle, setActionModalTitle] = useState<string | undefined>(undefined);
  const [actionModalMessage, setActionModalMessage] = useState<string | undefined>(undefined);
  const [actionModalImageUrl, setActionModalImageUrl] = useState<string | null>(null);
  const [actionModalDescription, setActionModalDescription] = useState<string | undefined>(undefined);
  const [actionModalChoices, setActionModalChoices] = useState<Array<{ label: string; modalContent: string; imageUrl?: string }> | null>(null);
  const [actionModalChoiceIndex, setActionModalChoiceIndex] = useState<number>(0);
  // Item IDs that have been triggered — PixiRoom swaps these to their animationVideoUrl in-place
  const [triggeredItemIds, setTriggeredItemIds] = useState<Set<string>>(new Set());
  const [pendingPickup, setPendingPickup] = useState<PendingPickup | null>(null);
  const [pickupPhase, setPickupPhase] = useState<'reveal' | 'ready' | 'committing' | 'toInventory'>('reveal');
  const [pickupFlight, setPickupFlight] = useState<{ dx: number; dy: number; scale: number } | null>(null);
  const [inventoryPulse, setInventoryPulse] = useState(false);
  // Scene transition & celebration state
  const [sceneTransitionPhase, setSceneTransitionPhase] = useState<'idle' | 'in'>('idle');
  const [sceneTransitionType, setSceneTransitionType] = useState<string>('fade');
  const [celebration, setCelebration] = useState<{ variant: string; key: number } | null>(null);
  const [sceneShake, setSceneShake] = useState(false);
  const [penaltyToast, setPenaltyToast] = useState<string | null>(null);
  const [miniPuzzleState, setMiniPuzzleState] = useState<{
    open: boolean;
    puzzleType: MiniPuzzleType;
    config: any;
    hotspotId: string;
    label: string;
  } | null>(null);
  const [puzzleModal, setPuzzleModal] = useState<{ open: boolean; type: string; config?: any }>({ open: false, type: "info", config: {} });

  const clearPickupTimer = useCallback(() => {
    if (pickupAnimTimerRef.current !== null) {
      window.clearTimeout(pickupAnimTimerRef.current);
      pickupAnimTimerRef.current = null;
    }
  }, []);

  // Procedural SFX via Web Audio API — no external files needed
  const playBuiltinSfx = useCallback((kind: 'error' | 'pickup' | 'inventory') => {
    if (!soundEnabledRef.current) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)() as AudioContext;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      if (kind === 'error') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.25);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now); osc.stop(now + 0.3);
      } else if (kind === 'pickup') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
      } else {
        // inventory
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, now);
        osc.frequency.exponentialRampToValueAtTime(990, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now); osc.stop(now + 0.15);
      }
      osc.onended = () => { ctx.close().catch(() => {}); };
    } catch { /* ignore */ }
  }, []);

  const triggerSceneShake = useCallback(() => {
    playBuiltinSfx('error');
    setSceneShake(true);
    if (sceneShakeTimerRef.current) clearTimeout(sceneShakeTimerRef.current);
    sceneShakeTimerRef.current = setTimeout(() => {
      setSceneShake(false);
      sceneShakeTimerRef.current = null;
    }, 500);
  }, [playBuiltinSfx]);

  /** Show a "-Xs" penalty toast for 2.5 seconds and, if provided, update the run expiry. */
  const showPenaltyToast = useCallback((penaltySecs: number, newExpiry?: string | null) => {
    if (penaltySecs <= 0) return;
    if (newExpiry) setRunExpiresAt(newExpiry);
    setPenaltyToast(`-${penaltySecs}s`);
    if (penaltyToastTimerRef.current) clearTimeout(penaltyToastTimerRef.current);
    penaltyToastTimerRef.current = setTimeout(() => {
      setPenaltyToast(null);
      penaltyToastTimerRef.current = null;
    }, 2500);
  }, []);

  /**
   * Called when the player solves a mini-puzzle.
   * Fires the same `action:"trigger"` pipeline as clicking a trigger hotspot,
   * which runs useEffect (grant items, advance stage, etc.) on the server.
   */
  const handleMiniPuzzleSolve = useCallback(async (hotspotId: string) => {
    const r = await fetch(`/api/puzzles/escape-room/${puzzleId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'trigger', hotspotId, ...sessionBody }),
    });
    const jb = await r.json().catch(() => null);
    setMiniPuzzleState(null);
    if (r.ok) {
      playSfx(jb?.sfx);
    }
    // stage advancement comes via socket as usual
  }, [puzzleId, sessionBody, playSfx]);

  useEffect(() => {
    return () => {
      clearPickupTimer();
    };
  }, [clearPickupTimer]);

  const handleHotspotAction = useCallback(async (hotspotId: string) => {
    // Fast synchronous guards — no async, safe before locking
    if (!sessionId) return;
    if (!runStartedAt) return;
    if (failedAt || completedAt) return;
    if (pendingPickup) return;
    if (actionInFlightRef.current) return;
    // Per-hotspot 600 ms cooldown prevents double-tap spam
    const now = Date.now();
    const lastClick = hotspotCooldownRef.current.get(hotspotId) ?? 0;
    if (now - lastClick < 600) return;
    hotspotCooldownRef.current.set(hotspotId, now);

    actionInFlightRef.current = true;
    setIsActionInFlight(true);
    try {
      // find hotspot in current layout
      const curLayout = layout as any;
      const hs = curLayout?.hotspots?.find((h: any) => h.id === hotspotId);
      let hsMeta: any = {};
      if (hs && hs.meta) {
        try { hsMeta = typeof hs.meta === 'string' ? JSON.parse(hs.meta) : hs.meta; } catch { hsMeta = hs.meta; }
      }

      const actionType = hs?.type || (hsMeta && hsMeta.actionType) || 'collect';
      const hotspotLabel = (typeof hsMeta?.label === 'string' && hsMeta.label.trim()) ? hsMeta.label.trim() : 'here';

      // Click-to-use: if an inventory item is selected, and the hotspot looks like it supports "use",
      // attempt a server-side use first.
      if (selectedInventoryKey) {
        const requiresItems = Array.isArray(hsMeta?.requiresItems) && hsMeta.requiresItems.length > 0;
        const hasRequiredKey = typeof hsMeta?.requiredItemKey === 'string' && hsMeta.requiredItemKey;
        const hasRequiredId = typeof hsMeta?.requiredItemId === 'string' && hsMeta.requiredItemId;
        const hasUseEffect = !!hsMeta?.useEffect;
        const canUseOnCollect = hasUseEffect || requiresItems || hasRequiredKey || hasRequiredId;
        const shouldAttemptUse = actionType === 'collect'
          ? canUseOnCollect
          : actionType === 'navigate'
          ? canUseOnCollect
          : actionType !== 'modal' && actionType !== 'codeEntry' && actionType !== 'miniPuzzle';

        if (shouldAttemptUse) {
          const r = await fetch(`/api/puzzles/escape-room/${puzzleId}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'use', hotspotId, ...sessionBody, itemKey: selectedInventoryKey }),
          });
          const jb = await r.json().catch(() => null);
          if (r.ok) {
            playSfx(jb?.sfx);
            playSfx(jb?.sfxLoot);
            if (Array.isArray(jb?.inventory)) setInventory(jb.inventory);
            if (jb?.inventoryItems) setInventoryItems(jb.inventoryItems || {});
            if (jb?.sceneState) setSceneState(jb.sceneState || {});

            const usedName = inventoryItems?.[selectedInventoryKey]?.name || selectedInventoryKey;
            const grantedKeys: string[] = Array.isArray(jb?.granted?.keys) ? jb.granted.keys.filter((x: any) => typeof x === 'string') : [];
            const grantedNames = grantedKeys
              .map((k) => {
                const it = jb?.inventoryItems?.[k];
                return (it && typeof it.name === 'string' && it.name.trim()) ? it.name.trim() : k;
              })
              .filter(Boolean);
            const grantedLine = grantedNames.length > 0 ? `\n\nReceived: ${grantedNames.join(', ')}` : '';

            setActionModalTitle(hotspotLabel === 'here' ? 'Used item' : hotspotLabel);
            setActionModalMessage(`Used ${usedName} on ${hotspotLabel}.${grantedLine}`);
            setActionModalOpen(true);

            const nextInventory: string[] = Array.isArray(jb?.inventory) ? jb.inventory : inventory;
            const stillHaveItem = Array.isArray(nextInventory) && nextInventory.includes(selectedInventoryKey);
            if (!stillHaveItem) {
              // If the item was consumed, clear selection (and release lock if held by me).
              const lock = inventoryLocks?.[selectedInventoryKey];
              const lockedByMe = !!lock && !!currentUserId && lock.lockedBy === currentUserId;
              setSelectedInventoryKey(null);
              if (lockedByMe) void releaseLock(selectedInventoryKey);
            }
            return;
          }
          triggerSceneShake();
          if (jb?.penaltyApplied > 0) showPenaltyToast(jb.penaltyApplied, jb?.newRunExpiresAt);
          setActionModalTitle('Unable to use item');
          setActionModalMessage(jb?.error || 'Please try again.');
          setActionModalOpen(true);
          return;
        }
      }
      if (actionType === 'modal') {
        // show modal using meta.modalContent or label
        const baseTitle = hsMeta?.label || 'Info';
        const baseMessage = hsMeta?.modalContent || hsMeta?.message || '';

        // Resolve associated item (for image + description)
        const assocItemId =
          (typeof hsMeta?.itemId === 'string' && hsMeta.itemId) ||
          (typeof hsMeta?.itemKey === 'string' && hsMeta.itemKey) ||
          (typeof hs?.targetId === 'string' && hs.targetId) ||
          null;
        const layoutItems = Array.isArray((curLayout as any)?.items) ? ((curLayout as any).items as any[]) : [];
        const assocItem = assocItemId ? layoutItems.find((it) => String(it?.id) === String(assocItemId)) : null;

        setActionModalTitle(baseTitle);
        setActionModalImageUrl(
          (typeof hsMeta?.imageUrl === 'string' && hsMeta.imageUrl) ||
            (typeof assocItem?.imageUrl === 'string' && assocItem.imageUrl) ||
            null
        );
        setActionModalDescription(
          (typeof hsMeta?.description === 'string' && hsMeta.description) ||
            (typeof assocItem?.description === 'string' && assocItem.description) ||
            undefined
        );

        // Optional: multiple interaction choices for a single item/zone
        const extra = Array.isArray(hsMeta?.interactions)
          ? (hsMeta.interactions as any[])
              .map((x) => ({ label: x?.label, modalContent: x?.modalContent, imageUrl: typeof x?.imageUrl === 'string' ? x.imageUrl : undefined }))
              .filter((x) => typeof x.label === 'string' && typeof x.modalContent === 'string')
          : [];
        const baseImageUrl =
          (typeof hsMeta?.imageUrl === 'string' && hsMeta.imageUrl) ||
            (typeof assocItem?.imageUrl === 'string' && assocItem.imageUrl) ||
            undefined;
        const choices = [{ label: 'Inspect', modalContent: baseMessage, imageUrl: baseImageUrl }, ...extra];

        setActionModalChoices(choices.length > 1 ? choices : null);
        setActionModalChoiceIndex(0);
        setActionModalMessage(baseMessage);
        setActionModalOpen(true);
        return;
      }

      if (actionType === 'miniPuzzle') {
        const mp = hsMeta?.miniPuzzle;
        const puzzleType: MiniPuzzleType = (mp?.type === 'wire' || mp?.type === 'dial') ? mp.type : 'keypad';
        setMiniPuzzleState({
          open: true,
          puzzleType,
          config: mp?.config || {},
          hotspotId,
          label: hotspotLabel,
        });
        return;
      }

      if (actionType === 'trigger' || actionType === 'navigate') {
        const r = await fetch(`/api/puzzles/escape-room/${puzzleId}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'trigger', hotspotId, ...sessionBody }),
        });
        const jb = await r.json().catch(() => null);
        if (!r.ok) {
          triggerSceneShake();
          if (jb?.penaltyApplied > 0) showPenaltyToast(jb.penaltyApplied, jb?.newRunExpiresAt);
          setActionModalTitle(hsMeta?.label || (actionType === 'navigate' ? 'Cannot Move' : 'Locked'));
          setActionModalMessage(jb?.error || (actionType === 'navigate' ? 'Unable to move to that scene.' : 'Unable to open.'));
          setActionModalOpen(true);
          return;
        }
        playSfx(jb?.sfx);
        // stageIndex + completedAt will be updated via socket payload (and/or jb)
        return;
      }

      if (actionType === 'triggerItemAnimation') {
        // Play the item's animation video in-place without opening any popup.
        const assocItemId =
          (typeof hsMeta?.itemId === 'string' && hsMeta.itemId) ||
          (typeof hs?.targetId === 'string' && hs.targetId) ||
          null;
        if (assocItemId) {
          setTriggeredItemIds(prev => new Set([...prev, assocItemId]));
        }
        return;
      }

      // default: preview pickup animation first; commit to inventory only on explicit confirmation
      const r = await fetch(`/api/puzzles/escape-room/${puzzleId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pickupPreview', hotspotId, ...sessionBody }),
      });
      const jb = await r.json().catch(() => null);
      playSfx(jb?.sfx);
      if (!r.ok) {
        triggerSceneShake();
        setActionModalTitle(hsMeta?.label || 'Unable to pick up');
        setActionModalMessage(jb?.error || 'Please try again.');
        setActionModalOpen(true);
        return;
      }

      const preview = jb?.preview && typeof jb.preview === 'object' ? jb.preview : null;
      if (!preview?.id || !preview?.key || !preview?.name) {
        setActionModalTitle(hsMeta?.label || 'Unable to pick up');
        setActionModalMessage('No pickup item was found for this interaction.');
        setActionModalOpen(true);
        return;
      }

      clearPickupTimer();
      setPickupFlight(null);
      playBuiltinSfx('pickup');
      setPickupPhase('reveal');

      // Resolve sprite state image if the zone's useEffect sets one for the collected item
      let pickupImageUrl: string | null = typeof preview.imageUrl === 'string' ? preview.imageUrl : null;
      if (hsMeta?.useEffect?.setItemStateById && typeof hsMeta.useEffect.setItemStateById === 'object') {
        // Extract designer item ID from the item key (format: item_<escapeRoomId>_<designerItemId>)
        const keyParts = String(preview.key || '').split('_');
        const designerItemId = keyParts.length >= 3 ? keyParts[keyParts.length - 1] : '';
        if (designerItemId) {
          const stateKey = hsMeta.useEffect.setItemStateById[designerItemId];
          if (typeof stateKey === 'string' && stateKey.trim()) {
            const layoutItems = Array.isArray((curLayout as any)?.items) ? ((curLayout as any).items as any[]) : [];
            const layoutItem = layoutItems.find((it: any) => String(it?.id) === designerItemId);
            const spriteStates = layoutItem?.properties?.spriteStates;
            if (spriteStates && typeof spriteStates === 'object') {
              const stateImage = spriteStates[stateKey];
              if (typeof stateImage === 'string' && stateImage.trim()) {
                pickupImageUrl = stateImage;
              }
            }
          }
        }
      }

      setPendingPickup({
        hotspotId,
        itemId: String(preview.id),
        itemKey: String(preview.key),
        itemName: String(preview.name),
        imageUrl: pickupImageUrl,
        label: hotspotLabel === 'here' ? String(preview.name) : hotspotLabel,
        animationPreset: ['cinematic','quickSpin','floatIn','powerDrop','spiral','bounce','glitch','flash'].includes(preview?.pickupAnimationPreset)
          ? preview.pickupAnimationPreset
          : 'cinematic',
        pickupAnimationUrl: typeof preview.pickupAnimationUrl === 'string' && preview.pickupAnimationUrl ? preview.pickupAnimationUrl : undefined,
      });
      pickupAnimTimerRef.current = window.setTimeout(() => {
        setPickupPhase('ready');
        pickupAnimTimerRef.current = null;
      }, (() => {
        // Match timer to each preset's actual CSS animation duration + small buffer
        const presetMs: Record<string, number> = {
          cinematic: 1000,
          quickSpin: 670,
          floatIn: 950,
          powerDrop: 910,
          spiral: 800,
          bounce: 870,
          glitch: 600,
          flash: 700,
        };
        const preset = ['cinematic','quickSpin','floatIn','powerDrop','spiral','bounce','glitch','flash'].includes(preview?.pickupAnimationPreset)
          ? preview.pickupAnimationPreset : 'cinematic';
        return presetMs[preset] ?? 1000;
      })());
    } catch (e) {
      console.error('Hotspot action failed', e);
    } finally {
      actionInFlightRef.current = false;
      setIsActionInFlight(false);
    }
  }, [sessionId, sessionBody, runStartedAt, failedAt, completedAt, pendingPickup, layout, puzzleId, playSfx, playBuiltinSfx, selectedInventoryKey, inventory, inventoryItems, inventoryLocks, currentUserId, clearPickupTimer, triggerSceneShake, showPenaltyToast, handleMiniPuzzleSolve]);

  const handleActionModalChoice = useCallback((index: number) => {
    if (!actionModalChoices || actionModalChoices.length === 0) return;
    const idx = Math.max(0, Math.min(index, actionModalChoices.length - 1));
    setActionModalChoiceIndex(idx);
    setActionModalMessage(actionModalChoices[idx]?.modalContent || '');
    // Update the modal image/video when switching interaction choices
    const choiceImg = (actionModalChoices[idx] as any)?.imageUrl;
    if (typeof choiceImg === 'string' && choiceImg) {
      setActionModalImageUrl(choiceImg);
    }
  }, [actionModalChoices]);

  const dismissPendingPickup = useCallback(() => {
    clearPickupTimer();
    setPendingPickup(null);
    setPickupFlight(null);
    setPickupPhase('reveal');
  }, [clearPickupTimer]);

  const confirmPendingPickup = useCallback(async () => {
    if (!pendingPickup) return;
    if (!sessionId) return;
    try {
      setPickupPhase('committing');
      const r = await fetch(`/api/puzzles/escape-room/${puzzleId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pickup', hotspotId: pendingPickup.hotspotId, ...sessionBody }),
      });
      const jb = await r.json().catch(() => null);
      playSfx(jb?.sfx);

      if (!r.ok) {
        dismissPendingPickup();
        setActionModalTitle(pendingPickup.label || 'Unable to pick up');
        setActionModalMessage(jb?.error || 'Please try again.');
        setActionModalOpen(true);
        return;
      }

      if (Array.isArray(jb?.inventory)) setInventory(jb.inventory || []);
      if (jb?.inventoryItems) {
        const items = { ...jb.inventoryItems };
        // Override the picked-up item's imageUrl with the sprite-state-resolved image
        if (pendingPickup.imageUrl && pendingPickup.itemKey && items[pendingPickup.itemKey]) {
          items[pendingPickup.itemKey] = { ...items[pendingPickup.itemKey], imageUrl: pendingPickup.imageUrl };
        }
        setInventoryItems(items);
      }

      setSideTab('inventory');
      setDrawerTab('inventory');
      setDrawerOpen(true);
      playBuiltinSfx('inventory');
      setInventoryPulse(true);

      const startX = window.innerWidth * 0.5;
      const startY = window.innerHeight * 0.52;
      const invRect = inventoryPanelRef.current?.getBoundingClientRect();
      const targetX = invRect ? invRect.left + Math.min(90, invRect.width * 0.28) : window.innerWidth - 220;
      const targetY = invRect ? invRect.top + 100 : window.innerHeight - 220;

      setPickupFlight({
        dx: targetX - startX,
        dy: targetY - startY,
        scale: 0.34,
      });
      setPickupPhase('toInventory');

      clearPickupTimer();
      pickupAnimTimerRef.current = window.setTimeout(() => {
        setInventoryPulse(false);
        dismissPendingPickup();
        pickupAnimTimerRef.current = null;
      }, 780);
    } catch {
      dismissPendingPickup();
      setActionModalTitle(pendingPickup.label || 'Unable to pick up');
      setActionModalMessage('Please try again.');
      setActionModalOpen(true);
    }
  }, [pendingPickup, sessionId, puzzleId, playSfx, dismissPendingPickup, clearPickupTimer]);

  const canInteract = !!runStartedAt && !failedAt && !completedAt && !clientTimedOut && !pendingPickup;

  const pickupRevealClass = pendingPickup
    ? pendingPickup.animationPreset === 'quickSpin' ? 'pickup-reveal-quick-spin'
      : pendingPickup.animationPreset === 'floatIn' ? 'pickup-reveal-float-in'
      : pendingPickup.animationPreset === 'powerDrop' ? 'pickup-reveal-power-drop'
      : pendingPickup.animationPreset === 'spiral' ? 'pickup-reveal-spiral'
      : pendingPickup.animationPreset === 'bounce' ? 'pickup-reveal-bounce'
      : pendingPickup.animationPreset === 'glitch' ? 'pickup-reveal-glitch'
      : pendingPickup.animationPreset === 'flash' ? 'pickup-reveal-flash'
      : 'pickup-cinematic-reveal'
    : '';

  const pickupToInventoryClass = pendingPickup
    ? pendingPickup.animationPreset === 'quickSpin' ? 'pickup-to-inventory-quick-spin'
      : pendingPickup.animationPreset === 'floatIn' ? 'pickup-to-inventory-float-in'
      : pendingPickup.animationPreset === 'powerDrop' ? 'pickup-to-inventory-power-drop'
      : pendingPickup.animationPreset === 'spiral' ? 'pickup-to-inventory-spiral'
      : pendingPickup.animationPreset === 'bounce' ? 'pickup-to-inventory-bounce'
      : pendingPickup.animationPreset === 'glitch' ? 'pickup-to-inventory-glitch'
      : pendingPickup.animationPreset === 'flash' ? 'pickup-to-inventory-flash'
      : 'pickup-cinematic-to-inventory'
    : '';

  const resolveHotspotAtClientPoint = useCallback(
    (clientX: number, clientY: number) => {
      const el = stageDropRef.current;
      if (!el) return null as string | null;

      const rect = el.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      if (localX < 0 || localY < 0 || localX > rect.width || localY > rect.height) return null;

      const PREVIEW_W = 600;
      const PREVIEW_H = 320;

      const effW = effectiveLayoutSize?.w || (layout as any)?.width || PREVIEW_W;
      const effH = effectiveLayoutSize?.h || (layout as any)?.height || PREVIEW_H;
      const safeW = Math.max(1, Number(effW) || PREVIEW_W);
      const safeH = Math.max(1, Number(effH) || PREVIEW_H);
      const targetW = Math.max(1, rect.width);
      const targetH = Math.max(1, rect.height);

      // Player fit mode is contain.
      const scale = Math.min(targetW / safeW, targetH / safeH);
      const offsetX = (targetW - safeW * scale) / 2;
      const offsetY = (targetH - safeH * scale) / 2;

      const lx = (localX - offsetX) / (scale || 1);
      const ly = (localY - offsetY) / (scale || 1);
      if (!Number.isFinite(lx) || !Number.isFinite(ly)) return null;

      const hsRaw = Array.isArray((layout as any)?.hotspots) ? ((layout as any).hotspots as any[]) : [];
      if (hsRaw.length === 0) return null;

      const hotspotsLikelyPreviewCoords = (hsList: any[], layoutW: number, layoutH: number) => {
        try {
          if (!Array.isArray(hsList) || hsList.length === 0) return false;
          let maxX = 0;
          let maxY = 0;
          for (const hs of hsList) {
            const x = Number(hs?.x) || 0;
            const y = Number(hs?.y) || 0;
            const w = Number(hs?.w) || 0;
            const h = Number(hs?.h) || 0;
            maxX = Math.max(maxX, x + w);
            maxY = Math.max(maxY, y + h);
          }
          const withinPreview = maxX <= PREVIEW_W + 2 && maxY <= PREVIEW_H + 2;
          const layoutBiggerThanPreview = layoutW > PREVIEW_W + 2 || layoutH > PREVIEW_H + 2;
          return withinPreview && layoutBiggerThanPreview;
        } catch {
          return false;
        }
      };

      const normalizeHotspotsToLayout = (hsList: any[], layoutW: number, layoutH: number) => {
        if (!Array.isArray(hsList) || hsList.length === 0) return [] as any[];
        if (!hotspotsLikelyPreviewCoords(hsList, layoutW, layoutH)) return hsList;

        const scalePreview = Math.max(PREVIEW_W / layoutW, PREVIEW_H / layoutH);
        const offsetPreviewX = (PREVIEW_W - layoutW * scalePreview) / 2;
        const offsetPreviewY = (PREVIEW_H - layoutH * scalePreview) / 2;

        return hsList.map((hs: any) => {
          const x = ((Number(hs?.x) || 0) - offsetPreviewX) / (scalePreview || 1);
          const y = ((Number(hs?.y) || 0) - offsetPreviewY) / (scalePreview || 1);
          const w = (Number(hs?.w) || 0) / (scalePreview || 1);
          const h = (Number(hs?.h) || 0) / (scalePreview || 1);
          return { ...hs, x, y, w, h };
        });
      };

      const hsNorm = normalizeHotspotsToLayout(hsRaw, safeW, safeH);
      for (const hs of hsNorm) {
        const x = Number(hs?.x) || 0;
        const y = Number(hs?.y) || 0;
        const w = Number(hs?.w) || 0;
        const h = Number(hs?.h) || 0;
        if (lx >= x && lx <= x + w && ly >= y && ly <= y + h) {
          return typeof hs?.id === "string" ? (hs.id as string) : null;
        }
      }
      return null;
    },
    [effectiveLayoutSize, layout]
  );

  const onHotspotAction = useCallback(
    async (hotspotId: string) => {
      if (!canInteract) return;
      await handleHotspotAction(hotspotId);
    },
    [canInteract, handleHotspotAction]
  );

  const renderFullscreenOverlay = useCallback(
    (overlay: React.ReactNode) => {
      if (!overlay) return null;
      const target = fullscreenOverlayPortalRef.current || playAreaHostRef.current;
      if (isNativeFullscreen && target) {
        return createPortal(overlay, target);
      }
      return overlay;
    },
    [isNativeFullscreen]
  );

  if (loading) return <div className="text-gray-300">Loading escape room…</div>;
  if (error) return <div className="text-red-300">{error}</div>;
  if (!data || !stage) return <div className="text-gray-300">Unable to load escape room stages.</div>;

  const ackCount = Object.keys(briefingAcks || {}).length;
  const allAcked = ackCount >= (data?.minTeamSize ?? minTeamSizeRef.current ?? 1);
  const showRunTimer = !!(runStartedAt && runExpiresAt && !failedAt && !completedAt);

  const fmtRemaining = (ms: number | null) => {
    if (ms === null) return null;
    const safe = Math.max(0, ms);
    const totalSeconds = Math.floor(safe / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const ackBriefing = async () => {
    if (!sessionId) return;
    try {
      setSessionBusy(true);
      const r = await fetch(`/api/puzzles/escape-room/${puzzleId}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ackBriefing', ...sessionBody }),
      });
      const jb = await r.json().catch(() => null);
      if (r.ok && jb?.briefingAcks) setBriefingAcks(jb.briefingAcks || {});
      if (!r.ok) {
        setActionModalTitle('Unable to acknowledge');
        setActionModalMessage(jb?.error || 'Please try again.');
        setActionModalOpen(true);
      }
    } finally {
      setSessionBusy(false);
    }
  };

  const startRun = async () => {
    if (!sessionId) return;
    try {
      setSessionBusy(true);
      const r = await fetch(`/api/puzzles/escape-room/${puzzleId}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'startRun', ...sessionBody }),
      });
      const jb = await r.json().catch(() => null);
      if (r.ok) {
        setRunStartedAt(jb?.runStartedAt ? String(jb.runStartedAt) : runStartedAt);
        setRunExpiresAt(jb?.runExpiresAt ? String(jb.runExpiresAt) : runExpiresAt);
      } else {
        setActionModalTitle('Cannot start yet');
        setActionModalMessage(jb?.error || 'Please try again.');
        setActionModalOpen(true);
      }
    } finally {
      setSessionBusy(false);
    }
  };

  const acquireLock = async (itemKey: string) => {
    if (!sessionId) return false;
    try {
      setSessionBusy(true);
      const r = await fetch(`/api/puzzles/escape-room/${puzzleId}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'acquireLock', ...sessionBody, itemKey }),
      });
      const jb = await r.json().catch(() => null);
      if (r.ok && jb?.inventoryLocks) {
        setInventoryLocks(jb.inventoryLocks || {});
        return true;
      } else if (r.status === 409 && jb?.lock) {
        setActionModalTitle('Item in use');
        setActionModalMessage(`This item is being used by ${jb.lock.lockedByName || 'a teammate'}.`);
        setActionModalOpen(true);
        return false;
      } else if (!r.ok) {
        setActionModalTitle('Unable to use item');
        setActionModalMessage(jb?.error || 'Please try again.');
        setActionModalOpen(true);
        return false;
      }
      return false;
    } finally {
      setSessionBusy(false);
    }
  };

  const releaseLock = async (itemKey: string) => {
    if (!sessionId) return;
    try {
      setSessionBusy(true);
      const r = await fetch(`/api/puzzles/escape-room/${puzzleId}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'releaseLock', ...sessionBody, itemKey }),
      });
      const jb = await r.json().catch(() => null);
      if (r.ok && jb?.inventoryLocks) setInventoryLocks(jb.inventoryLocks || {});
    } finally {
      setSessionBusy(false);
    }
  };

  // Example handler to open modal (to be called from hotspot/item logic)
  const openPuzzleModal = (type: string, config?: any) => {
    setPuzzleModal({ open: true, type, config });
  };

  // Handler to update the background image (stub implementation)
  const updateBackgroundImage = (newUrl: string) => {
    // Example: update the layout backgroundUrl if needed
    // This is a stub; implement logic as needed for your app
    // setData or setSceneState can be used to update the background
    // For now, just log for demonstration
    console.log("updateBackgroundImage called with:", newUrl);
  };

  return (
    <div className="rounded-xl border border-amber-900/30 bg-neutral-950/85 p-4 relative escape-room-player">
      {/* ── Room Intro overlay (shown once per session before the briefing) ── */}
      {(() => {
        const intro = data?.puzzle?.intro;
        const hasIntro = !!(intro && (intro.videoUrl || intro.posterUrl || intro.title || intro.bodyText));
        if (!hasIntro || introWatched || runStartedAt || failedAt || completedAt) return null;
        return (
          <RoomIntroPlayer
            intro={intro!}
            onComplete={() => setIntroWatched(true)}
          />
        );
      })()}

      {/* ── Room Outro overlay (shown once when the run is freshly completed) ── */}
      {outroActive && data?.puzzle?.outro && (
        <RoomIntroPlayer
          intro={data.puzzle.outro}
          completeLabel="🏆 Leave the Room"
          onComplete={() => {
            setOutroActive(false);
            onComplete?.();
          }}
        />
      )}

      {renderFullscreenOverlay(
        timeExpiredModalOpen ? (
          <div className="fixed inset-0 z-[140] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/70" />
            <div className="relative w-full max-w-xl mx-4 rounded-lg shadow-xl overflow-hidden border border-red-800/60">
              <div className="bg-red-700 px-6 py-4">
                <h3 className="text-white text-lg font-semibold">Time’s up</h3>
              </div>
              <div className="bg-slate-950 p-6">
                <p className="text-slate-200 mb-4">
                  The last grains of sand slip through the hourglass. The lights flicker, the locks reset, and the room seals itself once more.
                </p>
                <p className="text-slate-300 mb-6">
                  This run has ended due to the time limit.
                  {isSoloSession
                    ? ' You can start a fresh run from this case page when you are ready to try again.'
                    : ' You can start a fresh run from the lobby when you are ready to try again.'}
                </p>
                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={exitToDashboard}
                    className="px-4 py-2 rounded bg-slate-700 text-white hover:opacity-90"
                  >
                    Dashboard
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null
      )}

      {isPaused && lobbyId ? (
        <div className="mb-3 rounded-lg border border-amber-700/60 bg-amber-950/30 p-5 text-amber-100 shadow-[0_0_30px_rgba(180,120,0,0.2)] space-y-3">
          <div className="font-semibold tracking-wide uppercase text-xs text-amber-400/80">Session Paused</div>
          <p className="text-sm leading-relaxed opacity-80">Your game was paused. To resume with the timer restored, go back to the lobby and click <strong>Resume Game</strong>.</p>
          <a
            href={`/escape-rooms/${puzzleId}/lobby`}
            className="inline-block px-4 py-2 rounded-lg bg-amber-700/60 hover:bg-amber-600/70 text-amber-50 text-sm font-semibold transition"
          >
            ← Back to Lobby
          </a>
        </div>
      ) : null}

      {failedAt ? (
        <div className="mb-3 rounded-lg border border-red-700/50 bg-red-950/25 p-4 text-red-200 shadow-[0_0_30px_rgba(180,0,0,0.18)]">
          <div className="font-semibold tracking-wide uppercase text-xs text-red-400/80 mb-1">Run Failed</div>
          <div className="text-sm leading-relaxed opacity-80">{failedReason || (isSoloSession ? 'The run ended. You can restart this case from the puzzle page.' : 'The run ended. You can restart this escape room from the lobby.')}</div>
        </div>
      ) : null}

      {completedAt ? (
        <div className="mb-3 rounded-lg border border-emerald-700/50 bg-emerald-950/20 p-4 text-emerald-200 shadow-[0_0_30px_rgba(0,160,80,0.15)]">
          <div className="font-semibold tracking-wide uppercase text-xs text-emerald-400/80 mb-1">Run Complete</div>
          <div className="text-sm leading-relaxed opacity-80">Well done — this run is finished.</div>
        </div>
      ) : null}

      {showRunTimer ? (
        <div className={`mb-3 flex items-center justify-between rounded-lg px-4 py-2.5 ${(timeRemainingMs ?? 0) <= 60_000 ? 'escape-timer-critical' : 'escape-timer-running'}`}>
          <div className="text-xs uppercase tracking-widest text-amber-300/60 font-medium">⧗ Timer</div>
          <div className={`font-mono text-base font-bold tracking-wider ${ (timeRemainingMs ?? 0) <= 30_000 ? 'text-red-300 escape-timer-text-pulse' : (timeRemainingMs ?? 0) <= 60_000 ? 'text-amber-400' : 'text-amber-100'}`}>
            {fmtRemaining(timeRemainingMs)}
          </div>
        </div>
      ) : null}

      {!runStartedAt && !failedAt && !completedAt ? (
        <div className="mb-3 rounded-lg border border-amber-800/35 bg-neutral-950/55 p-4">
          <div className="text-amber-200/90 font-semibold text-xs uppercase tracking-widest mb-2">Mission Briefing</div>
          <div className="text-amber-100/65 text-sm leading-relaxed mt-1">{data.puzzle?.description || 'Read the briefing carefully, then acknowledge when ready.'}</div>
          <div className="mt-2 text-xs text-amber-200/45">Acknowledged: {ackCount}/{data?.minTeamSize ?? minTeamSizeRef.current ?? 1}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={sessionBusy}
              onClick={ackBriefing}
              className="px-3 py-2 rounded-lg bg-amber-800/60 border border-amber-600/40 text-amber-50 hover:bg-amber-700/70 disabled:opacity-50 text-sm"
            >
              I understand
            </button>
            {isLeader ? (
              <button
                type="button"
                disabled={sessionBusy || !allAcked}
                onClick={startRun}
                className="px-3 py-2 rounded-lg bg-amber-600/80 border border-amber-400/50 text-amber-50 hover:bg-amber-500/80 disabled:opacity-50 text-sm font-semibold shadow-[0_0_12px_rgba(251,191,36,0.2)]"
              >
                Begin
              </button>
            ) : (
              <div className="px-3 py-2 rounded-lg bg-neutral-950/60 border border-amber-800/30 text-amber-200/50 text-sm italic">
                Waiting for leader to begin…
              </div>
            )}
          </div>
        </div>
      ) : null}

      {data.stages && data.stages.length > 1 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {data.stages
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStageIndex(s.order)}
                className={
                  "rounded-lg px-3 py-1.5 text-sm border transition-all " +
                  (s.order === stageIndex
                    ? "bg-amber-800/50 border-amber-500/50 text-amber-50 shadow-[0_0_10px_rgba(251,191,36,0.18)]"
                    : "bg-neutral-950/50 border-amber-900/35 text-amber-200/70 hover:bg-amber-900/25 hover:text-amber-100")
                }
              >
                {s.title || `Stage ${s.order}`}
              </button>
            ))}
        </div>
      ) : null}

      <div className="mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-amber-500/40 text-xs select-none">▸</span>
          <div className="text-amber-100 font-semibold tracking-wide">{stage.title || `Stage ${stage.order}`}</div>
        </div>
        {stage.description && <div className="text-amber-200/50 text-sm mt-1 pl-4 leading-relaxed">{stage.description}</div>}
      </div>

      {hints.length > 0 && (
        <div className="mb-3 px-3 py-2 rounded-lg border border-amber-800/20 bg-neutral-950/40 text-sm text-amber-200/55 italic">
          <span className="text-amber-400/55 not-italic font-semibold text-xs uppercase tracking-wider">Hint </span>{hints.join(' • ')}
        </div>
      )}

      {/* Stage answer input removed — not used for these puzzles */}

      {layout ? (
        <div
          ref={playAreaHostRef}
          className={(isFullscreenView ? "fixed inset-0 z-[72] bg-neutral-950 overflow-hidden" : "mt-4") + " relative"}
        >
          <div className={isFullscreenView ? "h-full w-full" : ""}>
            <div className="relative h-full">
              <div className="flex justify-center" style={{ position: 'relative', height: isFullscreenView ? '100%' : undefined }}>
                <div
                  className={`bg-slate-950${sceneShake ? ' scene-shake' : ''}`}
                  ref={stageDropRef}
                  style={{
                    position: 'relative',
                    aspectRatio: shouldStretchFullscreenCanvas
                      ? undefined
                      : (stageAspect || `${(layout as any)?.width || 600} / ${(layout as any)?.height || 320}`),
                    overflow: 'hidden',
                    borderRadius: shouldStretchFullscreenCanvas ? 0 : 8,
                    cursor: isActionInFlight ? 'wait' : undefined,
                    height: isFullscreenView ? '100%' : canvasHeight,
                    maxHeight: isFullscreenView ? '100%' : canvasHeight,
                    width: shouldStretchFullscreenCanvas ? '100%' : 'auto',
                    maxWidth: '100%',
                  }}
                >
                  <React.Suspense fallback={<div className="text-gray-400">Loading room...</div>}>
                    <PixiRoom
                      puzzleId={puzzleId}
                      layout={layout}
                      hotspots={hotspots}
                      onHotspotAction={onHotspotAction}
                      onEffectiveLayoutSize={onEffectiveLayoutSize}
                      triggeredItemIds={triggeredItemIds}
                    />
                  </React.Suspense>

                  {/* Atmospheric vignette — dark edge framing around the scene */}
                  <div className="escape-vignette absolute inset-0 pointer-events-none" style={{ zIndex: 2, borderRadius: 'inherit' }} />

                  {/* Ambient item effect overlays — glowing auras positioned over items */}
                  {effectiveLayoutSize && (layout as any)?.items?.some((it: any) => it.ambientEffect && it.ambientEffect !== 'none') && (
                    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
                      {((layout as any).items as any[])
                        .filter((it: any) => it.ambientEffect && it.ambientEffect !== 'none')
                        .map((it: any) => (
                          <div
                            key={`ambient-${it.id}`}
                            className={`escape-ambient-${it.ambientEffect}`}
                            style={{
                              position: 'absolute',
                              left: `${(it.x / effectiveLayoutSize.w) * 100}%`,
                              top: `${(it.y / effectiveLayoutSize.h) * 100}%`,
                              width: `${((it.w || 48) / effectiveLayoutSize.w) * 100}%`,
                              height: `${((it.h || 48) / effectiveLayoutSize.h) * 100}%`,
                              borderRadius: 4,
                              transform: (() => {
                                const hasPt3D = it.perspectiveRotateX || it.perspectiveRotateY;
                                return [
                                  hasPt3D ? `perspective(${it.perspectiveDistance ?? 600}px)` : '',
                                  it.scale != null && it.scale !== 1 ? `scale(${it.scale})` : '',
                                  it.rotation ? `rotate(${it.rotation}deg)` : '',
                                  hasPt3D && it.perspectiveRotateX ? `rotateX(${it.perspectiveRotateX}deg)` : '',
                                  hasPt3D && it.perspectiveRotateY ? `rotateY(${it.perspectiveRotateY}deg)` : '',
                                  it.skewX ? `skewX(${it.skewX}deg)` : '',
                                  it.skewY ? `skewY(${it.skewY}deg)` : '',
                                ].filter(Boolean).join(' ') || undefined;
                              })(),
                              transformOrigin: it.transformOrigin || 'center center',
                            }}
                          />
                        ))}
                    </div>
                  )}

                  {(layout as any)?.foregroundUrl && (
                    isVideoUrl((layout as any).foregroundUrl)
                      ? (
                        <video
                          src={(layout as any).foregroundUrl}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="absolute inset-0 h-full w-full object-cover pointer-events-none"
                          style={{ zIndex: 6 }}
                        />
                      )
                      : (
                        <img
                          src={(layout as any).foregroundUrl}
                          alt="Scene foreground"
                          className="absolute inset-0 h-full w-full object-cover pointer-events-none"
                          style={{ zIndex: 6 }}
                        />
                      )
                  )}

                  {/* Scene transition overlay — fires when stageIndex changes */}
                  {sceneTransitionPhase === 'in' && (
                    <div
                      className={`absolute inset-0 pointer-events-none z-20 scene-transition-${sceneTransitionType}`}
                    />
                  )}
                </div>
              </div>

              {!isMobileFullscreen ? (
                <div className="absolute right-3 top-3 z-30 flex max-w-[85vw] flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="rounded-lg border border-amber-600/50 bg-neutral-950/85 px-2.5 py-1.5 text-[11px] font-semibold text-amber-100 hover:bg-neutral-900 sm:px-3 sm:py-2 sm:text-xs"
                  >
                    {isFullscreenView ? 'Exit Fullscreen' : 'Fullscreen'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openDrawer('inventory')}
                    className="rounded-lg border border-amber-700/45 bg-neutral-950/85 px-2.5 py-1.5 text-[11px] font-semibold text-amber-100 hover:bg-neutral-900 sm:px-3 sm:py-2 sm:text-xs"
                  >
                    Inventory
                  </button>
                  <button
                    type="button"
                    onClick={() => openDrawer('chat')}
                    className="rounded-lg border border-amber-700/45 bg-neutral-950/85 px-2.5 py-1.5 text-[11px] font-semibold text-amber-100 hover:bg-neutral-900 sm:px-3 sm:py-2 sm:text-xs"
                  >
                    Chat
                  </button>
                </div>
              ) : null}

              {isMobileFullscreen && !drawerOpen ? (
                <button
                  type="button"
                  onClick={() => openDrawer('inventory')}
                  className="absolute right-2 top-2 z-30 rounded-md border border-amber-700/45 bg-neutral-950/85 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-100 hover:bg-neutral-900"
                >
                  <span className="block leading-none">Menu</span>
                  {showRunTimer ? (
                    <span className={`mt-0.5 block normal-case tracking-normal font-mono text-[10px] ${
                      (timeRemainingMs ?? 0) <= 30_000
                        ? 'text-red-300'
                        : (timeRemainingMs ?? 0) <= 60_000
                          ? 'text-amber-400'
                          : 'text-amber-100'
                    }`}>
                      {fmtRemaining(timeRemainingMs)}
                    </span>
                  ) : null}
                </button>
              ) : null}
            </div>
          </div>

          {drawerOpen ? (
            <div className="fixed inset-0 z-[86]">
              <button
                type="button"
                onClick={closeDrawer}
                className="escape-drawer-backdrop absolute inset-0 bg-black/55 backdrop-blur-[1px]"
                aria-label="Close drawer"
              />

              <aside
                className="escape-side-drawer absolute right-0 top-0 h-full border-l border-amber-700/40 bg-neutral-950/96 shadow-[0_0_35px_rgba(0,0,0,0.8)]"
                style={{ width: drawerWidth, maxWidth: '94vw' }}
              >
                <div className="flex items-center justify-between border-b border-amber-700/30 px-3 py-3">
                  <div className="flex gap-2">
                    {isMobileFullscreen ? (
                      <button
                        type="button"
                        onClick={() => {
                          closeDrawer();
                          void toggleFullscreen();
                        }}
                        className="rounded px-3 py-2 text-xs font-semibold border bg-neutral-900/50 border-amber-700/30 text-amber-100/80 hover:bg-neutral-900/80"
                      >
                        Exit Fullscreen
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setDrawerTab('inventory')}
                      className={
                        'rounded px-3 py-2 text-xs font-semibold border ' +
                        (drawerTab === 'inventory'
                          ? 'bg-amber-700/35 border-amber-500/50 text-amber-50'
                          : 'bg-neutral-900/50 border-amber-700/30 text-amber-100/80 hover:bg-neutral-900/80')
                      }
                    >
                      Inventory
                    </button>
                    <button
                      type="button"
                      onClick={() => setDrawerTab('chat')}
                      className={
                        'rounded px-3 py-2 text-xs font-semibold border ' +
                        (drawerTab === 'chat'
                          ? 'bg-amber-700/35 border-amber-500/50 text-amber-50'
                          : 'bg-neutral-900/50 border-amber-700/30 text-amber-100/80 hover:bg-neutral-900/80')
                      }
                    >
                      Chat
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {showRunTimer ? (
                      <div className={`rounded border px-2 py-1 font-mono text-xs font-semibold tracking-wider ${
                        (timeRemainingMs ?? 0) <= 30_000
                          ? 'border-red-700/60 bg-red-950/35 text-red-200'
                          : (timeRemainingMs ?? 0) <= 60_000
                            ? 'border-amber-600/60 bg-amber-950/35 text-amber-300'
                            : 'border-amber-700/40 bg-neutral-900/60 text-amber-100'
                      }`}>
                        {fmtRemaining(timeRemainingMs)}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={closeDrawer}
                      className="rounded border border-amber-700/40 bg-neutral-900/60 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-neutral-900"
                    >
                      Close
                    </button>
                  </div>
                </div>

                <div className="h-[calc(100%-62px)] overflow-y-auto p-3">
                  {drawerTab === 'inventory' ? (
                    <div className="rounded-2xl bg-gradient-to-r from-amber-900 via-amber-700 to-amber-950 p-[3px]">
                      <div
                        ref={inventoryPanelRef}
                        className={
                          'rounded-[14px] bg-neutral-950/90 ring-1 ring-amber-500/20 border border-amber-900/40 p-3 ' +
                          (inventoryPulse ? 'pickup-inventory-pulse' : '')
                        }
                        style={{
                          maxHeight: isFullscreenView
                            ? 'calc(100dvh - 164px)'
                            : isPhoneViewport
                              ? 'calc(100dvh - 152px)'
                              : 'calc(100dvh - 188px)',
                          overflowY: 'auto',
                        }}
                      >
                        <div className="mb-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => setSideTab('inventory')}
                            className={
                              'flex-1 rounded px-3 py-2 text-sm border ' +
                              (sideTab === 'inventory'
                                ? 'bg-amber-700/30 border-amber-500/50 text-amber-50'
                                : 'bg-neutral-900/50 border-amber-700/30 text-amber-100/80 hover:bg-neutral-900/80')
                            }
                          >
                            Inventory
                          </button>
                          <button
                            type="button"
                            onClick={() => setSideTab('activity')}
                            className={
                              'flex-1 rounded px-3 py-2 text-sm border ' +
                              (sideTab === 'activity'
                                ? 'bg-amber-700/30 border-amber-500/50 text-amber-50'
                                : 'bg-neutral-900/50 border-amber-700/30 text-amber-100/80 hover:bg-neutral-900/80')
                            }
                          >
                            Activity
                          </button>
                        </div>

                        {sideTab === 'inventory' ? (
                          <>
                            <div className="text-sm text-amber-200/90 mb-2 font-semibold tracking-wide">Inventory</div>
                            {selectedInventoryKey ? (
                              <div className="mb-2 rounded border border-emerald-700/40 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-100/90">
                                Selected: <span className="font-semibold">{inventoryItems?.[selectedInventoryKey]?.name || selectedInventoryKey}</span>
                                <span className="opacity-80"> — click a hotspot to use it, or click the item again to deselect.</span>
                              </div>
                            ) : null}
                            {inventory.length === 0 ? (
                              <div className="text-sm text-amber-200/60">No items yet.</div>
                            ) : (
                              <div className="flex flex-col gap-2">
                                {inventory.map((key) => {
                                  const lock = inventoryLocks?.[key];
                                  const lockedByMe = !!lock && !!currentUserId && lock.lockedBy === currentUserId;
                                  const item = inventoryItems?.[key];
                                  const displayName = item?.name || key;
                                  const imageUrl = item?.imageUrl || null;
                                  const selected = selectedInventoryKey === key;
                                  return (
                                    <div
                                      key={key}
                                      onClick={() => {
                                        if (!canInteract) return;
                                        if (sessionBusy) return;
                                        if (lock && !lockedByMe) {
                                          setActionModalTitle('Item in use');
                                          setActionModalMessage(`This item is being used by ${lock.lockedByName || 'a teammate'}.`);
                                          setActionModalOpen(true);
                                          return;
                                        }

                                        if (selected) {
                                          setSelectedInventoryKey(null);
                                          if (lockedByMe) void releaseLock(key);
                                          return;
                                        }

                                        void (async () => {
                                          if (lock && lockedByMe) {
                                            setSelectedInventoryKey(key);
                                            return;
                                          }
                                          const ok = await acquireLock(key);
                                          if (ok) setSelectedInventoryKey(key);
                                        })();
                                      }}
                                      className={
                                        "rounded-lg border border-amber-800/30 bg-neutral-950/40 px-3 py-2 text-sm text-amber-50/90 " +
                                        (canInteract && !sessionBusy && (!lock || lockedByMe) ? "cursor-pointer" : "cursor-default") +
                                        (selected ? " ring-2 ring-emerald-500/60" : "")
                                      }
                                      title={selected ? 'Selected' : 'Click to select'}
                                    >
                                      <div className="flex items-center gap-2">
                                        {imageUrl ? (
                                          isVideoUrl(imageUrl) ? (
                                             
                                            <video src={imageUrl} autoPlay loop muted playsInline className="h-9 w-9 rounded object-contain bg-neutral-900/60 border border-amber-600/25" />
                                          ) : (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={imageUrl} alt={displayName} className="h-9 w-9 rounded object-contain bg-neutral-900/60 border border-amber-600/25" />
                                          )
                                        ) : (
                                          <div className="h-9 w-9 rounded bg-neutral-900/60 border border-amber-600/25" />
                                        )}
                                        <div className="min-w-0">
                                          <div className="font-semibold truncate">{displayName}</div>
                                          {lock ? (
                                            <div className="text-xs text-amber-100/70">In use by {lock.lockedByName || 'a teammate'}</div>
                                          ) : (
                                            <div className="text-xs text-amber-200/50">Available</div>
                                          )}
                                        </div>
                                      </div>

                                      <div className="mt-2 flex gap-2">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (item) setInspectingItem(item);
                                          }}
                                          className="px-2 py-1 rounded border border-amber-700/50 bg-neutral-900/60 text-amber-50/90 hover:bg-neutral-900/80"
                                        >
                                          View
                                        </button>
                                        <button
                                          type="button"
                                          disabled={!canInteract || sessionBusy || (!!lock && !lockedByMe)}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (selected) {
                                              setSelectedInventoryKey(null);
                                              if (lockedByMe) void releaseLock(key);
                                              return;
                                            }
                                            void (async () => {
                                              const ok = lock && lockedByMe ? true : await acquireLock(key);
                                              if (ok) setSelectedInventoryKey(key);
                                            })();
                                          }}
                                          className="px-2 py-1 rounded bg-amber-700 text-amber-50 hover:bg-amber-600 disabled:opacity-50"
                                        >
                                          {selected ? 'Selected' : 'Select'}
                                        </button>
                                        {lockedByMe || isLeader ? (
                                          <button
                                            type="button"
                                            disabled={!canInteract || sessionBusy || !lock}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (selected) setSelectedInventoryKey(null);
                                              void releaseLock(key);
                                            }}
                                            className="px-2 py-1 rounded border border-amber-700/50 bg-neutral-900/60 text-amber-50/90 hover:bg-neutral-900/80 disabled:opacity-50"
                                          >
                                            Release
                                          </button>
                                        ) : null}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="text-sm text-amber-200/90 mb-2 font-semibold tracking-wide">Team activity</div>
                            {activity.length === 0 ? (
                              <div className="text-sm text-amber-200/60">No activity yet.</div>
                            ) : (
                              <div className="flex flex-col gap-2">
                                {activity.map((a) => (
                                  <div key={a.id} className="rounded-lg border border-amber-800/25 bg-neutral-950/30 px-3 py-2">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="text-sm text-amber-50/90">
                                        <span className="text-amber-100/60">{a.actor?.name ? a.actor.name : 'Teammate'}:</span>{' '}
                                        <span className="font-semibold text-amber-50">{a.title}</span>
                                      </div>
                                      <div className="text-xs text-amber-200/40 whitespace-nowrap">{formatActivityTime(a.ts)}</div>
                                    </div>
                                    {a.meta?.label ? (
                                      <div className="mt-1 text-xs text-amber-200/45">{String(a.meta.label)}</div>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-gradient-to-r from-amber-900 via-amber-700 to-amber-950 p-[3px] h-full">
                      <div className="rounded-[14px] bg-neutral-950/90 ring-1 ring-amber-500/20 border border-amber-900/40 p-3 flex h-full min-h-[50dvh] sm:min-h-[55dvh] flex-col">
                        <div className="text-sm text-amber-200/90 mb-2 font-semibold tracking-wide">Team Chat</div>
                        <div className="flex-1 min-h-0 overflow-y-auto mb-3 space-y-3 rounded-lg bg-neutral-950/60 ring-1 ring-amber-500/15 p-2">
                          {chatMessages.length === 0 ? (
                            <div className="text-sm text-amber-200/60">No messages yet — say hello!</div>
                          ) : null}
                          {chatMessages.map((m, idx) => {
                            const senderLabel =
                              (m?.user?.name as string | undefined) ||
                              (m?.user?.email as string | undefined) ||
                              (m?.userId as string | undefined) ||
                              'Unknown';
                            const key = m?.id ?? `${m?.userId ?? 'u'}:${m?.createdAt ?? idx}:${idx}`;
                            return (
                              <div key={key} className="rounded-lg w-full px-1 py-1 border border-amber-800/25 bg-neutral-950/30">
                                <div className="px-3">
                                  <div className="text-sm text-amber-50/90">
                                    <strong className="text-amber-50">{senderLabel}</strong>{' '}
                                    <span className="text-xs text-amber-200/40">{m?.createdAt ? new Date(m.createdAt).toLocaleTimeString() : ''}</span>
                                  </div>
                                  <div className="text-sm text-amber-100/70 break-words mt-1">{m?.content}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void postChatMessage(chatInput);
                          }}
                          className="flex gap-2"
                        >
                          <input
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Type a message..."
                            className="flex-1 min-w-0 px-3 py-2 rounded bg-neutral-900/60 text-amber-50 placeholder:text-amber-200/40 border border-amber-700/40"
                          />
                          <button type="submit" className="px-4 py-2 rounded bg-amber-700 text-amber-50 hover:bg-amber-600">Send</button>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              </aside>
            </div>
          ) : null}

          <div ref={fullscreenOverlayPortalRef} />
        </div>
      ) : null}

      {renderFullscreenOverlay(
        inspectingItem ? (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-[2px]" onClick={() => setInspectingItem(null)}>
            <div
              className="relative w-full mx-3 sm:mx-4 rounded-2xl border border-amber-500/40 bg-neutral-950/95 shadow-2xl overflow-hidden"
              style={{ maxWidth: 'min(94vw, 900px)', maxHeight: 'min(92dvh, 960px)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 sm:px-6 pt-5 pb-2 text-center">
                <h3 className="text-2xl sm:text-3xl font-bold text-amber-50">{inspectingItem.name}</h3>
              </div>
              <div className="px-5 sm:px-6 pb-5 overflow-y-auto" style={{ maxHeight: 'calc(min(92dvh, 960px) - 94px)' }}>
                <div className="relative py-4 sm:py-6 flex items-center justify-center">
                  {inspectingItem.imageUrl ? (
                    isVideoUrl(inspectingItem.imageUrl) ? (
                      <video
                        src={inspectingItem.imageUrl}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full object-contain rounded-xl border border-amber-400/30 bg-neutral-900/80 p-3 shadow-[0_0_35px_rgba(251,191,36,0.25)]"
                        style={{ maxHeight: 'min(56dvh, 620px)' }}
                      />
                    ) : (
                      <img
                        src={inspectingItem.imageUrl}
                        alt={inspectingItem.name}
                        className="w-full object-contain rounded-xl border border-amber-400/30 bg-neutral-900/80 p-3 shadow-[0_0_35px_rgba(251,191,36,0.25)]"
                        style={{ maxHeight: 'min(56dvh, 620px)' }}
                      />
                    )
                  ) : (
                    <div className="h-48 w-48 rounded-lg border border-amber-500/25 bg-neutral-900/80 flex items-center justify-center text-amber-200/50 text-base">No image</div>
                  )}
                </div>
                <div className="pt-1 flex justify-center">
                  <button type="button" onClick={() => setInspectingItem(null)} className="px-5 py-2.5 rounded font-semibold text-white bg-amber-600 hover:bg-amber-500 text-sm sm:text-base">Close</button>
                </div>
              </div>
            </div>
          </div>
        ) : null
      )}

      {renderFullscreenOverlay(
        pendingPickup ? (
          /* Single fixed overlay used for ALL phases — reveal, video, and toInventory.
             Keeping everything in one container means the visual center never jumps. */
          <div className={`fixed inset-0 z-[145] flex flex-col ${
            pendingPickup.pickupAnimationUrl && (pickupPhase === 'ready' || pickupPhase === 'toInventory') ? '' : 'bg-black/65 backdrop-blur-[1px] items-center justify-center'
          }`}>
            {pendingPickup.pickupAnimationUrl && (pickupPhase === 'ready' || pickupPhase === 'toInventory') ? (
              /* Video phase — transparent background, video plays over the scene */
              <>
                {/* Title bar at top */}
                <div style={{ position: 'relative', zIndex: 4, padding: '20px 24px 12px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  {pendingPickup.imageUrl && !isVideoUrl(pendingPickup.imageUrl) && (
                    <img src={pendingPickup.imageUrl} alt="" aria-hidden style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'contain', border: '1px solid rgba(251,191,36,0.35)', background: 'rgba(0,0,0,0.4)' }} />
                  )}
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fef3c7', textShadow: '0 2px 8px rgba(0,0,0,0.8)', margin: 0 }}>You found <span style={{ color: '#fbbf24' }}>{pendingPickup.itemName}</span></h3>
                </div>
                {/* Video area */}
                <div style={{
                  flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                  transition: 'opacity 0.5s ease-out, transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                  ...(pickupPhase === 'toInventory' && pickupFlight ? {
                    opacity: 0,
                    transform: `translate(${pickupFlight.dx}px, ${pickupFlight.dy}px) scale(${pickupFlight.scale})`,
                  } : {}),
                }}>
                  <video
                    key={pendingPickup.itemId}
                    src={/^https?:\/\//i.test(pendingPickup.pickupAnimationUrl) ? `/api/image-proxy?url=${encodeURIComponent(pendingPickup.pickupAnimationUrl)}` : pendingPickup.pickupAnimationUrl}
                    autoPlay
                    muted
                    playsInline
                    style={{
                      maxHeight: '100%',
                      maxWidth: '90%',
                      objectFit: 'contain',
                      borderRadius: 16,
                      boxShadow: '0 8px 80px rgba(251,191,36,0.25), 0 2px 24px rgba(0,0,0,0.8)',
                      ...({
                        animation: 'pickupVideoFadeGrow 0.35s cubic-bezier(0.22,0.7,0.2,1) forwards',
                      } as React.CSSProperties),
                    }}
                  />
                </div>
                {/* Button at bottom */}
                <div style={{ position: 'relative', zIndex: 4, padding: '12px 24px 20px', background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)', display: 'flex', justifyContent: 'center', flexShrink: 0, transition: 'opacity 0.3s', opacity: pickupPhase === 'toInventory' ? 0 : 1 }}>
                  <button type="button" onClick={() => void confirmPendingPickup()} className="px-3 py-1.5 text-sm rounded font-semibold text-white bg-amber-600 hover:bg-amber-500">Add to Inventory</button>
                </div>
              </>
            ) : (
            <div
              className="relative w-full mx-3 sm:mx-4 rounded-2xl border border-amber-500/40 bg-neutral-950/95 shadow-2xl overflow-hidden"
              style={{ maxWidth: 'min(94vw, 880px)', maxHeight: 'min(92dvh, 920px)' }}
            >
              <div className="px-5 pt-5 pb-2 text-center">
                <div className="text-xs uppercase tracking-[0.18em] text-amber-300/70">Discovery</div>
                <h3 className="mt-1 text-2xl sm:text-3xl font-bold text-amber-50">You found {pendingPickup.itemName}</h3>
                <p className="mt-2 text-sm sm:text-base text-amber-100/70">Secure it now and add it to your inventory.</p>
              </div>

              <div className="relative py-6 sm:py-8 flex items-center justify-center overflow-y-auto" style={{ maxHeight: 'calc(min(92dvh, 920px) - 168px)' }}>
                <div
                  className={
                    'pickup-cinematic-item rounded-xl border border-amber-400/30 bg-neutral-900/80 p-4 shadow-[0_0_35px_rgba(251,191,36,0.35)] ' +
                    (pickupPhase === 'reveal' ? pickupRevealClass : '') +
                    (pickupPhase === 'toInventory' ? ` ${pickupToInventoryClass}` : '')
                  }
                  style={
                    pickupPhase === 'toInventory' && pickupFlight
                      ? ({
                          ['--pickup-dx' as any]: `${pickupFlight.dx}px`,
                          ['--pickup-dy' as any]: `${pickupFlight.dy}px`,
                          ['--pickup-scale' as any]: `${pickupFlight.scale}`,
                        } as React.CSSProperties)
                      : undefined
                  }
                >
                  {pendingPickup.imageUrl ? (
                    isVideoUrl(pendingPickup.imageUrl) ? (
                       
                      <video
                        src={pendingPickup.imageUrl}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="object-contain"
                        style={{ width: 'clamp(11rem, 40vw, 20rem)', height: 'clamp(11rem, 40vw, 20rem)', maxHeight: 'min(48dvh, 26rem)', maxWidth: '100%' }}
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={pendingPickup.imageUrl}
                        alt={pendingPickup.itemName}
                        className="object-contain"
                        style={{ width: 'clamp(11rem, 40vw, 20rem)', height: 'clamp(11rem, 40vw, 20rem)', maxHeight: 'min(48dvh, 26rem)', maxWidth: '100%' }}
                      />
                    )
                  ) : (
                    <div className="rounded-lg border border-amber-500/25 bg-neutral-900/80" style={{ width: 'clamp(11rem, 40vw, 20rem)', height: 'clamp(11rem, 40vw, 20rem)', maxHeight: 'min(48dvh, 26rem)', maxWidth: '100%' }} />
                  )}
                </div>
              </div>

              <div className="mx-5 border-t border-amber-500/20" />
              <div className="px-5 pb-5 pt-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => void confirmPendingPickup()}
                  disabled={pickupPhase !== 'ready'}
                  className={
                    'px-3 py-1.5 text-sm rounded font-semibold text-white transition ' +
                    (pickupPhase === 'ready' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-amber-900/70 cursor-not-allowed')
                  }
                >
                  {pickupPhase === 'committing' ? 'Adding…' : pickupPhase === 'toInventory' ? 'Storing…' : 'Add to Inventory'}
                </button>
              </div>
            </div>
            )}
          </div>
        ) : null
      )}

      {renderFullscreenOverlay(
        <ActionModal
          isOpen={actionModalOpen}
          title={actionModalTitle}
          message={actionModalMessage}
          imageUrl={actionModalImageUrl}
          description={actionModalDescription}
          choices={actionModalChoices ? actionModalChoices.map((c) => ({ label: c.label })) : undefined}
          onChoice={handleActionModalChoice}
          theme={actionModalTheme}
          zIndex={160}
          onClose={() => {
            setActionModalOpen(false);
            setActionModalChoices(null);
            setActionModalChoiceIndex(0);
            setActionModalImageUrl(null);
            setActionModalDescription(undefined);
          }}
        />
      )}
      {renderFullscreenOverlay(
        <PuzzleModal
          open={puzzleModal.open}
          type={puzzleModal.type}
          zIndex={160}
          config={{
            ...puzzleModal.config,
            updateBackgroundImage, // Pass the handler to the modal for use in interactions
          }}
          onClose={() => setPuzzleModal({ ...puzzleModal, open: false })}
          onComplete={() => setPuzzleModal({ ...puzzleModal, open: false })}
        />
      )}
      {/* Stage solve celebration overlay */}
      {renderFullscreenOverlay(
        celebration ? (
          <StageCelebration
            key={celebration.key}
            variant={celebration.variant as any}
            onDone={() => setCelebration(null)}
          />
        ) : null
      )}
      {/* Time penalty toast — shown when a wrong action costs run time */}
      {renderFullscreenOverlay(
        penaltyToast ? (
          <div
            className="penalty-toast"
            aria-live="assertive"
            style={{
              position: 'fixed',
              top: '72px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 9999,
              pointerEvents: 'none',
            }}
          >
            <div className="penalty-toast-inner">
              ⏱ {penaltyToast}
            </div>
          </div>
        ) : null
      )}
      {/* Mini-puzzle modal (keypad / wire / dial) */}
      {renderFullscreenOverlay(
        miniPuzzleState?.open && miniPuzzleState.config ? (
          <MiniPuzzleModal
            open={miniPuzzleState.open}
            puzzleType={miniPuzzleState.puzzleType}
            config={miniPuzzleState.config}
            label={miniPuzzleState.label}
            hotspotId={miniPuzzleState.hotspotId}
            puzzleId={puzzleId}
            sessionBody={sessionBody}
            onSolve={handleMiniPuzzleSolve}
            onPenalty={showPenaltyToast}
            onClose={() => setMiniPuzzleState(null)}
          />
        ) : null
      )}
      <style jsx global>{`
        /* ── Atmospheric player shell ── */
        .escape-room-player {
          box-shadow:
            0 0 0 1px rgba(120, 60, 0, 0.25),
            0 8px 60px rgba(0, 0, 0, 0.85),
            inset 0 0 120px rgba(0, 0, 0, 0.5);
        }

        .escape-drawer-backdrop {
          animation: escapeDrawerBackdropIn 180ms ease-out forwards;
        }
        .escape-side-drawer {
          animation: escapeDrawerIn 240ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          will-change: transform, opacity;
        }
        @keyframes escapeDrawerBackdropIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes escapeDrawerIn {
          from { transform: translateX(24px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        /* ── Scene canvas vignette ── */
        .escape-vignette {
          background: radial-gradient(
            ellipse at 50% 50%,
            transparent 48%,
            rgba(0, 0, 0, 0.52) 80%,
            rgba(0, 0, 0, 0.72) 100%
          );
        }

        /* ── Atmospheric timer bar ── */
        .escape-timer-running {
          background: linear-gradient(135deg, rgba(0, 0, 0, 0.65) 0%, rgba(28, 18, 4, 0.75) 100%);
          border: 1px solid rgba(120, 70, 0, 0.45);
          box-shadow: 0 0 12px rgba(180, 100, 0, 0.12), inset 0 1px 0 rgba(251, 191, 36, 0.06);
        }
        .escape-timer-critical {
          background: linear-gradient(135deg, rgba(35, 4, 4, 0.85) 0%, rgba(70, 8, 8, 0.75) 100%);
          border: 1px solid rgba(160, 28, 28, 0.6);
          box-shadow: 0 0 24px rgba(220, 38, 38, 0.28), inset 0 1px 0 rgba(255, 80, 80, 0.08);
          animation: escapeCriticalBorder 1.4s ease-in-out infinite;
        }
        .escape-timer-text-pulse {
          animation: escapeTimerTextPulse 0.9s ease-in-out infinite;
        }
        @keyframes escapeCriticalBorder {
          0%, 100% { box-shadow: 0 0 24px rgba(220, 38, 38, 0.28); border-color: rgba(160, 28, 28, 0.6); }
          50%       { box-shadow: 0 0 44px rgba(220, 38, 38, 0.55); border-color: rgba(220, 38, 38, 0.9); }
        }
        @keyframes escapeTimerTextPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.45; }
        }
          0%   { opacity: 0; transform: scale(0.82); }
          40%  { opacity: 1; }
          100% { opacity: 1; transform: scale(1); }
        }
        .pickup-cinematic-item {
          transition: opacity 0.35s ease-out;
        }
        .pickup-cinematic-reveal {
          animation: pickupReveal 0.95s cubic-bezier(0.2, 0.7, 0.15, 1) forwards;
        }

        /* ── Time penalty toast ── */
        .penalty-toast-inner {
          background: rgba(220, 38, 38, 0.92);
          color: #fff;
          font-size: 1.5rem;
          font-weight: 800;
          letter-spacing: 0.04em;
          padding: 0.45rem 1.4rem;
          border-radius: 999px;
          box-shadow: 0 4px 24px rgba(220, 38, 38, 0.55);
          animation: penaltyToastAnim 2.5s cubic-bezier(0.25, 0.9, 0.4, 1) forwards;
          white-space: nowrap;
        }
        @keyframes penaltyToastAnim {
          0%   { opacity: 0; transform: translateY(10px) scale(0.88); }
          12%  { opacity: 1; transform: translateY(-4px) scale(1.08); }
          22%  { transform: translateY(0) scale(1); }
          70%  { opacity: 1; }
          100% { opacity: 0; transform: translateY(-20px) scale(0.92); }
        }

        .pickup-cinematic-to-inventory {
          animation: pickupToInventory 0.78s cubic-bezier(0.3, 0.7, 0.2, 1) forwards;
        }

        .pickup-reveal-quick-spin {
          animation: pickupRevealQuickSpin 0.62s cubic-bezier(0.2, 0.7, 0.25, 1) forwards;
        }

        .pickup-reveal-float-in {
          animation: pickupRevealFloatIn 0.9s cubic-bezier(0.22, 0.7, 0.2, 1) forwards;
        }

        .pickup-reveal-power-drop {
          animation: pickupRevealPowerDrop 0.86s cubic-bezier(0.18, 0.82, 0.24, 1) forwards;
        }

        /* ── New pickup reveal presets ── */
        .pickup-reveal-spiral {
          animation: pickupRevealSpiral 0.75s cubic-bezier(0.18, 0.9, 0.25, 1) forwards;
        }
        .pickup-reveal-bounce {
          animation: pickupRevealBounce 0.82s cubic-bezier(0.22, 1.2, 0.36, 1) forwards;
        }
        .pickup-reveal-glitch {
          animation: pickupRevealGlitch 0.55s steps(6, end) forwards;
        }
        .pickup-reveal-flash {
          animation: pickupRevealFlash 0.65s cubic-bezier(0.25, 0.8, 0.2, 1) forwards;
        }
        /* ── New pickup to-inventory presets ── */
        .pickup-to-inventory-spiral {
          animation: pickupToInventorySpiral 0.65s cubic-bezier(0.24, 0.66, 0.2, 1) forwards;
        }
        .pickup-to-inventory-bounce {
          animation: pickupToInventoryBounce 0.62s cubic-bezier(0.27, 0.78, 0.22, 1) forwards;
        }
        .pickup-to-inventory-glitch {
          animation: pickupToInventoryGlitch 0.5s steps(5, end) forwards;
        }
        .pickup-to-inventory-flash {
          animation: pickupToInventoryFlash 0.55s ease-out forwards;
        }

        .pickup-to-inventory-quick-spin {
          animation: pickupToInventoryQuickSpin 0.55s cubic-bezier(0.24, 0.66, 0.2, 1) forwards;
        }

        .pickup-to-inventory-float-in {
          animation: pickupToInventoryFloatIn 0.9s cubic-bezier(0.25, 0.8, 0.2, 1) forwards;
        }

        .pickup-to-inventory-power-drop {
          animation: pickupToInventoryPowerDrop 0.72s cubic-bezier(0.27, 0.78, 0.22, 1) forwards;
        }

        .pickup-inventory-pulse {
          animation: inventoryPulse 0.8s ease-out;
        }

        @keyframes pickupReveal {
          0% {
            transform: translateY(40px) scale(0.3);
            opacity: 0;
          }
          50% {
            transform: translateY(-12px) scale(1.12);
            opacity: 1;
          }
          75% {
            transform: translateY(4px) scale(0.96);
            opacity: 1;
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }

        @keyframes pickupToInventory {
          0% {
            transform: translate(0px, 0px) scale(1) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translate(var(--pickup-dx, 0px), var(--pickup-dy, 0px)) scale(var(--pickup-scale, 0.34)) rotate(560deg);
            opacity: 0;
          }
        }

        @keyframes pickupRevealQuickSpin {
          0% {
            transform: translateY(14px) scale(0.5);
            opacity: 0;
          }
          70% {
            transform: translateY(-4px) scale(1.08);
            opacity: 1;
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }

        @keyframes pickupRevealFloatIn {
          0% {
            transform: translateY(34px) scale(0.84);
            opacity: 0;
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }

        @keyframes pickupRevealPowerDrop {
          0% {
            transform: translateY(-60px) scale(1.35);
            opacity: 0;
          }
          60% {
            transform: translateY(8px) scale(0.92);
            opacity: 1;
          }
          80% {
            transform: translateY(-3px) scale(1.04);
            opacity: 1;
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }

        @keyframes pickupToInventoryQuickSpin {
          0% {
            transform: translate(0px, 0px) scale(1.02) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translate(var(--pickup-dx, 0px), var(--pickup-dy, 0px)) scale(calc(var(--pickup-scale, 0.34) * 0.92)) rotate(720deg);
            opacity: 0;
          }
        }

        @keyframes pickupToInventoryFloatIn {
          0% {
            transform: translate(0px, 0px) scale(1) rotate(0deg);
            opacity: 1;
          }
          55% {
            transform: translate(calc(var(--pickup-dx, 0px) * 0.45), calc(var(--pickup-dy, 0px) * 0.35 - 18px)) scale(0.72) rotate(140deg);
            opacity: 0.88;
          }
          100% {
            transform: translate(var(--pickup-dx, 0px), var(--pickup-dy, 0px)) scale(var(--pickup-scale, 0.34)) rotate(220deg);
            opacity: 0;
          }
        }

        @keyframes pickupToInventoryPowerDrop {
          0% {
            transform: translate(0px, 0px) scale(1.08) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translate(var(--pickup-dx, 0px), var(--pickup-dy, 0px)) scale(calc(var(--pickup-scale, 0.34) * 1.05)) rotate(460deg);
            opacity: 0;
          }
        }

        @keyframes inventoryPulse {
          0% {
            box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.55);
          }
          100% {
            box-shadow: 0 0 0 20px rgba(251, 191, 36, 0);
          }
        }

        /* ── New pickup keyframes ── */
        @keyframes pickupRevealSpiral {
          0%   { transform: translate(0,0) scale(0.12); opacity: 0; }
          55%  { transform: translate(0,0) scale(1.15); opacity: 1; }
          75%  { transform: translate(0,0) scale(0.95); opacity: 1; }
          100% { transform: translate(0,0) scale(1); opacity: 1; }
        }
        @keyframes pickupRevealBounce {
          0%   { transform: translateY(-70px) scale(0.55); opacity: 0; }
          52%  { transform: translateY(12px) scale(1.05); opacity: 1; }
          72%  { transform: translateY(-6px) scale(0.97); opacity: 1; }
          88%  { transform: translateY(4px) scale(1.01); }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes pickupRevealGlitch {
          0%   { transform: translate(10px, 0) scale(0.7); opacity: 0.2; filter: hue-rotate(0deg); }
          18%  { transform: translate(-8px, 2px) scale(1.05); opacity: 0.65; filter: hue-rotate(90deg); }
          36%  { transform: translate(6px, -2px) scale(0.96); opacity: 0.85; filter: hue-rotate(180deg); }
          60%  { transform: translate(-3px, 1px) scale(1.02); opacity: 0.95; filter: hue-rotate(260deg); }
          100% { transform: translate(0,0) scale(1); opacity: 1; filter: hue-rotate(0deg); }
        }
        @keyframes pickupRevealFlash {
          0%   { transform: scale(1.4); opacity: 0; filter: brightness(4); }
          28%  { filter: brightness(2.5); opacity: 1; }
          100% { transform: scale(1); opacity: 1; filter: brightness(1); }
        }
        @keyframes pickupToInventorySpiral {
          0%   { transform: translate(0,0) scale(1) rotate(0deg); opacity: 1; }
          100% { transform: translate(var(--pickup-dx,0px), var(--pickup-dy,0px)) scale(var(--pickup-scale,0.34)) rotate(720deg); opacity: 0; }
        }
        @keyframes pickupToInventoryBounce {
          0%   { transform: translate(0,0) scale(1); opacity: 1; }
          38%  { transform: translate(calc(var(--pickup-dx,0px)*0.38), calc(var(--pickup-dy,0px)*0.18 - 24px)) scale(0.78); opacity: 0.9; }
          100% { transform: translate(var(--pickup-dx,0px), var(--pickup-dy,0px)) scale(var(--pickup-scale,0.34)); opacity: 0; }
        }
        @keyframes pickupToInventoryGlitch {
          0%   { transform: translate(0,0) scale(1); opacity: 1; filter: hue-rotate(0deg); }
          22%  { transform: translate(calc(var(--pickup-dx,0px)*0.28+7px), calc(var(--pickup-dy,0px)*0.2)); filter: hue-rotate(120deg); opacity: 0.8; }
          55%  { transform: translate(calc(var(--pickup-dx,0px)*0.62-4px), calc(var(--pickup-dy,0px)*0.52)); filter: hue-rotate(240deg); opacity: 0.6; }
          100% { transform: translate(var(--pickup-dx,0px), var(--pickup-dy,0px)) scale(var(--pickup-scale,0.34)); opacity: 0; filter: hue-rotate(360deg); }
        }
        @keyframes pickupToInventoryFlash {
          0%   { transform: translate(0,0) scale(1.08); opacity: 1; filter: brightness(2.8); }
          22%  { filter: brightness(1); }
          100% { transform: translate(var(--pickup-dx,0px), var(--pickup-dy,0px)) scale(var(--pickup-scale,0.34)); opacity: 0; }
        }

        /* ── Scene shake feedback (blocked/locked interaction) ── */
        .scene-shake {
          animation: sceneShake 0.48s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }
        @keyframes sceneShake {
          0%, 100% { transform: translateX(0); }
          14%  { transform: translateX(-7px); }
          28%  { transform: translateX(7px); }
          42%  { transform: translateX(-5px); }
          57%  { transform: translateX(5px); }
          71%  { transform: translateX(-3px); }
          85%  { transform: translateX(3px); }
        }

        /* ── Scene transition overlays ── */
        .scene-transition-fade {
          background: #000;
          animation: sceneTransFade 0.65s ease-out forwards;
        }
        .scene-transition-slideLeft {
          background: linear-gradient(to right, #000 80%, transparent);
          animation: sceneTransSlideLeft 0.55s cubic-bezier(0.25, 0.8, 0.2, 1) forwards;
        }
        .scene-transition-slideRight {
          background: linear-gradient(to left, #000 80%, transparent);
          animation: sceneTransSlideRight 0.55s cubic-bezier(0.25, 0.8, 0.2, 1) forwards;
        }
        .scene-transition-slideUp {
          background: linear-gradient(to bottom, #000 80%, transparent);
          animation: sceneTransSlideUp 0.55s cubic-bezier(0.25, 0.8, 0.2, 1) forwards;
        }
        .scene-transition-zoomIn {
          background: #000;
          animation: sceneTransZoomIn 0.6s cubic-bezier(0.2, 0.8, 0.25, 1) forwards;
        }
        .scene-transition-wipe {
          background: #000;
          animation: sceneTransWipe 0.5s ease-out forwards;
        }
        .scene-transition-glitch {
          background: rgba(0,255,100,0.06);
          animation: sceneTransGlitch 0.45s steps(5, end) forwards;
          mix-blend-mode: screen;
        }
        @keyframes sceneTransFade {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes sceneTransSlideLeft {
          0%   { transform: translateX(0); opacity: 1; }
          100% { transform: translateX(-100%); opacity: 0; }
        }
        @keyframes sceneTransSlideRight {
          0%   { transform: translateX(0); opacity: 1; }
          100% { transform: translateX(100%); opacity: 0; }
        }
        @keyframes sceneTransSlideUp {
          0%   { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(-100%); opacity: 0; }
        }
        @keyframes sceneTransZoomIn {
          0%   { transform: scale(1); opacity: 0.85; }
          100% { transform: scale(1.12); opacity: 0; }
        }
        @keyframes sceneTransWipe {
          0%   { clip-path: inset(0 0 0 0); }
          100% { clip-path: inset(0 0 0 100%); }
        }
        @keyframes sceneTransGlitch {
          0%   { transform: translate(5px, -3px) skewX(-5deg); opacity: 0.9; }
          20%  { transform: translate(-4px, 2px) skewX(4deg); opacity: 0.7; }
          40%  { transform: translate(3px, -1px) skewX(-2deg); opacity: 0.55; }
          70%  { transform: translate(-2px, 1px); opacity: 0.3; }
          100% { transform: translate(0,0) skewX(0); opacity: 0; }
        }

        /* ── Ambient item effect overlays (player) ── */
        .escape-ambient-glow {
          animation: escapeAmbientGlowPlayer 2.3s ease-in-out infinite;
          border-radius: 6px;
        }
        .escape-ambient-pulse {
          animation: escapeAmbientPulsePlayer 1.9s ease-in-out infinite;
          border-radius: 6px;
        }
        .escape-ambient-float {
          animation: escapeAmbientFloatPlayer 3.2s ease-in-out infinite;
          border-radius: 6px;
        }
        .escape-ambient-sparkle {
          animation: escapeAmbientSparklePlayer 2.6s ease-in-out infinite;
          border-radius: 6px;
        }
        .escape-ambient-shimmer {
          background: linear-gradient(108deg, transparent 25%, rgba(255,255,255,0.18) 50%, transparent 75%);
          background-size: 300% 100%;
          animation: escapeAmbientShimmerPlayer 2.8s ease-in-out infinite;
          border-radius: 6px;
        }
        @keyframes escapeAmbientGlowPlayer {
          0%, 100% { box-shadow: 0 0 8px 3px rgba(251,191,36,0.45), 0 0 22px 6px rgba(251,191,36,0.18); }
          50%       { box-shadow: 0 0 22px 9px rgba(251,191,36,0.85), 0 0 46px 18px rgba(251,191,36,0.42); }
        }
        @keyframes escapeAmbientPulsePlayer {
          0%, 100% { box-shadow: 0 0 0 0 rgba(251,191,36,0); border: 2px solid rgba(251,191,36,0.3); }
          50%       { box-shadow: 0 0 14px 6px rgba(251,191,36,0.5); border: 2px solid rgba(251,191,36,0.7); }
        }
        @keyframes escapeAmbientFloatPlayer {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-8%); }
        }
        @keyframes escapeAmbientSparklePlayer {
          0%, 100% { box-shadow: 0 0 0 0 rgba(251,191,36,0), 0 0 0 0 rgba(255,255,255,0); }
          22%       { box-shadow: 0 0 14px 5px rgba(251,191,36,0.9), 0 0 6px 2px rgba(255,255,255,0.6); }
          44%       { box-shadow: 0 0 0 0 rgba(251,191,36,0); }
          66%       { box-shadow: 0 0 10px 4px rgba(255,255,255,0.55); }
        }
        @keyframes escapeAmbientShimmerPlayer {
          0%   { background-position: 200% 0; }
          100% { background-position: -100% 0; }
        }
      `}</style>
    </div>
  );
}
