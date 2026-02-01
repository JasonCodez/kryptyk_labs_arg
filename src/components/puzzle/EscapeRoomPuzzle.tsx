"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import ActionModal from "@/components/ActionModal";

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
  }>;
};

export function EscapeRoomPuzzle({ puzzleId, onComplete }: { puzzleId: string; onComplete?: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EscapeRoomResponse | null>(null);
  const [stageIndex, setStageIndex] = useState(1);
  // answer input/submission not needed for this project; removed UI and handler
  const [inventory, setInventory] = useState<string[]>([]);
  const completedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/puzzles/escape-room/${puzzleId}`);
        if (!res.ok) throw new Error("Failed to load escape room");
        const j = await res.json();
        if (cancelled) return;
        setData(j as EscapeRoomResponse);

        const st = await fetch(`/api/puzzles/escape-room/${puzzleId}/state`);
        if (st.ok) {
          const sj = await st.json().catch(() => null);
          if (sj && sj.inventory) setInventory(sj.inventory || []);
        }
      } catch (e: any) {
        setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [puzzleId]);

  const stage = useMemo(() => {
    if (!data) return null;
    return data.stages?.find((s) => s.order === stageIndex) ?? data.stages?.[0] ?? null;
  }, [data, stageIndex]);

  useEffect(() => {
    if (!loading && data && !stage && !completedRef.current) {
      completedRef.current = true;
      onComplete?.();
    }
  }, [loading, data, stage, onComplete]);

  const hints = useMemo(() => {
    if (!stage) return [] as string[];
    const raw = stage.hints;
    if (Array.isArray(raw)) return raw.map((h) => (typeof h === "string" ? h : JSON.stringify(h)));
    try { return typeof raw === "string" ? JSON.parse(raw) : []; } catch { return [] as string[]; }
  }, [stage]);

  // submit handler removed — stage answers are not used in this variant

  const layout = data?.layouts && data.layouts.length > 0 ? data.layouts[0] : null;
  const PixiRoom = React.lazy(() => import("./PixiRoom"));
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionModalTitle, setActionModalTitle] = useState<string | undefined>(undefined);
  const [actionModalMessage, setActionModalMessage] = useState<string | undefined>(undefined);

  const handleHotspotAction = async (hotspotId: string) => {
    try {
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
        setActionModalTitle(hsMeta?.label || 'Info');
        setActionModalMessage(hsMeta?.modalContent || hsMeta?.message || '');
        setActionModalOpen(true);
        return;
      }

      // default: send action to server (pickup)
      const r = await fetch(`/api/puzzles/escape-room/${puzzleId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pickup', hotspotId }),
      });
      const jb = await r.json().catch(() => null);
      if (r.ok && jb?.inventory) setInventory(jb.inventory || []);
    } catch (e) {
      console.error('Hotspot action failed', e);
    }
  };

  if (loading) return <div className="text-gray-300">Loading escape room…</div>;
  if (error) return <div className="text-red-300">{error}</div>;
  if (!data || !stage) return <div className="text-green-300">Escape room complete!</div>;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
      <div className="mb-3">
        <div className="text-white font-semibold">Stage {stage.order}: {stage.title}</div>
        {stage.description && <div className="text-gray-300 text-sm mt-1">{stage.description}</div>}
      </div>

      {hints.length > 0 && (
        <div className="mb-3 text-sm text-gray-400">Hints: {hints.join(" • ")}</div>
      )}

      {/* Stage answer input removed — not used for these puzzles */}

      {layout ? (
        <div className="mt-4" style={{ width: '100%', height: layout.height || 600 }}>
          <React.Suspense fallback={<div className="text-gray-400">Loading room...</div>}>
            <PixiRoom puzzleId={puzzleId} layout={layout} hotspots={layout.hotspots || []} onHotspotAction={handleHotspotAction} />
          </React.Suspense>
        </div>
      ) : null}

      <ActionModal isOpen={actionModalOpen} title={actionModalTitle} message={actionModalMessage} onClose={() => setActionModalOpen(false)} />

      {inventory.length > 0 && <div className="mt-2 text-sm text-gray-200">Inventory: {inventory.join(', ')}</div>}
    </div>
  );
}

export default EscapeRoomPuzzle;
