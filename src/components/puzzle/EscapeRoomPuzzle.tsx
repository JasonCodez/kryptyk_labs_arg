"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ActionModal from "@/components/ActionModal";

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

type EscapeActivityEntry = {
  id: string;
  ts: string;
  type: string;
  title: string;
  actor?: { id: string; name: string };
  meta?: Record<string, any>;
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
  puzzle?: {
    title: string;
    description: string | null;
  };
  layouts?: Array<{
    id: string;
    title?: string | null;
    backgroundUrl?: string | null;
    width?: number | null;
    height?: number | null;
    hotspots?: Array<any>;
    items?: Array<any>;
  }>;
};

export function EscapeRoomPuzzle({
  puzzleId,
  teamId,
  onComplete,
}: {
  puzzleId: string;
  teamId?: string;
  onComplete?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EscapeRoomResponse | null>(null);
  const [stageIndex, setStageIndex] = useState(1);
  const [stageAspect, setStageAspect] = useState<string | null>(null);
  // answer input/submission not needed for this project; removed UI and handler
  const [inventory, setInventory] = useState<string[]>([]);
  const [inventoryItems, setInventoryItems] = useState<Record<string, InventoryItem>>({});
  const [briefingAcks, setBriefingAcks] = useState<Record<string, string>>({});
  const [inventoryLocks, setInventoryLocks] = useState<InventoryLocksMap>({});
  const [sceneState, setSceneState] = useState<Record<string, any>>({});
  const [sideTab, setSideTab] = useState<'inventory' | 'activity'>('inventory');
  const [activity, setActivity] = useState<EscapeActivityEntry[]>([]);
  const [runStartedAt, setRunStartedAt] = useState<string | null>(null);
  const [runExpiresAt, setRunExpiresAt] = useState<string | null>(null);
  const [failedAt, setFailedAt] = useState<string | null>(null);
  const [failedReason, setFailedReason] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [isLeader, setIsLeader] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [timeRemainingMs, setTimeRemainingMs] = useState<number | null>(null);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [clientTimedOut, setClientTimedOut] = useState(false);
  const [timeExpiredModalOpen, setTimeExpiredModalOpen] = useState(false);
  const completedRef = useRef(false);
  const initialCompletedAtRef = useRef<string | null | undefined>(undefined);
  const abortHandledRef = useRef(false);
  const timeExpiredHandledRef = useRef(false);
  const socketRef = useRef<any>(null);
  const soundEnabledRef = useRef(true);

  useEffect(() => {
    soundEnabledRef.current = !!soundEnabled;
  }, [soundEnabled]);

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
    if (!teamId) return;
    try {
      const st = await fetch(`/api/puzzles/escape-room/${puzzleId}/state?teamId=${encodeURIComponent(teamId)}`);
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
      setIsLeader(!!sj?.isLeader);
    } catch {
      // ignore
    }
  }, [teamId, puzzleId]);

  const exitToDashboard = useCallback(() => {
    try {
      if (teamId && currentUserId) {
        try { socketRef.current?.emit('leaveEscapeRoom', { teamId, puzzleId, userId: currentUserId }); } catch {}
      }
    } finally {
      try { socketRef.current?.disconnect(); } catch {}
      socketRef.current = null;
      router.push('/dashboard');
    }
  }, [router, teamId, puzzleId, currentUserId]);


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

        if (!teamId) {
          throw new Error('This escape room must be played with a team. Open it from a team lobby.');
        }

        const res = await fetch(`/api/puzzles/escape-room/${puzzleId}?teamId=${encodeURIComponent(teamId)}`);
        if (!res.ok) throw new Error("Failed to load escape room");
        const j = await res.json();
        if (cancelled) return;
        setData(j as EscapeRoomResponse);

        try {
          const u = await fetch('/api/user/info');
          if (u.ok) {
            const uj = await u.json().catch(() => null);
            if (uj?.id) setCurrentUserId(String(uj.id));
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

        const st = await fetch(`/api/puzzles/escape-room/${puzzleId}/state?teamId=${encodeURIComponent(teamId)}`);
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
          setIsLeader(!!sj?.isLeader);
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
  }, [puzzleId, teamId]);

  useEffect(() => {
    if (!teamId || !currentUserId) return;
    let cancelled = false;
    (async () => {
      try {
        const { io } = await import('socket.io-client');
        if (cancelled) return;
        const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000', { transports: ['websocket'] });
        socketRef.current = socket;

        const pushActivity = (entry: EscapeActivityEntry) => {
          setActivity((prev) => {
            const next = [entry, ...prev];
            return next.length > 80 ? next.slice(0, 80) : next;
          });
        };

        socket.on('connect', () => {
          try {
            socket.emit('joinEscapeRoom', { teamId, puzzleId, userId: currentUserId });
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
            if (payload.teamId && payload.teamId !== teamId) return;
            if (payload.puzzleId && payload.puzzleId !== puzzleId) return;

            if (payload.briefingAcks) setBriefingAcks(payload.briefingAcks || {});
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
            if (payload.teamId && payload.teamId !== teamId) return;
            if (payload.puzzleId && payload.puzzleId !== puzzleId) return;
            const entry = payload.entry as EscapeActivityEntry | undefined;
            if (!entry || !entry.id || !entry.ts || !entry.title) return;
            pushActivity(entry);
            playSfx((entry as any)?.meta?.sfx);
          } catch {
            // ignore
          }
        });

        socket.on('escapeAborted', (payload: any) => {
          try {
            if (abortHandledRef.current) return;
            if (payload?.teamId && payload.teamId !== teamId) return;
            if (payload?.puzzleId && payload.puzzleId !== puzzleId) return;
            abortHandledRef.current = true;

            const reason = payload?.reason ? String(payload.reason) : 'abort';
            const notice =
              reason === 'missing_player'
                ? 'A teammate did not join in time. The lobby was reset — please restart.'
                : 'A teammate disconnected. The lobby was reset — please restart.';
            const url = `/teams/${teamId}/lobby?puzzleId=${encodeURIComponent(puzzleId)}&notice=${encodeURIComponent(notice)}`;

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
        socketRef.current?.emit('leaveEscapeRoom', { teamId, puzzleId, userId: currentUserId });
      } catch {}
      try { socketRef.current?.disconnect(); } catch {}
      socketRef.current = null;
    };
  }, [teamId, puzzleId, currentUserId, router, playSfx]);

  useEffect(() => {
    if (!teamId) return;
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
          `/api/team/lobby/chat?teamId=${encodeURIComponent(teamId)}&puzzleId=${encodeURIComponent(puzzleId)}&limit=200`,
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
  }, [teamId, puzzleId]);

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
    onComplete?.();
  }, [loading, completedAt, onComplete]);

  const hints = useMemo(() => {
    if (!stage) return [] as string[];
    const raw = stage.hints;
    if (Array.isArray(raw)) return raw.map((h) => (typeof h === "string" ? h : JSON.stringify(h)));
    try { return typeof raw === "string" ? JSON.parse(raw) : []; } catch { return [] as string[]; }
  }, [stage]);

  // submit handler removed — stage answers are not used in this variant

  const baseLayout = useMemo(() => {
    if (!data?.layouts || data.layouts.length === 0) return null;
    // Best-effort: align stage 1 -> layout[0], stage 2 -> layout[1], etc.
    const idx = Math.max(0, Math.min(stageIndex - 1, data.layouts.length - 1));
    return data.layouts[idx];
  }, [data, stageIndex]);

  const layout = useMemo(() => {
    if (!baseLayout) return null;

    const itemsRaw = Array.isArray((baseLayout as any)?.items) ? ((baseLayout as any).items as any[]) : [];
    const hotspotsRaw = Array.isArray((baseLayout as any)?.hotspots) ? ((baseLayout as any).hotspots as any[]) : [];

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
      const disabledByDefault = meta?.disabledByDefault === true;
      if (disabledByDefault && id && !enabledHotspotIds.has(id)) return false;
      if (id && disabledHotspotIds.has(id) && !enabledHotspotIds.has(id)) return false;
      return true;
    });

    return {
      ...(baseLayout as any),
      items: filteredItems,
      hotspots: filteredHotspots,
    };
  }, [baseLayout, inventory, sceneState]);

  // If the stage/layout changes, drop the previously inferred aspect ratio.
  // PixiRoom will report the new effective layout size once its background loads.
  useEffect(() => {
    setStageAspect(null);
  }, [stageIndex, (layout as any)?.id]);

  const stageDropRef = useRef<HTMLDivElement | null>(null);
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
  const [actionModalChoices, setActionModalChoices] = useState<Array<{ label: string; modalContent: string }> | null>(null);
  const [actionModalChoiceIndex, setActionModalChoiceIndex] = useState<number>(0);

  const handleHotspotAction = useCallback(async (hotspotId: string) => {
    try {
      if (!teamId) return;
      if (!runStartedAt) return;
      if (failedAt || completedAt) return;
      // find hotspot in current layout
      const curLayout = layout as any;
      const hs = curLayout?.hotspots?.find((h: any) => h.id === hotspotId);
      let hsMeta: any = {};
      if (hs && hs.meta) {
        try { hsMeta = typeof hs.meta === 'string' ? JSON.parse(hs.meta) : hs.meta; } catch { hsMeta = hs.meta; }
      }
      const actionType = hs?.type || (hsMeta && hsMeta.actionType) || 'collect';
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
              .map((x) => ({ label: x?.label, modalContent: x?.modalContent }))
              .filter((x) => typeof x.label === 'string' && typeof x.modalContent === 'string')
          : [];
        const choices = [{ label: 'Inspect', modalContent: baseMessage }, ...extra];

        setActionModalChoices(choices.length > 1 ? choices : null);
        setActionModalChoiceIndex(0);
        setActionModalMessage(baseMessage);
        setActionModalOpen(true);
        return;
      }

      if (actionType === 'trigger') {
        const r = await fetch(`/api/puzzles/escape-room/${puzzleId}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'trigger', hotspotId, teamId }),
        });
        const jb = await r.json().catch(() => null);
        if (!r.ok) {
          setActionModalTitle(hsMeta?.label || 'Locked');
          setActionModalMessage(jb?.error || 'Unable to open.' );
          setActionModalOpen(true);
          return;
        }
        playSfx(jb?.sfx);
        // stageIndex + completedAt will be updated via socket payload (and/or jb)
        return;
      }

      // default: send action to server (pickup)
      const r = await fetch(`/api/puzzles/escape-room/${puzzleId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pickup', hotspotId, teamId }),
      });
      const jb = await r.json().catch(() => null);
      playSfx(jb?.sfx);
      if (r.ok && jb?.inventory) setInventory(jb.inventory || []);
      if (r.ok && jb?.inventoryItems) setInventoryItems(jb.inventoryItems || {});
      if (!r.ok) {
        setActionModalTitle(hsMeta?.label || 'Unable to pick up');
        setActionModalMessage(jb?.error || 'Please try again.');
        setActionModalOpen(true);
      }
    } catch (e) {
      console.error('Hotspot action failed', e);
    }
  }, [teamId, runStartedAt, failedAt, completedAt, layout, puzzleId, playSfx]);

  const handleActionModalChoice = useCallback((index: number) => {
    if (!actionModalChoices || actionModalChoices.length === 0) return;
    const idx = Math.max(0, Math.min(index, actionModalChoices.length - 1));
    setActionModalChoiceIndex(idx);
    setActionModalMessage(actionModalChoices[idx]?.modalContent || '');
  }, [actionModalChoices]);

  const canInteract = !!runStartedAt && !failedAt && !completedAt && !clientTimedOut;

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

  if (loading) return <div className="text-gray-300">Loading escape room…</div>;
  if (error) return <div className="text-red-300">{error}</div>;
  if (!data || !stage) return <div className="text-gray-300">Unable to load escape room stages.</div>;

  const ackCount = Object.keys(briefingAcks || {}).length;
  const allAcked = ackCount >= 4;

  const fmtRemaining = (ms: number | null) => {
    if (ms === null) return null;
    const safe = Math.max(0, ms);
    const totalSeconds = Math.floor(safe / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const ackBriefing = async () => {
    if (!teamId) return;
    try {
      setSessionBusy(true);
      const r = await fetch(`/api/puzzles/escape-room/${puzzleId}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ackBriefing', teamId }),
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
    if (!teamId) return;
    try {
      setSessionBusy(true);
      const r = await fetch(`/api/puzzles/escape-room/${puzzleId}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'startRun', teamId }),
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
    if (!teamId) return;
    try {
      setSessionBusy(true);
      const r = await fetch(`/api/puzzles/escape-room/${puzzleId}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'acquireLock', teamId, itemKey }),
      });
      const jb = await r.json().catch(() => null);
      if (r.ok && jb?.inventoryLocks) {
        setInventoryLocks(jb.inventoryLocks || {});
      } else if (r.status === 409 && jb?.lock) {
        setActionModalTitle('Item in use');
        setActionModalMessage(`This item is being used by ${jb.lock.lockedByName || 'a teammate'}.`);
        setActionModalOpen(true);
      } else if (!r.ok) {
        setActionModalTitle('Unable to use item');
        setActionModalMessage(jb?.error || 'Please try again.');
        setActionModalOpen(true);
      }
    } finally {
      setSessionBusy(false);
    }
  };

  const releaseLock = async (itemKey: string) => {
    if (!teamId) return;
    try {
      setSessionBusy(true);
      const r = await fetch(`/api/puzzles/escape-room/${puzzleId}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'releaseLock', teamId, itemKey }),
      });
      const jb = await r.json().catch(() => null);
      if (r.ok && jb?.inventoryLocks) setInventoryLocks(jb.inventoryLocks || {});
    } finally {
      setSessionBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 relative">
      {timeExpiredModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
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
                This escape room is now marked as failed for your account and can no longer be replayed.
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
      ) : null}

      {failedAt ? (
        <div className="mb-3 rounded border border-red-700/60 bg-red-950/40 p-3 text-red-200">
          <div className="font-semibold">Run failed</div>
          <div className="text-sm opacity-90">{failedReason || 'The run ended and cannot be retried.'}</div>
        </div>
      ) : null}

      {completedAt ? (
        <div className="mb-3 rounded border border-emerald-700/60 bg-emerald-950/30 p-3 text-emerald-200">
          <div className="font-semibold">Run complete</div>
          <div className="text-sm opacity-90">Nice work — this run is finished.</div>
        </div>
      ) : null}

      {runStartedAt && runExpiresAt && !failedAt && !completedAt ? (
        <div className="mb-3 flex items-center justify-between rounded border border-slate-700 bg-slate-950/30 px-3 py-2">
          <div className="text-sm text-gray-200">Time remaining</div>
          <div className={"font-mono text-sm " + ((timeRemainingMs ?? 0) <= 30_000 ? 'text-red-300' : 'text-gray-100')}>
            {fmtRemaining(timeRemainingMs)}
          </div>
        </div>
      ) : null}

      {!runStartedAt && !failedAt && !completedAt ? (
        <div className="mb-3 rounded border border-slate-700 bg-slate-950/30 p-3">
          <div className="text-white font-semibold">Briefing</div>
          <div className="text-gray-300 text-sm mt-1">{data.puzzle?.description || 'Read the briefing, then acknowledge when ready.'}</div>
          <div className="mt-2 text-sm text-gray-200">Acknowledged: {ackCount}/4</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={sessionBusy}
              onClick={ackBriefing}
              className="px-3 py-2 rounded bg-indigo-600 text-white disabled:opacity-60"
            >
              I understand
            </button>
            {isLeader ? (
              <button
                type="button"
                disabled={sessionBusy || !allAcked}
                onClick={startRun}
                className="px-3 py-2 rounded bg-emerald-600 text-white disabled:opacity-60"
              >
                Start run
              </button>
            ) : (
              <div className="px-3 py-2 rounded bg-slate-900 border border-slate-700 text-gray-300 text-sm">
                Waiting for leader to start…
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
                  "rounded px-3 py-1 text-sm border " +
                  (s.order === stageIndex
                    ? "bg-indigo-600/60 border-indigo-400 text-white"
                    : "bg-slate-800/40 border-slate-600 text-gray-200 hover:bg-slate-800/70")
                }
              >
                {s.title || `Stage ${s.order}`}
              </button>
            ))}
        </div>
      ) : null}

      <div className="mb-3">
        <div className="text-white font-semibold">Stage {stage.order}: {stage.title}</div>
        {stage.description && <div className="text-gray-300 text-sm mt-1">{stage.description}</div>}
      </div>

      {hints.length > 0 && (
        <div className="mb-3 text-sm text-gray-400">Hints: {hints.join(" • ")}</div>
      )}

      {/* Stage answer input removed — not used for these puzzles */}

      {layout ? (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="flex flex-col gap-4">
            <div className="flex justify-center">
              <div
                className="w-full bg-slate-950"
                ref={stageDropRef}
                onDragOver={(e) => {
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  try {
                    e.preventDefault();
                    if (!canInteract) return;
                    const itemKey = e.dataTransfer?.getData("text/plain") || "";
                    if (!itemKey) return;
                    const hotspotId = resolveHotspotAtClientPoint(e.clientX, e.clientY);
                    if (!hotspotId) return;
                    void (async () => {
                      try {
                        if (!teamId) return;
                        const r = await fetch(`/api/puzzles/escape-room/${puzzleId}/action`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'use', hotspotId, teamId, itemKey }),
                        });
                        const jb = await r.json().catch(() => null);
                        if (r.ok) {
                          playSfx(jb?.sfx);
                          playSfx(jb?.sfxLoot);
                          if (Array.isArray(jb?.inventory)) setInventory(jb.inventory);
                          if (jb?.inventoryItems) setInventoryItems(jb.inventoryItems || {});
                          if (jb?.sceneState) setSceneState(jb.sceneState || {});
                          return;
                        }
                        setActionModalTitle('Unable to use item');
                        setActionModalMessage(jb?.error || 'Please try again.');
                        setActionModalOpen(true);
                      } catch (err) {
                        console.error('Use item failed', err);
                        setActionModalTitle('Unable to use item');
                        setActionModalMessage('Please try again.');
                        setActionModalOpen(true);
                      }
                    })();
                  } catch {
                    // ignore
                  }
                }}
                style={{
                  // Let the canvas grow on larger screens while preserving the room ratio.
                  // Match the Designer's logical coordinate space when layout dimensions are missing.
                  aspectRatio: stageAspect || `${(layout as any)?.width || 600} / ${(layout as any)?.height || 320}`,
                  overflow: 'hidden',
                  borderRadius: 8,
                }}
              >
                <React.Suspense fallback={<div className="text-gray-400">Loading room...</div>}>
                  <PixiRoom
                    puzzleId={puzzleId}
                    layout={layout}
                    hotspots={hotspots}
                    onHotspotAction={onHotspotAction}
                    onEffectiveLayoutSize={onEffectiveLayoutSize}
                  />
                </React.Suspense>
              </div>
            </div>

            <div className="rounded-2xl bg-gradient-to-r from-amber-900 via-amber-700 to-amber-950 p-[3px]">
              <div
                className="rounded-[14px] bg-neutral-950/90 ring-1 ring-amber-500/20 border border-amber-900/40 p-3"
                style={{ maxHeight: 650, overflowY: 'auto' }}
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
                      return (
                        <div
                          key={key}
                          draggable={!!canInteract && !sessionBusy && (!lock || lockedByMe)}
                          onDragStart={(e) => {
                            if (!canInteract) return;
                            if (sessionBusy) return;
                            if (lock && !lockedByMe) return;
                            try {
                              e.dataTransfer?.setData("text/plain", key);
                              e.dataTransfer.effectAllowed = "move";
                            } catch {
                              // ignore
                            }
                          }}
                          className={
                            "rounded-lg border border-amber-800/30 bg-neutral-950/40 px-3 py-2 text-sm text-amber-50/90 " +
                            (canInteract && !sessionBusy && (!lock || lockedByMe)
                              ? "cursor-grab active:cursor-grabbing"
                              : "cursor-default")
                          }
                          title="Drag onto the room to use"
                        >
                          <div className="flex items-center gap-2">
                            {imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={imageUrl} alt={displayName} className="h-9 w-9 rounded object-contain bg-neutral-900/60 border border-amber-600/25" />
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
                              disabled={!canInteract || sessionBusy || (!!lock && !lockedByMe)}
                              onClick={() => acquireLock(key)}
                              className="px-2 py-1 rounded bg-amber-700 text-amber-50 hover:bg-amber-600 disabled:opacity-50"
                            >
                              Use
                            </button>
                            {lockedByMe || isLeader ? (
                              <button
                                type="button"
                                disabled={!canInteract || sessionBusy || !lock}
                                onClick={() => releaseLock(key)}
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
          </div>

          <div className="rounded-2xl bg-gradient-to-r from-amber-900 via-amber-700 to-amber-950 p-[3px]">
            <div className="rounded-[14px] bg-neutral-950/90 ring-1 ring-amber-500/20 border border-amber-900/40 p-3 flex flex-col" style={{ maxHeight: 650 }}>
            <div className="text-sm text-amber-200/90 mb-2 font-semibold tracking-wide">Team Chat</div>
            <div className="flex-1 overflow-y-auto mb-3 space-y-3 rounded-lg bg-neutral-950/60 ring-1 ring-amber-500/15 p-2">
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
        </div>
      ) : null}

      <ActionModal
        isOpen={actionModalOpen}
        title={actionModalTitle}
        message={actionModalMessage}
        imageUrl={actionModalImageUrl}
        description={actionModalDescription}
        choices={actionModalChoices ? actionModalChoices.map((c) => ({ label: c.label })) : undefined}
        onChoice={handleActionModalChoice}
        theme={actionModalTheme}
        onClose={() => {
          setActionModalOpen(false);
          setActionModalChoices(null);
          setActionModalChoiceIndex(0);
          setActionModalImageUrl(null);
          setActionModalDescription(undefined);
        }}
      />
    </div>
  );
}

export default EscapeRoomPuzzle;
