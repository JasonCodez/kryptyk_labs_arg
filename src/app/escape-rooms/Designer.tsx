"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";

// Types for the escape room builder
interface EscapeRoomScene {
  id: string;
  name: string;
  backgroundUrl: string;
  description: string;
  items: EscapeRoomItem[];
  interactiveZones: InteractiveZone[];
  // Player assignment: which player slots (1-4) start in this scene.
  // Empty / undefined means any player can be here.
  assignedPlayerSlots?: number[];
  // Access rule: who can enter this scene.
  // 'open'            = anyone can navigate here
  // 'assignedOnly'    = only the assigned player slot(s) can view it
  // 'lockedUntilUnlocked' = no one can enter until a useEffect enables it
  accessRule?: 'open' | 'assignedOnly' | 'lockedUntilUnlocked';
}

interface EscapeRoomItem {
  id: string;
  name: string;
  imageUrl: string;
  description: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  properties: Record<string, any>;
}

interface InteractiveZone {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  actionType: "modal" | "collect" | "trigger" | "codeEntry";
  // Optional: override whether the dragged/used item is consumed when using it on this zone.
  // Default behavior is to consume the item; set to false to keep the item.
  consumeItemOnUse?: boolean;
  // Optional: gate a "use" interaction on a specific scene item (designer id).
  // Server converts this to an inventory item key at runtime.
  requiredItemId?: string;
  // Optional: start disabled until a useEffect enables it.
  disabledByDefault?: boolean;
  // Optional: associate this zone with an item so the player modal can show its image/description.
  itemId?: string;
  // Optional: explicit modal image override (shown in the player modal before falling back to associated item image).
  imageUrl?: string;
  modalContent?: string;
  // Optional: additional interactions for the same zone/item (shown as buttons in the player modal).
  // Each interaction can swap modal content, trigger scene effects, and/or complete the room.
  interactions?: Array<{
    label: string;
    modalContent: string;
    triggersEffect?: InteractiveZone['useEffect'];
    completesRoom?: boolean;
    completionVariant?: string;
  }>;
  // Optional: designer-wired effects that are applied when using an inventory item on this zone.
  // NOTE: enable/disable IDs are designer zone ids (not DB hotspot ids).
  useEffect?: {
    hideItemIds?: string[];
    showItemIds?: string[];
    disableHotspotIds?: string[];
    enableHotspotIds?: string[];
    setItemStateById?: Record<string, string>;
    setItemImageById?: Record<string, string>;
    setItemAlphaById?: Record<string, number>;
    setItemScaleById?: Record<string, number>;
    setItemRotationById?: Record<string, number>;
    setItemTintById?: Record<string, string>;
    // Cross-scene effects: apply show/hide/enable/disable in OTHER scenes.
    crossSceneEffects?: Array<{
      sceneId: string;
      showItemIds?: string[];
      hideItemIds?: string[];
      enableHotspotIds?: string[];
      disableHotspotIds?: string[];
    }>;
    // Completes the room (triggers win screen) when this effect fires.
    completesRoom?: boolean;
    completionVariant?: string;
  };
  eventId?: string;
  linkedPuzzleId?: string;
  collectItemId?: string;
  pickupAnimationPreset?: 'cinematic' | 'quickSpin' | 'floatIn' | 'powerDrop';
  // Code-entry zone configuration.
  codeEntry?: {
    correctCode: string;
    caseSensitive?: boolean;
    errorMessage?: string;
    cooldownSeconds?: number;
    maxAttempts?: number;
    // Optional: item in this scene whose canvas position will display the typed code.
    displayItemId?: string;
  };
}

interface UserSpecialty {
  id: string;
  name: string;
  description: string;
}

type PickupAnimationPreset = 'cinematic' | 'quickSpin' | 'floatIn' | 'powerDrop';

type PlaytestPendingPickup = {
  itemId: string;
  itemName: string;
  imageUrl: string;
  preset: PickupAnimationPreset;
};

type PlaytestPickupRevealMotion = {
  dx: number;
  dy: number;
  scale: number;
};

type PlaytestCodeEntry = {
  zoneLabel: string;
  correctCode: string;
  caseSensitive: boolean;
  errorMessage: string;
  cooldownSeconds: number;
  maxAttempts: number;
  attemptsLeft: number;
  cooldownEndTs: number | null;
  triggerEffect: any;
  completesRoom: boolean;
  completionVariant: string;
  // ID of the scene item that acts as the in-world terminal display.
  displayItemId?: string;
};

// Dummy puzzle list for linking (replace with real data from backend)
const dummyPuzzles = [
  { id: 'pz1', title: 'Sudoku Challenge' },
  { id: 'pz2', title: 'Riddle of the Sphinx' },
  { id: 'pz3', title: 'Logic Grid' },
];

const pickupAnimationPresetOptions: Array<{ value: 'cinematic' | 'quickSpin' | 'floatIn' | 'powerDrop'; label: string }> = [
  { value: 'cinematic', label: 'Cinematic Spin + Zoom' },
  { value: 'quickSpin', label: 'Quick Spin' },
  { value: 'floatIn', label: 'Float In' },
  { value: 'powerDrop', label: 'Power Drop' },
];

interface EscapeRoomDesignerProps {
  initialData?: any;
  editId?: string;
  onChange?: (data: any) => void;
}

export default function EscapeRoomDesigner({ initialData, editId, onChange }: EscapeRoomDesignerProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [timeLimit, setTimeLimit] = useState(initialData?.timeLimit || 1200);
  const [startMode, setStartMode] = useState(initialData?.startMode || 'leader-start');
  // 'shared' = all players see the same scene at once (classic mode)
  // 'assigned' = each player is assigned to a starting scene (multi-room co-op)
  const [playerMode, setPlayerMode] = useState<'shared' | 'assigned'>(initialData?.playerMode || 'shared');
  const [scenes, setScenes] = useState<EscapeRoomScene[]>(initialData?.scenes || []);
  const [userSpecialties, setUserSpecialties] = useState<UserSpecialty[]>(initialData?.userSpecialties || []);
  const [validationError, setValidationError] = useState("");
  const [previewSceneIdx, setPreviewSceneIdx] = useState(0);
  const [previewMode, setPreviewMode] = useState<'edit' | 'playtest'>('edit');

  // Local playtest state (no server, no DB) so designers can test wiring before creating/saving a puzzle.
  const [playtestSceneIdx, setPlaytestSceneIdx] = useState(0);
  const [playtestInventoryItemIds, setPlaytestInventoryItemIds] = useState<string[]>([]);
  const [playtestSelectedInventoryItemId, setPlaytestSelectedInventoryItemId] = useState<string | null>(null);
  const [playtestMessage, setPlaytestMessage] = useState<string>('');
  const [playtestCompleted, setPlaytestCompleted] = useState(false);
  const [playtestPendingPickup, setPlaytestPendingPickup] = useState<PlaytestPendingPickup | null>(null);
  const [playtestPickupPhase, setPlaytestPickupPhase] = useState<'reveal' | 'ready' | 'toInventory'>('reveal');
  const [playtestPickupFlight, setPlaytestPickupFlight] = useState<{ dx: number; dy: number; scale: number } | null>(null);
  const [playtestPickupRevealMotion, setPlaytestPickupRevealMotion] = useState<PlaytestPickupRevealMotion | null>(null);
  // Which player slot the designer is simulating (1-4). In 'assigned' mode this drives auto-scene routing.
  const [playtestPlayerSlot, setPlaytestPlayerSlot] = useState<1 | 2 | 3 | 4>(1);
  // Code-entry overlay state for playtest.
  const [playtestCodeEntry, setPlaytestCodeEntry] = useState<PlaytestCodeEntry | null>(null);
  const [playtestCodeInput, setPlaytestCodeInput] = useState('');
  const [playtestCodeError, setPlaytestCodeError] = useState('');
  const [playtestCodeCooldownRemaining, setPlaytestCodeCooldownRemaining] = useState(0);
  const playtestCodeCooldownIntervalRef = useRef<number | null>(null);
  // Ref so the code-entry overlay (rendered outside the scene IIFE) can call applyUseEffect.
  const applyUseEffectRef = useRef<((ue: any) => void) | null>(null);
  // Per-scene states: track cross-scene effect results.
  const [playtestPerSceneStates, setPlaytestPerSceneStates] = useState<Record<string, { shownItemIds: string[]; hiddenItemIds: string[]; enabledHotspotIds: string[]; disabledHotspotIds: string[] }>>({});
  const [playtestSceneState, setPlaytestSceneState] = useState<{
    hiddenItemIds: string[];
    shownItemIds: string[];
    disabledHotspotIds: string[]; // stores designer zone ids in playtest
    enabledHotspotIds: string[]; // stores designer zone ids in playtest
    itemStates: Record<string, string>;
    itemImageOverrides: Record<string, string>;
    itemAlphaOverrides: Record<string, number>;
    itemScaleOverrides: Record<string, number>;
    itemRotationOverrides: Record<string, number>;
    itemTintOverrides: Record<string, string>;
  }>({ hiddenItemIds: [], shownItemIds: [], disabledHotspotIds: [], enabledHotspotIds: [], itemStates: {}, itemImageOverrides: {}, itemAlphaOverrides: {}, itemScaleOverrides: {}, itemRotationOverrides: {}, itemTintOverrides: {} });
  const [playtestModal, setPlaytestModal] = useState<null | {
    title: string;
    content: string;
    imageUrl?: string | null;
    choices?: Array<{
      label: string;
      modalContent: string;
      triggersEffect?: InteractiveZone['useEffect'];
      completesRoom?: boolean;
      completionVariant?: string;
    }>;
  }>(null);
  const [previewImageError, setPreviewImageError] = useState<string | null>(null);
  const [previewProxying, setPreviewProxying] = useState(false);
  // Track upload status and errors for each item by scene/item index
  const [itemUploadState, setItemUploadState] = useState<Record<string, { uploading: boolean; error: string }>>({});
  // Track upload status and errors for each zone (for modal image overrides)
  const [zoneUploadState, setZoneUploadState] = useState<Record<string, { uploading: boolean; error: string }>>({});
  // Track upload status for sprite state images: key is `sprite-${sceneIdx}-${itemIdx}-${stateIdx}`
  const [spriteStateUploadState, setSpriteStateUploadState] = useState<Record<string, { uploading: boolean; error: string }>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const previewRef = useRef<HTMLDivElement | null>(null);
  const playtestInventoryRef = useRef<HTMLDivElement | null>(null);
  const playtestPickupTimerRef = useRef<number | null>(null);
  const createFileInputRef = useCallback((idx: number, itemIdx: number) => (el: HTMLInputElement | null) => {
    const key = `${idx}-${itemIdx}`;
    fileInputRefs.current[key] = el;
  }, []);

  const clearPlaytestPickupTimer = useCallback(() => {
    if (playtestPickupTimerRef.current !== null) {
      window.clearTimeout(playtestPickupTimerRef.current);
      playtestPickupTimerRef.current = null;
    }
  }, []);

  const dismissPlaytestPendingPickup = useCallback(() => {
    clearPlaytestPickupTimer();
    setPlaytestPendingPickup(null);
    setPlaytestPickupPhase('reveal');
    setPlaytestPickupFlight(null);
    setPlaytestPickupRevealMotion(null);
  }, [clearPlaytestPickupTimer]);

  const confirmPlaytestPendingPickup = useCallback(() => {
    if (!playtestPendingPickup) return;

    const previewRect = previewRef.current?.getBoundingClientRect();
    const invRect = playtestInventoryRef.current?.getBoundingClientRect();
    const startX = previewRect ? previewRect.left + previewRect.width * 0.5 : window.innerWidth * 0.5;
    const startY = previewRect ? previewRect.top + previewRect.height * 0.52 : window.innerHeight * 0.5;
    const targetX = invRect ? invRect.left + Math.min(90, invRect.width * 0.28) : window.innerWidth - 220;
    const targetY = invRect ? invRect.top + 48 : window.innerHeight - 180;

    setPlaytestPickupFlight({
      dx: targetX - startX,
      dy: targetY - startY,
      scale: 0.35,
    });
    setPlaytestPickupPhase('toInventory');
    clearPlaytestPickupTimer();

    const picked = playtestPendingPickup;
    playtestPickupTimerRef.current = window.setTimeout(() => {
      setPlaytestInventoryItemIds(prev => (prev.includes(picked.itemId) ? prev : [...prev, picked.itemId]));
      setPlaytestMessage(`Picked up ${picked.itemName}.`);
      setPlaytestSelectedInventoryItemId(null);
      setPlaytestModal(null);
      setPlaytestPendingPickup(null);
      setPlaytestPickupPhase('reveal');
      setPlaytestPickupFlight(null);
      setPlaytestPickupRevealMotion(null);
      playtestPickupTimerRef.current = null;
    }, 760);
  }, [playtestPendingPickup, clearPlaytestPickupTimer]);

  // Background upload state (per scene index)
  const [bgUploadState, setBgUploadState] = useState<Record<number, { uploading: boolean; error?: string }>>({});
  const MAX_CLIENT_UPLOAD = 50 * 1024 * 1024; // 50MB client-side quick check

  // selection & resizing state for items/zones in the canvas preview
  const [selectedItem, setSelectedItem] = useState<{ sceneIdx: number; itemIdx: number } | null>(null);
  const [selectedZone, setSelectedZone] = useState<{ sceneIdx: number; zoneIdx: number } | null>(null);
  const resizingRef = useRef<null | {
    kind: 'item' | 'zone';
    sceneIdx: number;
    idx: number; // itemIdx or zoneIdx depending on kind
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    handle: 'nw' | 'ne' | 'sw' | 'se';
    aspect?: number;
  }>(null);

  const draggingItemRef = useRef<null | {
    sceneIdx: number;
    itemIdx: number;
    pointerId: number;
    offsetX: number;
    offsetY: number;
    parentRect: DOMRect;
    itemW: number;
    itemH: number;
    raf: number | null;
    latestClientX: number;
    latestClientY: number;
  }>(null);

  const draggingZoneRef = useRef<null | {
    sceneIdx: number;
    zoneIdx: number;
    pointerId: number;
    offsetX: number;
    offsetY: number;
    parentRect: DOMRect;
    zoneW: number;
    zoneH: number;
    raf: number | null;
    latestClientX: number;
    latestClientY: number;
  }>(null);


  // Remove non-serializable fields from scenes before passing data to parent
  const getSerializableScenes = () =>
    scenes.map(scene => ({
      ...scene,
      items: scene.items,
      interactiveZones: scene.interactiveZones,
    }));

  // Notify parent of changes
  const notifyParent = () => {
    const serializableScenes = getSerializableScenes();
    if (typeof window !== 'undefined' && typeof (window as any).onEscapeRoomDesignerChange === 'function') {
      (window as any).onEscapeRoomDesignerChange({ title, description, timeLimit, startMode, playerMode, scenes: serializableScenes, userSpecialties });
    }
    if (typeof onChange === 'function') {
      onChange({ title, description, timeLimit, startMode, playerMode, scenes: serializableScenes, userSpecialties });
    }
  };

  useEffect(() => {
    if (initialData) {
      if (initialData.title !== undefined && initialData.title !== title) setTitle(initialData.title || "");
      if (initialData.description !== undefined && initialData.description !== description) setDescription(initialData.description || "");
      if (initialData.timeLimit !== undefined && initialData.timeLimit !== timeLimit) setTimeLimit(initialData.timeLimit || 1200);
      if (initialData.startMode !== undefined && initialData.startMode !== startMode) setStartMode(initialData.startMode || 'leader-start');
      if (initialData.playerMode !== undefined && initialData.playerMode !== playerMode) setPlayerMode(initialData.playerMode || 'shared');
      if (initialData.scenes && JSON.stringify(initialData.scenes) !== JSON.stringify(scenes)) setScenes(initialData.scenes || []);
      if (initialData.userSpecialties && JSON.stringify(initialData.userSpecialties) !== JSON.stringify(userSpecialties)) setUserSpecialties(initialData.userSpecialties || []);
    }
  }, [initialData]);

  // Debug: log preview scene backgroundUrl whenever scenes or preview index change
  useEffect(() => {
    try {
      const url = scenes?.[previewSceneIdx]?.backgroundUrl;
      // eslint-disable-next-line no-console
      console.log('[Designer] Preview scene backgroundUrl:', url);
    } catch (e) {
      // ignore
    }
  }, [scenes, previewSceneIdx]);

  // Reset playtest whenever Playtest mode is entered.
  useEffect(() => {
    if (previewMode !== 'playtest') return;
    setPlaytestSceneIdx(Math.max(0, Math.min(previewSceneIdx, Math.max(0, scenes.length - 1))));
    setPlaytestInventoryItemIds([]);
    setPlaytestSelectedInventoryItemId(null);
    setPlaytestSceneState({ hiddenItemIds: [], shownItemIds: [], disabledHotspotIds: [], enabledHotspotIds: [], itemStates: {}, itemImageOverrides: {}, itemAlphaOverrides: {}, itemScaleOverrides: {}, itemRotationOverrides: {}, itemTintOverrides: {} });
    setPlaytestMessage('');
    setPlaytestCompleted(false);
    setPlaytestModal(null);
    clearPlaytestPickupTimer();
    setPlaytestPendingPickup(null);
    setPlaytestPickupFlight(null);
    setPlaytestPickupRevealMotion(null);
    setPlaytestPickupPhase('reveal');
    setPlaytestCodeEntry(null);
    setPlaytestCodeInput('');
    setPlaytestCodeError('');
    setPlaytestCodeCooldownRemaining(0);
    setPlaytestPerSceneStates({});
    setPlaytestPlayerSlot(1);
    if (playtestCodeCooldownIntervalRef.current !== null) {
      window.clearInterval(playtestCodeCooldownIntervalRef.current);
      playtestCodeCooldownIntervalRef.current = null;
    }
  }, [previewMode, previewSceneIdx, scenes.length, clearPlaytestPickupTimer]);

  useEffect(() => {
    return () => {
      clearPlaytestPickupTimer();
      if (playtestCodeCooldownIntervalRef.current !== null) {
        window.clearInterval(playtestCodeCooldownIntervalRef.current);
        playtestCodeCooldownIntervalRef.current = null;
      }
    };
  }, [clearPlaytestPickupTimer]);

  // When playerMode is 'assigned' and player slot changes in playtest, auto-navigate to the assigned scene.
  useEffect(() => {
    if (previewMode !== 'playtest' || playerMode !== 'assigned') return;
    const assignedSceneIdx = scenes.findIndex(
      (s) => Array.isArray(s.assignedPlayerSlots) && s.assignedPlayerSlots.includes(playtestPlayerSlot)
    );
    if (assignedSceneIdx >= 0) setPlaytestSceneIdx(assignedSceneIdx);
  }, [playtestPlayerSlot, previewMode, playerMode, scenes]);

  // Call notifyParent whenever tracked fields change
  useEffect(() => {
    notifyParent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, timeLimit, startMode, playerMode, scenes, userSpecialties]);

  return (
    <div className="max-w-4xl mx-auto py-8 text-white">
      <h1 className="text-3xl font-bold mb-6 text-white">Escape Room Designer</h1>
      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2 text-white">General Info</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-white">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="border rounded px-2 py-1 w-full bg-slate-800 text-white" />
          </div>
          <div>
            <label className="block text-sm text-white">Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)} className="border rounded px-2 py-1 w-full bg-slate-800 text-white" />
          </div>
          <div>
          </div>
          <div>
          </div>
          <div>
            <label className="block text-sm text-white">Time Limit (seconds)</label>
            <input type="number" min={60} value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value))} className="border rounded px-2 py-1 w-full bg-slate-800 text-white" />
          </div>
          <div>
            <label className="block text-sm text-white">Team Size</label>
            <div className="text-sm text-gray-200">Fixed: 4 players (team-only)</div>
          </div>
          <div>
            <label className="block text-sm text-white">Start Mode</label>
            <select value={startMode} onChange={e => setStartMode(e.target.value)} className="border rounded px-2 py-1 w-full bg-slate-800 text-white">
              <option value="leader-start">Leader starts the session</option>
              <option value="auto-on-4">Auto start when 4 players joined</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-white font-semibold">Player Mode</label>
            <select value={playerMode} onChange={e => setPlayerMode(e.target.value as 'shared' | 'assigned')} className="border rounded px-2 py-1 w-full bg-slate-800 text-white">
              <option value="shared">Shared Room — all players view the same scene</option>
              <option value="assigned">Assigned Rooms — each player starts in a different scene</option>
            </select>
            <p className="mt-1 text-xs text-gray-400">
              {playerMode === 'assigned'
                ? 'Assign player slots (1–4) to scenes below. Players start in their assigned scene and must cooperate via chat.'
                : 'Classic mode: all players are in the same room and see the same canvas.'}
            </p>
          </div>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Scenes/Rooms</h2>
        {/* List and add/remove scenes (rooms) */}
        <div className="mb-2">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded"
            type="button"
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              setScenes([...scenes, { id: Date.now().toString(), name: '', backgroundUrl: '', description: '', items: [], interactiveZones: [] }]);
            }}
          >
            + Add Scene
          </button>
        </div>
        {/* Scene selector for preview */}
        {scenes.length > 0 && (
          <div className="mb-4 flex gap-2 items-center">
            <span className="text-sm font-semibold">Preview Scene:</span>
            <select value={previewSceneIdx} onChange={e => setPreviewSceneIdx(Number(e.target.value))} className="border rounded px-2 py-1">
              {scenes.map((scene, idx) => (
                <option key={scene.id} value={idx}>{scene.name || `Scene ${idx + 1}`}</option>
              ))}
            </select>

            <button
              type="button"
              className={previewMode === 'playtest' ? 'bg-emerald-600 text-white px-3 py-1 rounded text-sm' : 'bg-slate-700 text-white px-3 py-1 rounded text-sm'}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setPreviewMode(prev => (prev === 'playtest' ? 'edit' : 'playtest'));
              }}
            >
              {previewMode === 'playtest' ? 'Exit Playtest' : 'Playtest'}
            </button>
          </div>
        )}
        {/* Live preview */}
        {scenes.length > 0 && previewMode === 'playtest' && (
          <div>
            <div className="mb-2 text-xs text-gray-300 flex flex-wrap items-center gap-3">
              <span>Playtest: click Collect zones to pick up items. Select an inventory item, then click a zone to use it.</span>
              {playerMode === 'assigned' && (
                <span className="flex items-center gap-1 flex-wrap">
                  <span className="font-semibold text-amber-300">Simulating player slot:</span>
                  {([1, 2, 3, 4] as const).map(slot => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setPlaytestPlayerSlot(slot)}
                      className={`px-2 py-0.5 rounded text-xs border ${
                        playtestPlayerSlot === slot
                          ? 'bg-amber-500 text-black border-amber-400 font-bold'
                          : 'bg-slate-700 text-gray-200 border-slate-500 hover:bg-slate-600'
                      }`}
                    >
                      P{slot}
                    </button>
                  ))}
                </span>
              )}
            </div>

            <div
              ref={previewRef}
              className="mb-3 border rounded-lg overflow-hidden"
              style={{ background: '#222', minHeight: 320, position: 'relative', width: 600, maxWidth: '100%' }}
              onClick={() => {
                // Clicking empty background clears inventory selection and closes modal.
                setPlaytestSelectedInventoryItemId(null);
                setPlaytestModal(null);
              }}
            >
              {/* Background image */}
              {scenes[playtestSceneIdx]?.backgroundUrl ? (
                <>
                  <img
                    src={previewProxying ? `/api/image-proxy?url=${encodeURIComponent(scenes[playtestSceneIdx].backgroundUrl)}` : scenes[playtestSceneIdx].backgroundUrl}
                    alt="Background"
                    style={{ width: '100%', height: 320, objectFit: 'cover', display: 'block' }}
                    onLoad={() => {
                      setPreviewImageError(null);
                    }}
                    onError={() => {
                      if (!previewProxying) {
                        setPreviewImageError('Failed to load preview image; retrying via server proxy...');
                        setPreviewProxying(true);
                      } else {
                        setPreviewImageError('Failed to load preview image (proxy failed or URL invalid)');
                      }
                    }}
                  />
                  {previewImageError && (
                    <div style={{ padding: 8, color: '#ff7b7b', fontSize: 12 }}>{previewImageError}</div>
                  )}
                </>
              ) : null}

              {(() => {
                const scene = scenes[playtestSceneIdx];
                if (!scene) return null;

                const hiddenItemIds = new Set<string>(Array.isArray(playtestSceneState.hiddenItemIds) ? playtestSceneState.hiddenItemIds : []);
                const shownItemIds = new Set<string>(Array.isArray(playtestSceneState.shownItemIds) ? playtestSceneState.shownItemIds : []);
                const disabledZoneIds = new Set<string>(Array.isArray(playtestSceneState.disabledHotspotIds) ? playtestSceneState.disabledHotspotIds : []);
                const enabledZoneIds = new Set<string>(Array.isArray(playtestSceneState.enabledHotspotIds) ? playtestSceneState.enabledHotspotIds : []);
                const itemStates = playtestSceneState.itemStates && typeof playtestSceneState.itemStates === 'object' ? playtestSceneState.itemStates : {};
                const itemImageOverrides = playtestSceneState.itemImageOverrides && typeof playtestSceneState.itemImageOverrides === 'object' ? playtestSceneState.itemImageOverrides : {};
                const itemAlphaOverrides = playtestSceneState.itemAlphaOverrides && typeof playtestSceneState.itemAlphaOverrides === 'object' ? playtestSceneState.itemAlphaOverrides : {};
                const itemScaleOverrides = playtestSceneState.itemScaleOverrides && typeof playtestSceneState.itemScaleOverrides === 'object' ? playtestSceneState.itemScaleOverrides : {};
                const itemRotationOverrides = playtestSceneState.itemRotationOverrides && typeof playtestSceneState.itemRotationOverrides === 'object' ? playtestSceneState.itemRotationOverrides : {};
                const itemTintOverrides = playtestSceneState.itemTintOverrides && typeof playtestSceneState.itemTintOverrides === 'object' ? playtestSceneState.itemTintOverrides : {};
                const inventorySet = new Set<string>(Array.isArray(playtestInventoryItemIds) ? playtestInventoryItemIds : []);

                const isItemVisible = (it: any) => {
                  const id = typeof it?.id === 'string' ? it.id : '';
                  if (!id) return true;
                  if (inventorySet.has(id)) return false;
                  const hiddenByDefault = !!it?.properties?.hiddenByDefault;
                  if (hiddenByDefault && !shownItemIds.has(id)) return false;
                  if (hiddenItemIds.has(id) && !shownItemIds.has(id)) return false;
                  return true;
                };

                const isZoneEnabled = (z: any) => {
                  const zid = typeof z?.id === 'string' ? z.id : '';
                  if (!zid) return true;
                  const disabledByDefault = z?.disabledByDefault === true;
                  const isEnabled = enabledZoneIds.has(zid);
                  const isDisabled = disabledZoneIds.has(zid);
                  if (disabledByDefault && !isEnabled) return false;
                  if (isDisabled && !isEnabled) return false;
                  return true;
                };

                const findItemById = (id: string) => {
                  for (const s of scenes) {
                    const found = s?.items?.find((it: any) => it?.id === id);
                    if (found) return found;
                  }
                  return null;
                };

                const resolveItemImage = (item: any): string => {
                  const itemId = typeof item?.id === 'string' ? item.id : '';
                  if (!itemId) return typeof item?.imageUrl === 'string' ? item.imageUrl : '';
                  const overrideImage = itemImageOverrides[itemId];
                  if (typeof overrideImage === 'string' && overrideImage.trim()) return overrideImage;

                  const stateKey = itemStates[itemId];
                  const spriteStates = item?.properties?.spriteStates;
                  if (typeof stateKey === 'string' && stateKey.trim() && spriteStates && typeof spriteStates === 'object') {
                    const stateImage = spriteStates[stateKey];
                    if (typeof stateImage === 'string' && stateImage.trim()) return stateImage;
                  }

                  return typeof item?.imageUrl === 'string' ? item.imageUrl : '';
                };

                const resolveItemVisual = (item: any) => {
                  const itemId = typeof item?.id === 'string' ? item.id : '';
                  const alphaRaw = itemId ? Number(itemAlphaOverrides[itemId]) : NaN;
                  const scaleRaw = itemId ? Number(itemScaleOverrides[itemId]) : NaN;
                  const rotationRaw = itemId ? Number(itemRotationOverrides[itemId]) : NaN;
                  const tintRaw = itemId ? itemTintOverrides[itemId] : '';
                  const alpha = Number.isFinite(alphaRaw) ? Math.max(0, Math.min(1, alphaRaw)) : 1;
                  const scale = Number.isFinite(scaleRaw) && scaleRaw > 0 ? Math.max(0.1, Math.min(5, scaleRaw)) : 1;
                  const rotationDeg = Number.isFinite(rotationRaw) ? rotationRaw : 0;
                  const tint = typeof tintRaw === 'string' && tintRaw.trim().length > 0 ? tintRaw.trim() : '';
                  return { alpha, scale, rotationDeg, tint };
                };

                const applyUseEffect = (useEffect: any, sourceZone?: any) => {
                  const hideItemIds: string[] = Array.isArray(useEffect?.hideItemIds) ? useEffect.hideItemIds.filter((x: any) => typeof x === 'string') : [];
                  const showItemIds: string[] = Array.isArray(useEffect?.showItemIds) ? useEffect.showItemIds.filter((x: any) => typeof x === 'string') : [];
                  const disableHotspotIds: string[] = Array.isArray(useEffect?.disableHotspotIds) ? useEffect.disableHotspotIds.filter((x: any) => typeof x === 'string') : [];
                  const enableHotspotIds: string[] = Array.isArray(useEffect?.enableHotspotIds) ? useEffect.enableHotspotIds.filter((x: any) => typeof x === 'string') : [];
                  const setItemStateByIdEntries: Array<[string, string]> = useEffect?.setItemStateById && typeof useEffect.setItemStateById === 'object'
                    ? Object.entries(useEffect.setItemStateById).filter(([itemId, value]) => typeof itemId === 'string' && typeof value === 'string') as Array<[string, string]>
                    : [];
                  const setItemImageByIdEntries: Array<[string, string]> = useEffect?.setItemImageById && typeof useEffect.setItemImageById === 'object'
                    ? Object.entries(useEffect.setItemImageById).filter(([itemId, value]) => typeof itemId === 'string' && typeof value === 'string') as Array<[string, string]>
                    : [];
                  const setItemAlphaByIdEntries: Array<[string, number]> = useEffect?.setItemAlphaById && typeof useEffect.setItemAlphaById === 'object'
                    ? Object.entries(useEffect.setItemAlphaById)
                        .filter(([itemId, value]) => typeof itemId === 'string' && Number.isFinite(Number(value)))
                        .map(([itemId, value]) => [itemId, Math.max(0, Math.min(1, Number(value)))])
                    : [];
                  const setItemScaleByIdEntries: Array<[string, number]> = useEffect?.setItemScaleById && typeof useEffect.setItemScaleById === 'object'
                    ? Object.entries(useEffect.setItemScaleById)
                        .filter(([itemId, value]) => typeof itemId === 'string' && Number.isFinite(Number(value)) && Number(value) > 0)
                        .map(([itemId, value]) => [itemId, Math.max(0.1, Math.min(5, Number(value)))])
                    : [];
                  const setItemRotationByIdEntries: Array<[string, number]> = useEffect?.setItemRotationById && typeof useEffect.setItemRotationById === 'object'
                    ? Object.entries(useEffect.setItemRotationById)
                        .filter(([itemId, value]) => typeof itemId === 'string' && Number.isFinite(Number(value)))
                        .map(([itemId, value]) => [itemId, Number(value)])
                    : [];
                  const setItemTintByIdEntries: Array<[string, string]> = useEffect?.setItemTintById && typeof useEffect.setItemTintById === 'object'
                    ? Object.entries(useEffect.setItemTintById).filter(([itemId, value]) => typeof itemId === 'string' && typeof value === 'string') as Array<[string, string]>
                    : [];

                  setPlaytestSceneState(prev => {
                    const nextHidden = new Set<string>(Array.isArray(prev.hiddenItemIds) ? prev.hiddenItemIds : []);
                    const nextShown = new Set<string>(Array.isArray(prev.shownItemIds) ? prev.shownItemIds : []);
                    const nextDisabled = new Set<string>(Array.isArray(prev.disabledHotspotIds) ? prev.disabledHotspotIds : []);
                    const nextEnabled = new Set<string>(Array.isArray(prev.enabledHotspotIds) ? prev.enabledHotspotIds : []);
                    const nextItemStates: Record<string, string> = { ...(prev.itemStates && typeof prev.itemStates === 'object' ? prev.itemStates : {}) };
                    const nextItemImageOverrides: Record<string, string> = { ...(prev.itemImageOverrides && typeof prev.itemImageOverrides === 'object' ? prev.itemImageOverrides : {}) };
                    const nextItemAlphaOverrides: Record<string, number> = { ...(prev.itemAlphaOverrides && typeof prev.itemAlphaOverrides === 'object' ? prev.itemAlphaOverrides : {}) };
                    const nextItemScaleOverrides: Record<string, number> = { ...(prev.itemScaleOverrides && typeof prev.itemScaleOverrides === 'object' ? prev.itemScaleOverrides : {}) };
                    const nextItemRotationOverrides: Record<string, number> = { ...(prev.itemRotationOverrides && typeof prev.itemRotationOverrides === 'object' ? prev.itemRotationOverrides : {}) };
                    const nextItemTintOverrides: Record<string, string> = { ...(prev.itemTintOverrides && typeof prev.itemTintOverrides === 'object' ? prev.itemTintOverrides : {}) };

                    for (const id of hideItemIds) {
                      nextHidden.add(id);
                      nextShown.delete(id);
                    }
                    for (const id of showItemIds) {
                      nextShown.add(id);
                      nextHidden.delete(id);
                    }
                    for (const id of disableHotspotIds) {
                      nextDisabled.add(id);
                      nextEnabled.delete(id);
                    }
                    for (const id of enableHotspotIds) {
                      nextEnabled.add(id);
                      nextDisabled.delete(id);
                    }
                    for (const [itemId, stateValue] of setItemStateByIdEntries) {
                      const trimmed = stateValue.trim();
                      if (trimmed) nextItemStates[itemId] = trimmed;
                      else delete nextItemStates[itemId];
                    }
                    for (const [itemId, imageValue] of setItemImageByIdEntries) {
                      const trimmed = imageValue.trim();
                      if (trimmed) nextItemImageOverrides[itemId] = trimmed;
                      else delete nextItemImageOverrides[itemId];
                    }
                    for (const [itemId, alphaValue] of setItemAlphaByIdEntries) {
                      nextItemAlphaOverrides[itemId] = alphaValue;
                    }
                    for (const [itemId, scaleValue] of setItemScaleByIdEntries) {
                      nextItemScaleOverrides[itemId] = scaleValue;
                    }
                    for (const [itemId, rotationValue] of setItemRotationByIdEntries) {
                      nextItemRotationOverrides[itemId] = rotationValue;
                    }
                    for (const [itemId, tintValue] of setItemTintByIdEntries) {
                      const trimmed = tintValue.trim();
                      if (trimmed) nextItemTintOverrides[itemId] = trimmed;
                      else delete nextItemTintOverrides[itemId];
                    }

                    return {
                      hiddenItemIds: Array.from(nextHidden),
                      shownItemIds: Array.from(nextShown),
                      disabledHotspotIds: Array.from(nextDisabled),
                      enabledHotspotIds: Array.from(nextEnabled),
                      itemStates: nextItemStates,
                      itemImageOverrides: nextItemImageOverrides,
                      itemAlphaOverrides: nextItemAlphaOverrides,
                      itemScaleOverrides: nextItemScaleOverrides,
                      itemRotationOverrides: nextItemRotationOverrides,
                      itemTintOverrides: nextItemTintOverrides,
                    };
                  });

                  // Handle cross-scene effects (stored in perSceneStates for inspection when switching scenes)
                  if (Array.isArray(useEffect?.crossSceneEffects)) {
                    const crossEffects: typeof useEffect.crossSceneEffects = useEffect.crossSceneEffects;
                    const affectedNames: string[] = [];
                    setPlaytestPerSceneStates(prev => {
                      const next = { ...prev };
                      for (const cse of crossEffects) {
                        const sId = typeof cse?.sceneId === 'string' ? cse.sceneId : '';
                        if (!sId) continue;
                        const targetScene = scenes.find(s => s.id === sId);
                        affectedNames.push(targetScene?.name || sId);
                        const existing = next[sId] || { shownItemIds: [], hiddenItemIds: [], enabledHotspotIds: [], disabledHotspotIds: [] };
                        const shown = new Set(existing.shownItemIds);
                        const hidden = new Set(existing.hiddenItemIds);
                        const enabled = new Set(existing.enabledHotspotIds);
                        const disabled = new Set(existing.disabledHotspotIds);
                        for (const id of (cse.showItemIds || [])) { shown.add(id); hidden.delete(id); }
                        for (const id of (cse.hideItemIds || [])) { hidden.add(id); shown.delete(id); }
                        for (const id of (cse.enableHotspotIds || [])) { enabled.add(id); disabled.delete(id); }
                        for (const id of (cse.disableHotspotIds || [])) { disabled.add(id); enabled.delete(id); }
                        next[sId] = { shownItemIds: Array.from(shown), hiddenItemIds: Array.from(hidden), enabledHotspotIds: Array.from(enabled), disabledHotspotIds: Array.from(disabled) };
                      }
                      return next;
                    });
                    if (affectedNames.length) {
                      setPlaytestMessage(`Cross-scene effects applied → ${affectedNames.join(', ')} (navigate to that scene to verify)`);
                    }
                  }

                  // Handle room completion
                  if (useEffect?.completesRoom) {
                    const variant = typeof useEffect.completionVariant === 'string' && useEffect.completionVariant.trim()
                      ? useEffect.completionVariant.trim()
                      : '';
                    setPlaytestCompleted(true);
                    setPlaytestMessage(`Room complete${variant ? ` — ${variant}` : ''} (playtest)`);
                  }
                };

                // Expose to the code-entry overlay (which renders outside this IIFE scope).
                applyUseEffectRef.current = applyUseEffect;

                const handleZoneClick = (z: any) => {
                  if (playtestPendingPickup) return;
                  const zid = typeof z?.id === 'string' ? z.id : '';
                  const label = (typeof z?.label === 'string' && z.label.trim()) ? z.label.trim() : (zid || 'Zone');
                  const hasSelected = !!playtestSelectedInventoryItemId;

                  // "Use" behavior if an inventory item is selected
                  if (hasSelected) {
                    const selectedId = playtestSelectedInventoryItemId as string;
                    if (z?.requiredItemId && z.requiredItemId !== selectedId) {
                      setPlaytestMessage(`That item doesn't work here.`);
                      return;
                    }

                    const useEffect = z?.useEffect && typeof z.useEffect === 'object' ? z.useEffect : null;
                    if (useEffect) {
                      applyUseEffect(useEffect);
                      const consume = z?.consumeItemOnUse !== false;
                      if (consume) {
                        setPlaytestInventoryItemIds(prev => prev.filter(x => x !== selectedId));
                      }
                      const item = findItemById(selectedId);
                      setPlaytestMessage(`Used ${(item?.name || selectedId)} on ${label}.`);
                      setPlaytestSelectedInventoryItemId(null);
                      return;
                    }

                    // Fallback: trigger semantics
                    if ((z?.actionType || '') === 'trigger') {
                      const nextIdx = playtestSceneIdx + 1;
                      if (nextIdx >= scenes.length) {
                        setPlaytestCompleted(true);
                        setPlaytestMessage('Completed (playtest).');
                      } else {
                        setPlaytestSceneIdx(nextIdx);
                        setPlaytestMessage(`Moved to scene ${nextIdx + 1}.`);
                      }
                      const consume = z?.consumeItemOnUse !== false;
                      if (consume) {
                        setPlaytestInventoryItemIds(prev => prev.filter(x => x !== selectedId));
                      }
                      setPlaytestSelectedInventoryItemId(null);
                      return;
                    }

                    setPlaytestMessage('Nothing happens.');
                    return;
                  }

                  // Normal click behavior when no inventory item is selected
                  if ((z?.actionType || '') === 'collect') {
                    const collectItemId = typeof z?.collectItemId === 'string' ? z.collectItemId : '';
                    if (!collectItemId) {
                      setPlaytestMessage('Collect zone has no item configured.');
                      return;
                    }
                    const sceneItem = scene?.items?.find((it: any) => it?.id === collectItemId) || null;
                    const item = sceneItem || findItemById(collectItemId);
                    const presetRaw = typeof z?.pickupAnimationPreset === 'string' ? z.pickupAnimationPreset : 'cinematic';
                    const preset: PickupAnimationPreset =
                      presetRaw === 'quickSpin' || presetRaw === 'floatIn' || presetRaw === 'powerDrop'
                        ? presetRaw
                        : 'cinematic';
                    clearPlaytestPickupTimer();
                    setPlaytestPickupFlight(null);
                    const itemX = typeof sceneItem?.x === 'number' ? sceneItem.x : 20;
                    const itemY = typeof sceneItem?.y === 'number' ? sceneItem.y : 20;
                    const itemW = typeof sceneItem?.w === 'number' ? sceneItem.w : 48;
                    const itemH = typeof sceneItem?.h === 'number' ? sceneItem.h : 48;
                    const previewRect = previewRef.current?.getBoundingClientRect();
                    if (previewRect) {
                      const centerX = previewRect.width * 0.5;
                      const centerY = previewRect.height * 0.46;
                      const itemCenterX = itemX + itemW * 0.5;
                      const itemCenterY = itemY + itemH * 0.5;
                      const targetWidth = previewRect.width * 0.5;
                      const baseScale = Math.max(2.4, Math.min(8.5, targetWidth / Math.max(16, itemW)));
                      const presetScale =
                        preset === 'quickSpin'
                          ? baseScale * 0.95
                          : preset === 'floatIn'
                          ? baseScale * 0.92
                          : preset === 'powerDrop'
                          ? baseScale * 1.03
                          : baseScale;
                      setPlaytestPickupRevealMotion({
                        dx: centerX - itemCenterX,
                        dy: centerY - itemCenterY,
                        scale: presetScale,
                      });
                    } else {
                      setPlaytestPickupRevealMotion(null);
                    }
                    setPlaytestPickupPhase('reveal');
                    setPlaytestPendingPickup({
                      itemId: collectItemId,
                      itemName: item?.name || collectItemId,
                      imageUrl: item?.imageUrl || '',
                      preset,
                    });
                    setPlaytestMessage('');
                    if (!sceneItem) {
                      setPlaytestPickupPhase('ready');
                    }
                    return;
                  }

                  if ((z?.actionType || '') === 'modal') {
                    const content = typeof z?.modalContent === 'string' ? z.modalContent : '';
                    const imageUrl = typeof z?.imageUrl === 'string' ? z.imageUrl : (typeof z?.itemId === 'string' ? (findItemById(z.itemId)?.imageUrl || null) : null);
                    const choices = Array.isArray(z?.interactions) ? z.interactions.filter((c: any) => c && typeof c.label === 'string' && typeof c.modalContent === 'string') : [];
                    setPlaytestModal({ title: label, content, imageUrl, choices });
                    setPlaytestMessage('');
                    return;
                  }

                  if ((z?.actionType || '') === 'trigger') {
                    const nextIdx = playtestSceneIdx + 1;
                    if (nextIdx >= scenes.length) {
                      setPlaytestCompleted(true);
                      setPlaytestMessage('Completed (playtest).');
                    } else {
                      setPlaytestSceneIdx(nextIdx);
                      setPlaytestMessage(`Moved to scene ${nextIdx + 1}.`);
                    }
                    return;
                  }

                  // Code-entry zone: open code input overlay
                  if ((z?.actionType || '') === 'codeEntry') {
                    const ce = z?.codeEntry;
                    if (!ce || typeof ce.correctCode !== 'string') {
                      setPlaytestMessage('Code entry zone has no correct code configured.');
                      return;
                    }
                    setPlaytestCodeEntry({
                      zoneLabel: label,
                      correctCode: ce.correctCode,
                      caseSensitive: !!ce.caseSensitive,
                      errorMessage: typeof ce.errorMessage === 'string' ? ce.errorMessage : 'Incorrect code. Try again.',
                      cooldownSeconds: typeof ce.cooldownSeconds === 'number' && ce.cooldownSeconds > 0 ? ce.cooldownSeconds : 0,
                      maxAttempts: typeof ce.maxAttempts === 'number' && ce.maxAttempts > 0 ? ce.maxAttempts : 0,
                      attemptsLeft: typeof ce.maxAttempts === 'number' && ce.maxAttempts > 0 ? ce.maxAttempts : 999,
                      cooldownEndTs: null,
                      triggerEffect: z?.useEffect || null,
                      completesRoom: !!(z?.useEffect?.completesRoom),
                      completionVariant: typeof z?.useEffect?.completionVariant === 'string' ? z.useEffect.completionVariant : '',
                      displayItemId: typeof ce.displayItemId === 'string' && ce.displayItemId.trim() ? ce.displayItemId.trim() : undefined,
                    });
                    setPlaytestCodeInput('');
                    setPlaytestCodeError('');
                    setPlaytestMessage('');
                    return;
                  }
                };

                return (
                  <>
                    {/* Visible items */}
                    {scene.items.filter(isItemVisible).map((item: any, i: number) => (
                      (() => {
                        const visual = resolveItemVisual(item);
                        const isPickupRevealItem =
                          !!playtestPendingPickup &&
                          playtestPickupPhase === 'reveal' &&
                          playtestPendingPickup.itemId === item.id;
                        const pickupRevealClass = isPickupRevealItem
                          ? playtestPendingPickup.preset === 'quickSpin'
                            ? 'designer-pickup-reveal-quick-spin'
                            : playtestPendingPickup.preset === 'floatIn'
                            ? 'designer-pickup-reveal-float-in'
                            : playtestPendingPickup.preset === 'powerDrop'
                            ? 'designer-pickup-reveal-power-drop'
                            : 'designer-pickup-reveal-cinematic'
                          : '';
                        const pickupRevealStyle =
                          isPickupRevealItem && playtestPickupRevealMotion
                            ? ({
                                ['--designer-pickup-reveal-dx' as any]: `${playtestPickupRevealMotion.dx}px`,
                                ['--designer-pickup-reveal-dy' as any]: `${playtestPickupRevealMotion.dy}px`,
                                ['--designer-pickup-reveal-scale' as any]: `${playtestPickupRevealMotion.scale}`,
                              } as React.CSSProperties)
                            : undefined;
                        return (
                      <div
                        key={item.id}
                        className={pickupRevealClass}
                        onAnimationEnd={isPickupRevealItem ? () => setPlaytestPickupPhase('ready') : undefined}
                        style={{
                          position: 'absolute',
                          left: item.x ?? (20 + i * 60),
                          top: item.y ?? 20,
                          zIndex: isPickupRevealItem ? 80 : 2,
                          borderRadius: 4,
                          padding: 2,
                          minWidth: 40,
                          textAlign: 'center',
                          userSelect: 'none',
                          touchAction: 'none',
                          opacity: isPickupRevealItem ? 1 : visual.alpha,
                          transform: isPickupRevealItem ? undefined : `scale(${visual.scale}) rotate(${visual.rotationDeg}deg)`,
                          transformOrigin: 'center center',
                          filter: visual.tint ? `drop-shadow(5px 10px 6px rgba(0,0,0,0.55)) drop-shadow(0 0 0 ${visual.tint}) saturate(1.1)` : 'drop-shadow(5px 10px 6px rgba(0,0,0,0.55))',
                          pointerEvents: isPickupRevealItem ? 'none' : 'auto',
                          ...pickupRevealStyle,
                        }}
                      >
                        {resolveItemImage(item) ? (
                          <img
                            src={resolveItemImage(item)}
                            alt={item.name}
                            style={{ width: (item.w ?? 48), height: (item.h ?? 48), objectFit: 'contain', display: 'block', borderRadius: 4 }}
                            draggable={false}
                          />
                        ) : (
                          <div style={{ width: 48, height: 48, background: 'rgba(255,255,255,0.15)', borderRadius: 4 }} />
                        )}
                      </div>
                        );
                      })()
                    ))}

                    {/* Terminal code-entry overlay: renders typed characters on the designated display item */}
                    {(() => {
                      if (!playtestCodeEntry?.displayItemId) return null;
                      const termItem = scene.items.find((it: any) => it.id === playtestCodeEntry.displayItemId);
                      if (!termItem) return null;
                      const tx = termItem.x ?? 20;
                      const ty = termItem.y ?? 20;
                      const tw = termItem.w ?? 48;
                      const th = termItem.h ?? 48;
                      const dotCount = playtestCodeInput.length;
                      const dots = '●'.repeat(dotCount);
                      return (
                        <div
                          style={{
                            position: 'absolute',
                            left: tx,
                            top: ty,
                            width: tw,
                            height: th,
                            zIndex: 10,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            pointerEvents: 'none',
                          }}
                        >
                          <div style={{
                            background: 'rgba(0,0,0,0.72)',
                            borderRadius: 3,
                            padding: '2px 5px',
                            fontFamily: 'monospace',
                            fontSize: Math.max(9, Math.floor(tw / 8)),
                            color: '#00ff88',
                            textShadow: '0 0 6px #00ff88',
                            lineHeight: 1.3,
                            textAlign: 'center',
                            letterSpacing: 2,
                            whiteSpace: 'pre',
                          }}>
                            <div style={{ fontSize: Math.max(7, Math.floor(tw / 12)), color: '#00cc66', opacity: 0.8 }}>ENTER CODE</div>
                            <div>{dots || ''}<span style={{ animation: 'blink 1s step-end infinite', opacity: 1 }}>_</span></div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Enabled zones */}
                    {scene.interactiveZones.filter(isZoneEnabled).map((z: any) => (
                      <div
                        key={z.id}
                        onClick={(ev) => { ev.stopPropagation(); handleZoneClick(z); }}
                        title={z.label || z.id}
                        style={{
                          position: 'absolute',
                          left: z.x ?? 0,
                          top: z.y ?? 0,
                          width: z.width ?? 64,
                          height: z.height ?? 64,
                          zIndex: 3,
                          border: playtestSelectedInventoryItemId ? '2px solid rgba(34,197,94,0.9)' : '2px solid rgba(59,130,246,0.8)',
                          background: 'rgba(0,0,0,0.15)',
                          cursor: 'pointer',
                          boxSizing: 'border-box',
                          borderRadius: 6,
                        }}
                      />
                    ))}

                    {/* Modal */}
                    {playtestModal && (
                      <div
                        onClick={(ev) => ev.stopPropagation()}
                        style={{
                          position: 'absolute',
                          left: 12,
                          top: 12,
                          right: 12,
                          bottom: 12,
                          background: 'rgba(10,10,10,0.92)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          borderRadius: 10,
                          padding: 12,
                          zIndex: 20,
                          overflow: 'auto',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                          <div style={{ fontWeight: 700, color: '#fff' }}>{playtestModal.title}</div>
                          <button
                            type="button"
                            className="bg-slate-700 text-white px-3 py-1 rounded text-sm"
                            onClick={() => setPlaytestModal(null)}
                          >
                            Close
                          </button>
                        </div>
                        {playtestModal.imageUrl ? (
                          <div style={{ marginTop: 10 }}>
                            <img src={playtestModal.imageUrl} alt="modal" style={{ maxHeight: 140, borderRadius: 8 }} />
                          </div>
                        ) : null}
                        <div style={{ marginTop: 10, whiteSpace: 'pre-wrap', fontSize: 13, color: 'rgba(255,255,255,0.9)' }}>
                          {playtestModal.content || '(No modal content)'}
                        </div>
                        {Array.isArray(playtestModal.choices) && playtestModal.choices.length > 0 && (
                          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {playtestModal.choices.map((c, idx) => (
                              <button
                                key={`${c.label}-${idx}`}
                                type="button"
                                className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
                                onClick={() => {
                                  setPlaytestModal(prev => prev ? ({ ...prev, content: c.modalContent }) : prev);
                                  if (c.triggersEffect) applyUseEffect(c.triggersEffect);
                                  if (c.completesRoom) {
                                    setPlaytestCompleted(true);
                                    const variant = c.completionVariant || '';
                                    setPlaytestMessage(`Room complete${variant ? ` — ${variant}` : ''} (playtest)`);
                                  }
                                }}
                              >
                                {c.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Completion banner */}
                    {playtestCompleted && (
                      <div style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 30, background: 'rgba(16,185,129,0.9)', color: '#fff', padding: '6px 10px', borderRadius: 8, fontSize: 12 }}>
                        Completed (playtest)
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {playtestPendingPickup ? (
              <div className="fixed inset-0 z-[80] flex items-center justify-center">
                {playtestPickupPhase === 'ready' || playtestPickupPhase === 'toInventory' ? (
                  <div className="absolute inset-0 z-[82] flex items-center justify-center bg-black/65 backdrop-blur-[1px]">
                    <div className="relative w-full max-w-md mx-4 rounded-2xl border border-amber-500/40 bg-neutral-950/95 shadow-2xl overflow-hidden">
                      <div className="px-5 pt-5 pb-2 text-center">
                        <div className="text-xs uppercase tracking-[0.18em] text-amber-300/70">Playtest Pickup</div>
                        <h3 className="mt-1 text-xl font-bold text-amber-50">You found {playtestPendingPickup.itemName}</h3>
                      </div>

                      <div className="relative h-56 flex items-center justify-center">
                        <div
                          className={
                            'designer-pickup-item rounded-xl border border-amber-400/30 bg-neutral-900/80 p-4 shadow-[0_0_35px_rgba(251,191,36,0.35)] ' +
                            (playtestPickupPhase === 'toInventory'
                              ? ` ${
                                  playtestPendingPickup.preset === 'quickSpin'
                                    ? 'designer-pickup-to-inventory-quick-spin'
                                    : playtestPendingPickup.preset === 'floatIn'
                                    ? 'designer-pickup-to-inventory-float-in'
                                    : playtestPendingPickup.preset === 'powerDrop'
                                    ? 'designer-pickup-to-inventory-power-drop'
                                    : 'designer-pickup-to-inventory-cinematic'
                                }`
                              : '')
                          }
                          style={
                            playtestPickupPhase === 'toInventory' && playtestPickupFlight
                              ? ({
                                  ['--designer-pickup-dx' as any]: `${playtestPickupFlight.dx}px`,
                                  ['--designer-pickup-dy' as any]: `${playtestPickupFlight.dy}px`,
                                  ['--designer-pickup-scale' as any]: `${playtestPickupFlight.scale}`,
                                } as React.CSSProperties)
                              : undefined
                          }
                        >
                          {playtestPendingPickup.imageUrl ? (
                            <img src={playtestPendingPickup.imageUrl} alt={playtestPendingPickup.itemName} className="h-32 w-32 object-contain" />
                          ) : (
                            <div className="h-32 w-32 rounded-lg border border-amber-500/25 bg-neutral-900/80" />
                          )}
                        </div>
                      </div>

                      <div className="px-5 pb-5 pt-1 flex gap-3 justify-end">
                        <button
                          type="button"
                          onClick={dismissPlaytestPendingPickup}
                          disabled={playtestPickupPhase === 'toInventory'}
                          className="px-4 py-2 rounded border border-amber-700/50 text-amber-100 hover:bg-amber-950/40 disabled:opacity-50"
                        >
                          Not now
                        </button>
                        <button
                          type="button"
                          onClick={confirmPlaytestPendingPickup}
                          disabled={playtestPickupPhase !== 'ready'}
                          className={
                            'px-4 py-2 rounded font-semibold text-white transition ' +
                            (playtestPickupPhase === 'ready' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-amber-900/70 cursor-not-allowed')
                          }
                        >
                          {playtestPickupPhase === 'toInventory' ? 'Storing…' : 'Add to Inventory'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Code Entry Overlay */}
            {playtestCodeEntry ? (
              <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-[2px]">
                <div className="w-full max-w-sm mx-4 rounded-2xl border border-cyan-500/40 bg-neutral-950/95 shadow-2xl overflow-hidden">
                  <div className="px-5 pt-5 pb-2 text-center">
                    <div className="text-xs uppercase tracking-widest text-cyan-400/70">Code Entry</div>
                    <h3 className="mt-1 text-lg font-bold text-cyan-50">{playtestCodeEntry.zoneLabel}</h3>
                  </div>
                  <div className="px-5 pb-5 space-y-3">
                    <input
                      type="password"
                      value={playtestCodeInput}
                      onChange={e => { setPlaytestCodeInput(e.target.value); setPlaytestCodeError(''); }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const entry = playtestCodeEntry;
                          if (!entry) return;
                          if (entry.cooldownEndTs && Date.now() < entry.cooldownEndTs) return;
                          const input = playtestCodeInput.trim();
                          const correct = entry.caseSensitive
                            ? input === entry.correctCode
                            : input.toLowerCase() === entry.correctCode.toLowerCase();
                          if (correct) {
                            if (entry.triggerEffect) applyUseEffectRef.current?.(entry.triggerEffect);
                            setPlaytestMessage(`✓ Correct code for '${entry.zoneLabel}'.`);
                            setPlaytestCodeEntry(null);
                            setPlaytestCodeInput('');
                            setPlaytestCodeError('');
                          } else {
                            const newAttemptsLeft = entry.attemptsLeft - 1;
                            if (newAttemptsLeft <= 0 && entry.maxAttempts > 0) {
                              setPlaytestCodeError(`${entry.errorMessage} No attempts remaining — code entry locked.`);
                              setPlaytestCodeEntry(prev => prev ? { ...prev, attemptsLeft: 0 } : prev);
                            } else if (entry.cooldownSeconds > 0) {
                              const endTs = Date.now() + entry.cooldownSeconds * 1000;
                              setPlaytestCodeEntry(prev => prev ? { ...prev, attemptsLeft: newAttemptsLeft, cooldownEndTs: endTs } : prev);
                              setPlaytestCodeCooldownRemaining(entry.cooldownSeconds);
                              if (playtestCodeCooldownIntervalRef.current !== null) window.clearInterval(playtestCodeCooldownIntervalRef.current);
                              playtestCodeCooldownIntervalRef.current = window.setInterval(() => {
                                setPlaytestCodeCooldownRemaining(prev => {
                                  if (prev <= 1) {
                                    if (playtestCodeCooldownIntervalRef.current !== null) { window.clearInterval(playtestCodeCooldownIntervalRef.current); playtestCodeCooldownIntervalRef.current = null; }
                                    return 0;
                                  }
                                  return prev - 1;
                                });
                              }, 1000);
                              setPlaytestCodeError(`${entry.errorMessage} Wait ${entry.cooldownSeconds}s before trying again.`);
                            } else {
                              setPlaytestCodeEntry(prev => prev ? { ...prev, attemptsLeft: newAttemptsLeft } : prev);
                              setPlaytestCodeError(entry.errorMessage + (entry.maxAttempts > 0 ? ` (${newAttemptsLeft} attempt${newAttemptsLeft !== 1 ? 's' : ''} left)` : ''));
                            }
                          }
                        }
                      }}
                      placeholder="Enter code…"
                      disabled={!!(playtestCodeEntry.cooldownEndTs && Date.now() < playtestCodeEntry.cooldownEndTs) || playtestCodeEntry.attemptsLeft <= 0}
                      className="w-full px-3 py-2 rounded border border-cyan-700/50 bg-slate-900 text-cyan-100 placeholder-slate-500 text-center text-lg tracking-widest font-mono focus:outline-none focus:border-cyan-500"
                      autoFocus
                    />
                    {playtestCodeError && <div className="text-red-400 text-xs text-center">{playtestCodeError}</div>}
                    {playtestCodeCooldownRemaining > 0 && <div className="text-amber-400 text-xs text-center">Locked — {playtestCodeCooldownRemaining}s remaining</div>}
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => { setPlaytestCodeEntry(null); setPlaytestCodeInput(''); setPlaytestCodeError(''); }} className="px-3 py-2 rounded border border-slate-600 text-gray-300 hover:bg-slate-800 text-sm">Cancel</button>
                      <button
                        type="button"
                        disabled={!!(playtestCodeEntry.cooldownEndTs && Date.now() < playtestCodeEntry.cooldownEndTs) || playtestCodeEntry.attemptsLeft <= 0}
                        onClick={() => {
                          const entry = playtestCodeEntry;
                          if (!entry) return;
                          const input = playtestCodeInput.trim();
                          const correct = entry.caseSensitive
                            ? input === entry.correctCode
                            : input.toLowerCase() === entry.correctCode.toLowerCase();
                          if (correct) {
                            if (entry.triggerEffect) applyUseEffectRef.current?.(entry.triggerEffect);
                            setPlaytestMessage(`✓ Correct code for '${entry.zoneLabel}'.`);
                            setPlaytestCodeEntry(null);
                            setPlaytestCodeInput('');
                            setPlaytestCodeError('');
                          } else {
                            const newAtt = entry.attemptsLeft - 1;
                            setPlaytestCodeEntry(prev => prev ? { ...prev, attemptsLeft: Math.max(0, newAtt) } : prev);
                            setPlaytestCodeError(entry.errorMessage + (entry.maxAttempts > 0 ? ` (${Math.max(0, newAtt)} left)` : ''));
                          }
                        }}
                        className="px-4 py-2 rounded bg-cyan-600 text-white font-semibold hover:bg-cyan-500 disabled:opacity-50 text-sm"
                      >
                        Submit
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Inventory */}
            <div ref={playtestInventoryRef} className="border rounded-lg p-2 bg-slate-900/40">
              <div className="text-xs font-semibold mb-1">Inventory</div>
              <div className="flex flex-wrap gap-2">
                {playtestInventoryItemIds.length === 0 ? (
                  <div className="text-xs text-gray-400">No items collected yet.</div>
                ) : (
                  playtestInventoryItemIds.map((id) => {
                    const item = (() => {
                      for (const s of scenes) {
                        const found = s?.items?.find((it: any) => it?.id === id);
                        if (found) return found;
                      }
                      return null;
                    })();
                    const selected = playtestSelectedInventoryItemId === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        className={selected ? 'bg-emerald-700 text-white px-2 py-1 rounded text-xs flex items-center gap-2' : 'bg-slate-700 text-white px-2 py-1 rounded text-xs flex items-center gap-2'}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setPlaytestSelectedInventoryItemId(prev => (prev === id ? null : id));
                          setPlaytestModal(null);
                        }}
                        title={item?.name || id}
                      >
                        {item?.imageUrl ? <img src={item.imageUrl} alt="" className="h-5 w-5 object-cover rounded" /> : null}
                        <span>{item?.name || id}</span>
                      </button>
                    );
                  })
                )}
              </div>
              {playtestMessage ? <div className="mt-2 text-xs text-gray-200">{playtestMessage}</div> : null}
            </div>
          </div>
        )}

        {scenes.length > 0 && previewMode !== 'playtest' && (
          <div
            ref={previewRef}
            className="mb-6 border rounded-lg overflow-hidden"
            style={{ background: '#222', minHeight: 320, position: 'relative', width: 600, maxWidth: '100%' }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => e.preventDefault()}
            onClick={() => { setSelectedItem(null); setSelectedZone(null); }}
          >
            {/* Background image */}
            {scenes[previewSceneIdx].backgroundUrl ? (
              <>
                <img
                  src={previewProxying ? `/api/image-proxy?url=${encodeURIComponent(scenes[previewSceneIdx].backgroundUrl)}` : scenes[previewSceneIdx].backgroundUrl}
                  alt="Background"
                  style={{ width: '100%', height: 320, objectFit: 'cover', display: 'block' }}
                  onLoad={() => {
                    setPreviewImageError(null);
                  }}
                  onError={() => {
                    if (!previewProxying) {
                      // first failure: attempt server-side proxy (requires ALLOWED_IMAGE_HOSTS configured)
                      setPreviewImageError('Failed to load preview image; retrying via server proxy...');
                      setPreviewProxying(true);
                    } else {
                      setPreviewImageError('Failed to load preview image (proxy failed or URL invalid)');
                    }
                  }}
                />
                {previewImageError && (
                  <div style={{ padding: 8, color: '#ff7b7b', fontSize: 12 }}>{previewImageError}</div>
                )}
              </>
            ) : null}
            {/* Items */}
            {scenes[previewSceneIdx].items.map((item, i) => (
              <div
                key={item.id}
                onClick={(ev) => { ev.stopPropagation(); setSelectedItem({ sceneIdx: previewSceneIdx, itemIdx: i }); setSelectedZone(null); }}
                onPointerDown={(ev) => {
                  ev.stopPropagation();
                  // primary button only (avoid right-click drag)
                  if (ev.button !== 0) return;
                  const parentRect = previewRef.current?.getBoundingClientRect();
                  if (!parentRect) return;
                  setSelectedItem({ sceneIdx: previewSceneIdx, itemIdx: i });
                  setSelectedZone(null);

                  const startXPos = item.x ?? (20 + i * 60);
                  const startYPos = item.y ?? 20;
                  const itemW = item.w ?? 48;
                  const itemH = item.h ?? 48;

                  const offsetX = ev.clientX - (parentRect.left + startXPos);
                  const offsetY = ev.clientY - (parentRect.top + startYPos);

                  try {
                    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
                  } catch {
                    // ignore if capture fails
                  }

                  draggingItemRef.current = {
                    sceneIdx: previewSceneIdx,
                    itemIdx: i,
                    pointerId: ev.pointerId,
                    offsetX,
                    offsetY,
                    parentRect,
                    itemW,
                    itemH,
                    raf: null,
                    latestClientX: ev.clientX,
                    latestClientY: ev.clientY,
                  };

                  const scheduleUpdate = () => {
                    const r = draggingItemRef.current;
                    if (!r) return;
                    if (r.raf != null) return;
                    r.raf = window.requestAnimationFrame(() => {
                      const rr = draggingItemRef.current;
                      if (!rr) return;
                      rr.raf = null;
                      const newX = rr.latestClientX - rr.parentRect.left - rr.offsetX;
                      const newY = rr.latestClientY - rr.parentRect.top - rr.offsetY;
                      const clampedX = Math.max(0, Math.min(newX, rr.parentRect.width - rr.itemW));
                      const clampedY = Math.max(0, Math.min(newY, rr.parentRect.height - rr.itemH));
                      setScenes(prev => {
                        const copy = [...prev];
                        const it = copy[rr.sceneIdx]?.items?.[rr.itemIdx];
                        if (!it) return prev;
                        it.x = Math.round(clampedX);
                        it.y = Math.round(clampedY);
                        return copy;
                      });
                    });
                  };

                  const onPointerMove = (pm: PointerEvent) => {
                    const r = draggingItemRef.current;
                    if (!r) return;
                    if (pm.pointerId !== r.pointerId) return;
                    r.latestClientX = pm.clientX;
                    r.latestClientY = pm.clientY;
                    scheduleUpdate();
                  };

                  const onPointerUp = (pu: PointerEvent) => {
                    const r = draggingItemRef.current;
                    if (!r) return;
                    if (pu.pointerId !== r.pointerId) return;
                    if (r.raf != null) window.cancelAnimationFrame(r.raf);
                    draggingItemRef.current = null;
                    window.removeEventListener('pointermove', onPointerMove);
                    window.removeEventListener('pointerup', onPointerUp);
                  };

                  window.addEventListener('pointermove', onPointerMove);
                  window.addEventListener('pointerup', onPointerUp);
                }}
                style={{
                  position: 'absolute',
                  left: item.x ?? (20 + i * 60),
                  top: item.y ?? 20,
                  zIndex: 2,
                  borderRadius: 4,
                  padding: 2,
                  minWidth: 40,
                  textAlign: 'center',
                  cursor: 'move',
                  userSelect: 'none',
                  touchAction: 'none'
                }}
              >
                {item.imageUrl ? (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      style={{ width: (item.w ?? 48), height: (item.h ?? 48), objectFit: 'contain', display: 'block', borderRadius: 4, boxSizing: 'border-box', outline: selectedItem && selectedItem.sceneIdx === previewSceneIdx && selectedItem.itemIdx === i ? '2px solid rgba(99,102,241,0.9)' : 'none' }}
                      draggable={false}
                    />
                    {selectedItem && selectedItem.sceneIdx === previewSceneIdx && selectedItem.itemIdx === i && (
                      // resize handles (se, sw, ne, nw)
                      <>
                        {(['nw','ne','sw','se'] as const).map(h => {
                          const isCorner = true;
                          const style: React.CSSProperties = {
                            position: 'absolute',
                            width: 10,
                            height: 10,
                            background: '#fff',
                            border: '1px solid rgba(0,0,0,0.4)',
                            borderRadius: 2,
                            transform: 'translate(-50%, -50%)',
                            zIndex: 10,
                            touchAction: 'none',
                            cursor: h === 'nw' || h === 'se' ? 'nwse-resize' : 'nesw-resize'
                          };
                          if (h === 'nw') Object.assign(style, { left: 0, top: 0 });
                          if (h === 'ne') Object.assign(style, { left: (item.w ?? 48), top: 0 });
                          if (h === 'sw') Object.assign(style, { left: 0, top: (item.h ?? 48) });
                          if (h === 'se') Object.assign(style, { left: (item.w ?? 48), top: (item.h ?? 48) });
                          return (
                            <div
                              key={h}
                              style={style}
                              onPointerDown={(ev) => {
                                ev.stopPropagation();
                                // prevent the drag handler from also starting
                                try {
                                  (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
                                } catch {
                                  // ignore
                                }
                                const rect = (ev.target as HTMLElement).closest('div')?.getBoundingClientRect();
                                resizingRef.current = {
                                  kind: 'item',
                                  sceneIdx: previewSceneIdx,
                                  idx: i,
                                  startX: ev.clientX,
                                  startY: ev.clientY,
                                  startW: item.w ?? 48,
                                  startH: item.h ?? 48,
                                  handle: h,
                                  aspect: (item.w && item.h) ? (item.w / item.h) : undefined,
                                };
                                // capture parent preview rect and original position so left/top handles update position
                                const parentRect = previewRef.current?.getBoundingClientRect();
                                const startXPos = item.x ?? (20 + i * 60);
                                const startYPos = item.y ?? 20;
                                // augment resizingRef with positional info
                                (resizingRef.current as any).startXPos = startXPos;
                                (resizingRef.current as any).startYPos = startYPos;
                                (resizingRef.current as any).parentRect = parentRect;
                                const onPointerMove = (pm: PointerEvent) => {
                                  const r = resizingRef.current as any;
                                  if (!r) return;
                                  const dx = pm.clientX - r.startX;
                                  const dy = pm.clientY - r.startY;
                                  let newW = r.startW;
                                  let newH = r.startH;
                                  let newX = r.startXPos;
                                  let newY = r.startYPos;
                                  if (r.handle === 'se') { newW = Math.max(8, Math.round(r.startW + dx)); newH = Math.max(8, Math.round(r.startH + dy)); }
                                  else if (r.handle === 'sw') { newW = Math.max(8, Math.round(r.startW - dx)); newH = Math.max(8, Math.round(r.startH + dy)); newX = r.startXPos + (r.startW - newW); }
                                  else if (r.handle === 'ne') { newW = Math.max(8, Math.round(r.startW + dx)); newH = Math.max(8, Math.round(r.startH - dy)); newY = r.startYPos + (r.startH - newH); }
                                  else if (r.handle === 'nw') { newW = Math.max(8, Math.round(r.startW - dx)); newH = Math.max(8, Math.round(r.startH - dy)); newX = r.startXPos + (r.startW - newW); newY = r.startYPos + (r.startH - newH); }
                                  // if Shift is held preserve aspect
                                  if (pm.shiftKey && r.aspect) { if (Math.abs(dx) > Math.abs(dy)) { newH = Math.max(8, Math.round(newW / r.aspect)); } else { newW = Math.max(8, Math.round(newH * r.aspect)); } }
                                  // clamp within parent using captured rect
                                  if (r.parentRect) {
                                    newX = Math.max(0, Math.min(newX, r.parentRect.width - newW));
                                    newY = Math.max(0, Math.min(newY, r.parentRect.height - newH));
                                  }
                                  setScenes(prev => {
                                    const copy = [...prev];
                                    const it = copy[r.sceneIdx].items[(r as any).idx];
                                    it.w = Math.round(newW); it.h = Math.round(newH);
                                    it.x = Math.round(newX); it.y = Math.round(newY);
                                    return copy;
                                  });
                                };
                                const onPointerUp = () => {
                                  resizingRef.current = null;
                                  window.removeEventListener('pointermove', onPointerMove);
                                  window.removeEventListener('pointerup', onPointerUp);
                                };
                                window.addEventListener('pointermove', onPointerMove);
                                window.addEventListener('pointerup', onPointerUp);
                              }}
                            />
                          );
                        })}
                      </>
                    )}
                  </div>
                ) : <span>🧩</span>}
                <div style={{ fontSize: 10 }}>{item.name}</div>
              </div>
            ))}
            {/* Interactive zones */}
            {scenes[previewSceneIdx].interactiveZones.map((zone, i) => (
              <div
                key={zone.id}
                onClick={(ev) => { ev.stopPropagation(); setSelectedZone({ sceneIdx: previewSceneIdx, zoneIdx: i }); setSelectedItem(null); }}
                onPointerDown={(ev) => {
                  ev.stopPropagation();
                  if (ev.button !== 0) return;
                  setSelectedZone({ sceneIdx: previewSceneIdx, zoneIdx: i });
                  setSelectedItem(null);
                  const parentRect = previewRef.current?.getBoundingClientRect();
                  if (!parentRect) return;

                  const offsetX = ev.clientX - (parentRect.left + zone.x);
                  const offsetY = ev.clientY - (parentRect.top + zone.y);

                  try {
                    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
                  } catch {
                    // ignore
                  }

                  draggingZoneRef.current = {
                    sceneIdx: previewSceneIdx,
                    zoneIdx: i,
                    pointerId: ev.pointerId,
                    offsetX,
                    offsetY,
                    parentRect,
                    zoneW: zone.width,
                    zoneH: zone.height,
                    raf: null,
                    latestClientX: ev.clientX,
                    latestClientY: ev.clientY,
                  };

                  const scheduleUpdate = () => {
                    const r = draggingZoneRef.current;
                    if (!r) return;
                    if (r.raf != null) return;
                    r.raf = window.requestAnimationFrame(() => {
                      const rr = draggingZoneRef.current;
                      if (!rr) return;
                      rr.raf = null;
                      const newX = rr.latestClientX - rr.parentRect.left - rr.offsetX;
                      const newY = rr.latestClientY - rr.parentRect.top - rr.offsetY;
                      const clampedX = Math.max(0, Math.min(newX, rr.parentRect.width - rr.zoneW));
                      const clampedY = Math.max(0, Math.min(newY, rr.parentRect.height - rr.zoneH));
                      setScenes(prev => {
                        const copy = [...prev];
                        const z = copy[rr.sceneIdx]?.interactiveZones?.[rr.zoneIdx];
                        if (!z) return prev;
                        copy[rr.sceneIdx].interactiveZones[rr.zoneIdx] = { ...z, x: Math.round(clampedX), y: Math.round(clampedY) };
                        return copy;
                      });
                    });
                  };

                  const onPointerMove = (pm: PointerEvent) => {
                    const r = draggingZoneRef.current;
                    if (!r) return;
                    if (pm.pointerId !== r.pointerId) return;
                    r.latestClientX = pm.clientX;
                    r.latestClientY = pm.clientY;
                    scheduleUpdate();
                  };

                  const onPointerUp = (pu: PointerEvent) => {
                    const r = draggingZoneRef.current;
                    if (!r) return;
                    if (pu.pointerId !== r.pointerId) return;
                    if (r.raf != null) window.cancelAnimationFrame(r.raf);
                    draggingZoneRef.current = null;
                    window.removeEventListener('pointermove', onPointerMove);
                    window.removeEventListener('pointerup', onPointerUp);
                  };

                  window.addEventListener('pointermove', onPointerMove);
                  window.addEventListener('pointerup', onPointerUp);
                }}
                style={{ position: 'absolute', left: zone.x, top: zone.y, width: zone.width, height: zone.height, border: '2px dashed #38bdf8', background: 'rgba(56,189,248,0.1)', zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto', touchAction: 'none', cursor: 'move', userSelect: 'none' }}
              >
                <span style={{ color: '#38bdf8', fontSize: 12, fontWeight: 600 }}>{zone.label}</span>
                {/* selected handles */}
                {selectedZone && selectedZone.sceneIdx === previewSceneIdx && selectedZone.zoneIdx === i && (
                  (['nw','ne','sw','se'] as const).map(h => {
                    const style: React.CSSProperties = {
                      position: 'absolute',
                      width: 10,
                      height: 10,
                      background: '#fff',
                      border: '1px solid rgba(0,0,0,0.4)',
                      borderRadius: 2,
                      transform: 'translate(-50%, -50%)',
                      zIndex: 20,
                      touchAction: 'none',
                      cursor: h === 'nw' || h === 'se' ? 'nwse-resize' : 'nesw-resize'
                    } as React.CSSProperties;
                    if (h === 'nw') Object.assign(style, { left: 0, top: 0 });
                    if (h === 'ne') Object.assign(style, { left: zone.width, top: 0 });
                    if (h === 'sw') Object.assign(style, { left: 0, top: zone.height });
                    if (h === 'se') Object.assign(style, { left: zone.width, top: zone.height });
                    return (
                      <div
                        key={h}
                        style={style}
                        onPointerDown={(ev) => {
                          ev.stopPropagation();
                          const startX = ev.clientX;
                          const startY = ev.clientY;
                          const startW = zone.width;
                          const startH = zone.height;
                          const startXPos = zone.x;
                          const startYPos = zone.y;
                          resizingRef.current = { kind: 'zone', sceneIdx: previewSceneIdx, idx: i, startX, startY, startW, startH, handle: h as any };
                          const parentRectForHandle = previewRef.current?.getBoundingClientRect();
                          const onPointerMove = (pm: PointerEvent) => {
                            const r = resizingRef.current;
                            if (!r) return;
                            const dx = pm.clientX - r.startX;
                            const dy = pm.clientY - r.startY;
                            let newW = r.startW;
                            let newH = r.startH;
                            let newX = startXPos;
                            let newY = startYPos;
                            if (r.handle === 'se') { newW = Math.max(8, Math.round(r.startW + dx)); newH = Math.max(8, Math.round(r.startH + dy)); }
                            else if (r.handle === 'sw') { newW = Math.max(8, Math.round(r.startW - dx)); newH = Math.max(8, Math.round(r.startH + dy)); newX = startXPos + (r.startW - newW); }
                            else if (r.handle === 'ne') { newW = Math.max(8, Math.round(r.startW + dx)); newH = Math.max(8, Math.round(r.startH - dy)); newY = startYPos + (r.startH - newH); }
                            else if (r.handle === 'nw') { newW = Math.max(8, Math.round(r.startW - dx)); newH = Math.max(8, Math.round(r.startH - dy)); newX = startXPos + (r.startW - newW); newY = startYPos + (r.startH - newH); }
                            // clamp within parent using captured rect
                            if (parentRectForHandle) {
                              newX = Math.max(0, Math.min(newX, parentRectForHandle.width - newW));
                              newY = Math.max(0, Math.min(newY, parentRectForHandle.height - newH));
                            }
                            setScenes(prev => {
                              const copy = [...prev];
                              copy[previewSceneIdx].interactiveZones[i] = { ...copy[previewSceneIdx].interactiveZones[i], x: Math.round(newX), y: Math.round(newY), width: Math.round(newW), height: Math.round(newH) };
                              return copy;
                            });
                          };
                          const onPointerUp = () => { resizingRef.current = null; window.removeEventListener('pointermove', onPointerMove); window.removeEventListener('pointerup', onPointerUp); };
                          window.addEventListener('pointermove', onPointerMove);
                          window.addEventListener('pointerup', onPointerUp);
                        }}
                      />
                    );
                  })
                )}
              </div>
            ))}
          </div>
        )}
        {scenes.length === 0 ? <div className="text-gray-500">No scenes added yet.</div> : (
          <ul className="space-y-4">
            {scenes.map((scene, idx) => (
              <li key={scene.id}>
                <details className="border rounded">
                  <summary className="flex items-center gap-3 px-3 py-2 cursor-pointer select-none bg-slate-800/40 hover:bg-slate-800/70 [&::-webkit-details-marker]:hidden list-none rounded">
                    <span className="text-sm font-semibold flex-1 truncate">
                      {scene.name || <span className="text-gray-400 italic font-normal">Unnamed Scene</span>}
                    </span>
                    <span className="text-[10px] text-gray-400 shrink-0">
                      {scene.items.length} item{scene.items.length !== 1 ? 's' : ''} &middot; {scene.interactiveZones.length} zone{scene.interactiveZones.length !== 1 ? 's' : ''}
                    </span>
                    {scene.accessRule && scene.accessRule !== 'open' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-300 shrink-0">
                        {scene.accessRule === 'assignedOnly' ? 'assigned only' : 'locked'}
                      </span>
                    )}
                    <button
                      className="text-red-500 text-xs px-1 shrink-0"
                      type="button"
                      onClick={e => { e.preventDefault(); setScenes(scenes.filter((_, i) => i !== idx)); }}
                    >Remove</button>
                    <span className="text-[10px] text-gray-400 shrink-0">▸ edit</span>
                  </summary>
                  <div className="px-4 pt-3 pb-4">
                <div className="flex justify-between items-center mb-2">
                  <input value={scene.name} onChange={e => {
                    const updated = [...scenes];
                    updated[idx].name = e.target.value;
                    setScenes(updated);
                  }} placeholder="Scene Name" className="border rounded px-2 py-1 mr-2" />
                </div>

                {/* ── Player Assignment & Access Rules (shown in assigned mode) ── */}
                <div className="mb-3 rounded border border-slate-600 bg-slate-800/40 p-3 space-y-3">
                  {playerMode === 'assigned' && (
                    <div>
                      <label className="block text-xs font-semibold text-amber-200 mb-1">Assigned Player Slot(s)</label>
                      <div className="flex gap-3 flex-wrap">
                        {([1, 2, 3, 4] as const).map(slot => {
                          const checked = Array.isArray(scene.assignedPlayerSlots) && scene.assignedPlayerSlots.includes(slot);
                          return (
                            <label key={slot} className="flex items-center gap-1 text-xs cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={e => {
                                  const updated = [...scenes];
                                  const cur = Array.isArray(updated[idx].assignedPlayerSlots) ? updated[idx].assignedPlayerSlots!.slice() : [];
                                  const next = e.target.checked ? Array.from(new Set([...cur, slot])) : cur.filter(s => s !== slot);
                                  (updated[idx] as any).assignedPlayerSlots = next;
                                  setScenes(updated);
                                }}
                              />
                              Player {slot}
                            </label>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">Players assigned here will start in this scene. Leave empty to allow free entry.</p>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-slate-200 mb-1">Scene Access Rule</label>
                    <select
                      value={scene.accessRule || 'open'}
                      onChange={e => {
                        const updated = [...scenes];
                        (updated[idx] as any).accessRule = e.target.value as EscapeRoomScene['accessRule'];
                        setScenes(updated);
                      }}
                      className="border rounded px-2 py-1 text-xs bg-slate-700 text-white"
                    >
                      <option value="open">Open — any player can enter</option>
                      <option value="assignedOnly">Assigned players only</option>
                      <option value="lockedUntilUnlocked">Locked — only accessible after an effect unlocks it</option>
                    </select>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {scene.accessRule === 'assignedOnly'
                        ? 'Only the player slot(s) assigned above can view this scene.'
                        : scene.accessRule === 'lockedUntilUnlocked'
                        ? 'No one can enter this scene until another zone\'s useEffect enables it via cross-scene effect.'
                        : 'Any player can navigate to this scene freely.'}
                    </p>
                  </div>
                </div>
                <div className="mb-2">
                  <label className="block text-sm">Background Image</label>
                  <div className="flex gap-2 items-center">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="text"
                        value={scene.backgroundUrl || ''}
                        onChange={e => {
                          const updated = [...scenes];
                          updated[idx].backgroundUrl = e.target.value;
                          setScenes(updated);
                        }}
                        placeholder="Paste an external image URL"
                        className="border rounded px-2 py-1 text-xs w-64"
                      />

                      <button
                        type="button"
                        className="bg-blue-500 text-white px-2 py-1 rounded text-xs"
                        disabled={!scene.backgroundUrl || !editId}
                        onClick={async () => {
                          if (!scene.backgroundUrl || !editId) return;
                          try {
                            const resp = await fetch('/api/admin/media', {
                              method: 'POST',
                              body: (() => {
                                const fd = new FormData();
                                fd.append('url', scene.backgroundUrl);
                                fd.append('puzzleId', editId);
                                return fd;
                              })(),
                            });
                            const data = await resp.json();
                            if (resp.ok && data.mediaUrl) {
                              const updated = [...scenes];
                              updated[idx].backgroundUrl = data.mediaUrl;
                              setScenes(updated);
                              console.log('[Designer] Imported media:', { status: resp.status, body: data, updatedBackgroundUrl: updated[idx].backgroundUrl });
                              alert('Image imported and saved to media!');
                            } else {
                              alert('Import failed: ' + (data.error || 'Unknown error'));
                            }
                          } catch (err) {
                            alert('Import error: ' + (err instanceof Error ? err.message : String(err)));
                          }
                        }}
                      >Import to Media</button>

                      {/* New: upload background file and store under public/content/images */}
                      <input
                        type="file"
                        accept="image/*"
                        id={`scene-bg-file-${idx}`}
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const file = e.target.files?.[0];
                          setBgUploadState(prev => ({ ...prev, [idx]: { uploading: true, error: undefined } }));
                          try {
                            if (!file) {
                              setBgUploadState(prev => ({ ...prev, [idx]: { uploading: false, error: 'No file selected' } }));
                              return;
                            }

                            // quick client-side validations to give faster feedback
                            if (file.size > MAX_CLIENT_UPLOAD) {
                              setBgUploadState(prev => ({ ...prev, [idx]: { uploading: false, error: `File too large (> ${Math.round(MAX_CLIENT_UPLOAD / (1024*1024))}MB)` } }));
                              return;
                            }

                            const fd = new FormData();
                            fd.append('file', file);
                            if (editId) fd.append('puzzleId', editId);
                            fd.append('dest', 'content-images'); // request storage in content/images

                            const res = await fetch('/api/admin/media', { method: 'POST', body: fd, credentials: 'same-origin' });

                            // handle network-level failures
                            if (!res.ok) {
                              let bodyText = '';
                              try { bodyText = await res.text(); } catch (_) { bodyText = ''; }
                              let serverMsg = bodyText;
                              try {
                                const parsed = JSON.parse(bodyText || '{}');
                                serverMsg = parsed.error || parsed.message || bodyText;
                              } catch (_) {
                                /* not JSON */
                              }
                              const errMsg = `Upload failed: ${res.status} ${res.statusText} - ${serverMsg || 'server error'}`;
                              console.error('[Designer] background upload error response:', { status: res.status, statusText: res.statusText, body: bodyText });
                              setBgUploadState(prev => ({ ...prev, [idx]: { uploading: false, error: errMsg } }));
                              return;
                            }

                            const data = await res.json().catch(() => ({}));
                            if (data && (data.mediaUrl || data.url)) {
                              const updated = [...scenes];
                              updated[idx].backgroundUrl = data.mediaUrl || data.url;
                              setScenes(updated);
                              setBgUploadState(prev => ({ ...prev, [idx]: { uploading: false, error: undefined } }));
                            } else {
                              const msg = (data && (data.error || data.message)) || 'Unknown server response';
                              setBgUploadState(prev => ({ ...prev, [idx]: { uploading: false, error: `Upload failed: ${msg}` } }));
                              console.error('[Designer] unexpected upload response', data);
                            }
                          } catch (err) {
                            const errMsg = err instanceof Error ? err.message : String(err);
                            console.error('[Designer] upload network/error', err);
                            setBgUploadState(prev => ({ ...prev, [idx]: { uploading: false, error: `Upload error: ${errMsg}` } }));
                          }
                        }}
                      />
                      <label htmlFor={`scene-bg-file-${idx}`} className="bg-emerald-500 text-white px-2 py-1 rounded text-xs cursor-pointer">Upload background</label>
                      {bgUploadState[idx]?.uploading && <span className="ml-2 text-xs text-blue-400">Uploading...</span>}
                      {bgUploadState[idx]?.error && <div style={{ color: '#ff7b7b', fontSize: 12, marginLeft: 8 }}>{bgUploadState[idx]?.error}</div> }

                      {scene.backgroundUrl && (
                        <img src={scene.backgroundUrl} alt="bg" className="h-10 w-10 object-cover rounded ml-2" />
                      )}
                    </div>
                  </div>
                </div>
                <div className="mb-2">
                  <label className="block text-sm">Description</label>
                  <input value={scene.description} onChange={e => {
                    const updated = [...scenes];
                    updated[idx].description = e.target.value;
                    setScenes(updated);
                  }} className="border rounded px-2 py-1 w-full" />
                </div>
                {/* Items management */}
                <div className="mb-2">
                  <label className="block text-sm font-semibold">Items</label>
                  <button className="bg-blue-500 text-white px-2 py-1 rounded text-xs mb-2" type="button" onClick={() => {
                    const updated = [...scenes];
                    updated[idx].items.push({ id: Date.now().toString(), name: '', imageUrl: '', description: '', x: 50, y: 50, w: 48, h: 48, properties: {} });
                    setScenes(updated);
                  }}>+ Add Item</button>
                  {scene.items.length === 0 ? (
                    <div className="text-xs text-gray-400">No items</div>
                  ) : (
                    <ul className="space-y-2">
                      {scene.items.map((item, itemIdx) => (
                        <li key={item.id}>
                          <details className="border rounded">
                            <summary className="flex items-center gap-2 px-2 py-2 cursor-pointer select-none bg-slate-800/30 hover:bg-slate-800/50 [&::-webkit-details-marker]:hidden list-none rounded">
                              {item.imageUrl && <img src={item.imageUrl} alt="" className="h-5 w-5 object-cover rounded shrink-0" />}
                              <span className="text-xs font-semibold flex-1 truncate">{item.name || <span className="text-gray-400 italic font-normal">Unnamed Item</span>}</span>
                              <span className="text-[10px] text-gray-400 group-open:hidden">▸ edit</span>
                            </summary>
                            <div className="px-2 pb-2 border-t border-slate-700/50">
                          <div className="flex gap-2 items-center mb-1 mt-2">
                            <input value={item.name} onChange={e => {
                              const updated = [...scenes];
                              updated[idx].items[itemIdx].name = e.target.value;
                              setScenes(updated);
                            }} placeholder="Item Name" className="border rounded px-2 py-1 text-xs" />
                            <div className="flex gap-2 items-center">

                              <input
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                form=""
                                id={`item-image-${idx}-${itemIdx}`}
                                ref={createFileInputRef(idx, itemIdx)}
                                onChange={async (e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  const key = `${idx}-${itemIdx}`;
                                  setItemUploadState(prev => ({ ...prev, [key]: { uploading: true, error: '' } }));
                                  let uploadError = '';
                                  let imageUrl = '';
                                  try {
                                    const formData = new FormData();
                                    formData.append('file', file);
                                    if (editId) formData.append('puzzleId', editId);
                                    const res = await fetch('/api/admin/media', { method: 'POST', body: formData });
                                    const data = await res.json();
                                    if (res.ok && (data.mediaUrl || data.url)) {
                                      imageUrl = data.mediaUrl || data.url;
                                    } else {
                                      uploadError = data.error || 'Unknown error';
                                    }
                                  } catch (err) {
                                    uploadError = err instanceof Error ? err.message : String(err);
                                  }
                                  // Update the item with the imageUrl if successful
                                  if (imageUrl) {
                                    const updated = [...scenes];
                                    updated[idx].items[itemIdx].imageUrl = imageUrl;
                                    setScenes(updated);
                                  }
                                  setItemUploadState(prev => ({ ...prev, [key]: { uploading: false, error: uploadError } }));
                                }}
                              />
                              <label
                                htmlFor={`item-image-${idx}-${itemIdx}`}
                                className="bg-blue-500 text-white px-2 py-1 rounded text-xs cursor-pointer inline-block"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const input = fileInputRefs.current[`${idx}-${itemIdx}`];
                                  if (input) input.click();
                                }}
                              >
                                Upload Image
                              </label>
                              {itemUploadState[`${idx}-${itemIdx}`]?.uploading && (
                                <span className="ml-2 text-xs text-blue-400">Uploading...</span>
                              )}
                              {itemUploadState[`${idx}-${itemIdx}`]?.error && (
                                <span className="ml-2 text-xs text-red-400">{itemUploadState[`${idx}-${itemIdx}`].error}</span>
                              )}
                              {item.imageUrl && !itemUploadState[`${idx}-${itemIdx}`]?.uploading && (
                                <img src={item.imageUrl} alt="item" className="h-8 w-8 object-cover rounded ml-2" />
                              )}
                            </div>
                            <button className="text-red-500 text-xs" type="button" onClick={() => {
                              const updated = [...scenes];
                              updated[idx].items = updated[idx].items.filter((_, i) => i !== itemIdx);
                              setScenes(updated);
                            }}>Remove</button>
                          </div>
                          <input value={item.description} onChange={e => {
                            const updated = [...scenes];
                            updated[idx].items[itemIdx].description = e.target.value;
                            setScenes(updated);
                          }} placeholder="Description" className="border rounded px-2 py-1 w-full text-xs" />
                          <div className="mt-1 flex items-center gap-2">
                            <label className="text-xs flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={!!(item.properties && item.properties.hiddenByDefault)}
                                onChange={(e) => {
                                  const updated = [...scenes];
                                  const cur = updated[idx].items[itemIdx];
                                  const nextProps = { ...(cur.properties || {}), hiddenByDefault: !!e.target.checked };
                                  updated[idx].items[itemIdx] = { ...cur, properties: nextProps };
                                  setScenes(updated);
                                }}
                              />
                              Hidden by default (revealed by an unlock/use effect)
                            </label>
                          </div>
                          <div className="mt-2 border rounded p-2">
                            <div className="text-xs font-semibold mb-1">Sprite States (optional)</div>
                            <div className="text-[11px] text-gray-400 mb-2">Map state names (e.g. closed/open) to image URLs. Use zone effects to switch states.</div>
                            {Object.entries((item.properties?.spriteStates && typeof item.properties.spriteStates === 'object') ? item.properties.spriteStates : {}).map(([stateKey, stateImage], stateIdx) => (
                              <div key={`${item.id}-sprite-${stateIdx}`} className="border rounded p-2 mb-2 bg-slate-900/40">
                                <div className="flex gap-2 items-center mb-1">
                                  <span className="text-[11px] text-gray-400 w-10">Name</span>
                                  <input
                                    value={stateKey}
                                    onChange={(e) => {
                                      const updated = [...scenes];
                                      const cur = updated[idx].items[itemIdx];
                                      const curStates = { ...((cur.properties?.spriteStates && typeof cur.properties.spriteStates === 'object') ? cur.properties.spriteStates : {}) } as Record<string, string>;
                                      const entries = Object.entries(curStates);
                                      const oldKey = entries[stateIdx]?.[0] || stateKey;
                                      const oldValue = entries[stateIdx]?.[1] || (typeof stateImage === 'string' ? stateImage : '');
                                      delete curStates[oldKey];
                                      const nextKey = e.target.value.trim();
                                      if (nextKey) curStates[nextKey] = oldValue;
                                      const nextProps = { ...(cur.properties || {}), spriteStates: curStates };
                                      updated[idx].items[itemIdx] = { ...cur, properties: nextProps };
                                      setScenes(updated);
                                    }}
                                    placeholder="e.g. powered"
                                    className="border rounded px-2 py-1 text-xs flex-1"
                                  />
                                  <button
                                    type="button"
                                    className="text-red-500 text-xs ml-auto"
                                    onClick={() => {
                                      const updated = [...scenes];
                                      const cur = updated[idx].items[itemIdx];
                                      const curStates = { ...((cur.properties?.spriteStates && typeof cur.properties.spriteStates === 'object') ? cur.properties.spriteStates : {}) } as Record<string, string>;
                                      const entries = Object.entries(curStates);
                                      const keyToRemove = entries[stateIdx]?.[0] || stateKey;
                                      delete curStates[keyToRemove];
                                      const nextProps = { ...(cur.properties || {}), spriteStates: curStates };
                                      updated[idx].items[itemIdx] = { ...cur, properties: nextProps };
                                      setScenes(updated);
                                    }}
                                  >
                                    Remove
                                  </button>
                                </div>
                                <div className="flex gap-2 items-center">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    form=""
                                    id={`sprite-state-${idx}-${itemIdx}-${stateIdx}`}
                                    ref={(el) => { fileInputRefs.current[`sprite-${idx}-${itemIdx}-${stateIdx}`] = el; }}
                                    onChange={async (e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      const ssKey = `sprite-${idx}-${itemIdx}-${stateIdx}`;
                                      setSpriteStateUploadState(prev => ({ ...prev, [ssKey]: { uploading: true, error: '' } }));
                                      let uploadError = '';
                                      let imageUrl = '';
                                      try {
                                        const formData = new FormData();
                                        formData.append('file', file);
                                        if (editId) formData.append('puzzleId', editId);
                                        const res = await fetch('/api/admin/media', { method: 'POST', body: formData });
                                        const data = await res.json();
                                        if (res.ok && (data.mediaUrl || data.url)) {
                                          imageUrl = data.mediaUrl || data.url;
                                        } else {
                                          uploadError = data.error || 'Unknown error';
                                        }
                                      } catch (err) {
                                        uploadError = err instanceof Error ? err.message : String(err);
                                      }
                                      if (imageUrl) {
                                        const updated = [...scenes];
                                        const cur = updated[idx].items[itemIdx];
                                        const curStates = { ...((cur.properties?.spriteStates && typeof cur.properties.spriteStates === 'object') ? cur.properties.spriteStates : {}) } as Record<string, string>;
                                        const entries = Object.entries(curStates);
                                        const currentKey = entries[stateIdx]?.[0] || stateKey;
                                        if (currentKey.trim()) curStates[currentKey] = imageUrl;
                                        const nextProps = { ...(cur.properties || {}), spriteStates: curStates };
                                        updated[idx].items[itemIdx] = { ...cur, properties: nextProps };
                                        setScenes(updated);
                                      }
                                      setSpriteStateUploadState(prev => ({ ...prev, [ssKey]: { uploading: false, error: uploadError } }));
                                    }}
                                  />
                                  <label
                                    htmlFor={`sprite-state-${idx}-${itemIdx}-${stateIdx}`}
                                    className="bg-blue-500 text-white px-2 py-1 rounded text-xs cursor-pointer inline-block whitespace-nowrap"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      fileInputRefs.current[`sprite-${idx}-${itemIdx}-${stateIdx}`]?.click();
                                    }}
                                  >
                                    Upload Image
                                  </label>
                                  {spriteStateUploadState[`sprite-${idx}-${itemIdx}-${stateIdx}`]?.uploading && (
                                    <span className="text-xs text-blue-400">Uploading...</span>
                                  )}
                                  {spriteStateUploadState[`sprite-${idx}-${itemIdx}-${stateIdx}`]?.error && (
                                    <span className="text-xs text-red-400">{spriteStateUploadState[`sprite-${idx}-${itemIdx}-${stateIdx}`].error}</span>
                                  )}
                                  {typeof stateImage === 'string' && stateImage && !spriteStateUploadState[`sprite-${idx}-${itemIdx}-${stateIdx}`]?.uploading && (
                                    <img src={stateImage} alt={stateKey} className="h-8 w-8 object-cover rounded ml-1" />
                                  )}
                                </div>
                              </div>
                            ))}
                            <button
                              type="button"
                              className="bg-slate-700 text-white px-2 py-1 rounded text-xs"
                              onClick={() => {
                                const updated = [...scenes];
                                const cur = updated[idx].items[itemIdx];
                                const curStates = { ...((cur.properties?.spriteStates && typeof cur.properties.spriteStates === 'object') ? cur.properties.spriteStates : {}) } as Record<string, string>;
                                let baseKey = 'state';
                                let nextKey = baseKey;
                                let suffix = 2;
                                while (Object.prototype.hasOwnProperty.call(curStates, nextKey)) {
                                  nextKey = `${baseKey}${suffix}`;
                                  suffix += 1;
                                }
                                curStates[nextKey] = '';
                                const nextProps = { ...(cur.properties || {}), spriteStates: curStates };
                                updated[idx].items[itemIdx] = { ...cur, properties: nextProps };
                                setScenes(updated);
                              }}
                            >
                              + Add Sprite State
                            </button>
                            <div className="mt-2">
                              <label className="block text-xs">State transition (ms, optional)</label>
                              <input
                                type="number"
                                min={0}
                                value={typeof item.properties?.stateTransitionMs === 'number' ? item.properties.stateTransitionMs : ''}
                                onChange={(e) => {
                                  const updated = [...scenes];
                                  const cur = updated[idx].items[itemIdx];
                                  const value = e.target.value.trim();
                                  const nextProps = { ...(cur.properties || {}) } as Record<string, any>;
                                  if (!value) {
                                    delete nextProps.stateTransitionMs;
                                  } else {
                                    const parsed = Number(value);
                                    if (!Number.isNaN(parsed) && parsed >= 0) {
                                      nextProps.stateTransitionMs = parsed;
                                    }
                                  }
                                  updated[idx].items[itemIdx] = { ...cur, properties: nextProps };
                                  setScenes(updated);
                                }}
                                placeholder="180"
                                className="border rounded px-2 py-1 text-xs w-24"
                              />
                            </div>
                          </div>
                          <div className="mt-1 flex gap-2 items-center">
                            <div className="text-xs text-gray-300">
                              <div>Size: {Math.round(item.w ?? 48)}×{Math.round(item.h ?? 48)}</div>
                              <div className="text-[11px] text-gray-400">Resize on the preview canvas (corner handles). Hold Shift to lock aspect ratio.</div>
                            </div>
                          </div>
                            </div>
                          </details>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {/* Interactive zones management */}
                <div className="mb-2">
                  <label className="block text-sm font-semibold">Interactive Zones</label>
                  <button className="bg-blue-500 text-white px-2 py-1 rounded text-xs mb-2" type="button" onClick={() => {
                    const updated = [...scenes];
                    updated[idx].interactiveZones.push({ id: Date.now().toString(), label: '', x: 0, y: 0, width: 100, height: 100, actionType: 'modal', modalContent: '' });
                    setScenes(updated);
                  }}>+ Add Zone</button>
                  {scene.interactiveZones.length === 0 ? <div className="text-xs text-gray-400">No interactive zones</div> : (
                    <ul className="space-y-2">
                      {scene.interactiveZones.map((zone, zoneIdx) => (
                        <li key={zone.id}>
                          <details className="border rounded">
                            <summary className="flex items-center gap-2 px-2 py-2 cursor-pointer select-none bg-slate-800/30 hover:bg-slate-800/50 [&::-webkit-details-marker]:hidden list-none rounded">
                              <span className="text-xs font-semibold flex-1 truncate">{zone.label || <span className="text-gray-400 italic font-normal">Unlabeled Zone</span>}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                zone.actionType === 'collect' ? 'bg-green-900/60 text-green-300' :
                                zone.actionType === 'trigger' ? 'bg-amber-900/60 text-amber-300' :
                                zone.actionType === 'codeEntry' ? 'bg-cyan-900/60 text-cyan-300' :
                                'bg-blue-900/60 text-blue-300'
                              }`}>{zone.actionType === 'codeEntry' ? 'code entry' : zone.actionType}</span>
                              <span className="text-[10px] text-gray-400">▸ edit</span>
                            </summary>
                            <div className="px-2 pb-2 border-t border-slate-700/50">
                          <div className="flex gap-2 items-center mb-1 mt-2">
                            <input value={zone.label} onChange={e => {
                              const updated = [...scenes];
                              updated[idx].interactiveZones[zoneIdx].label = e.target.value;
                              setScenes(updated);
                            }} placeholder="Zone Label" className="border rounded px-2 py-1 text-xs" />
                            <select value={zone.actionType} onChange={e => {
                              const updated = [...scenes];
                              updated[idx].interactiveZones[zoneIdx].actionType = e.target.value as any;
                              setScenes(updated);
                            }} className="border rounded px-2 py-1 text-xs">
                              <option value="modal">Modal</option>
                              <option value="collect">Collect Item</option>
                              <option value="trigger">Trigger / Advance Scene</option>
                              <option value="codeEntry">Code Entry (Combination Lock)</option>
                            </select>
                            <button className="text-red-500 text-xs" type="button" onClick={() => {
                              const updated = [...scenes];
                              updated[idx].interactiveZones = updated[idx].interactiveZones.filter((_, i) => i !== zoneIdx);
                              setScenes(updated);
                            }}>Remove</button>
                          </div>
                          <div className="flex gap-2 mb-1">
                            <input type="number" value={zone.x} onChange={e => {
                              const updated = [...scenes];
                              updated[idx].interactiveZones[zoneIdx].x = Number(e.target.value);
                              setScenes(updated);
                            }} placeholder="X" className="border rounded px-2 py-1 w-16 text-xs" />
                            <input type="number" value={zone.y} onChange={e => {
                              const updated = [...scenes];
                              updated[idx].interactiveZones[zoneIdx].y = Number(e.target.value);
                              setScenes(updated);
                            }} placeholder="Y" className="border rounded px-2 py-1 w-16 text-xs" />
                            <input type="number" value={zone.width} onChange={e => {
                              const updated = [...scenes];
                              updated[idx].interactiveZones[zoneIdx].width = Number(e.target.value);
                              setScenes(updated);
                            }} placeholder="Width" className="border rounded px-2 py-1 w-16 text-xs" />
                            <input type="number" value={zone.height} onChange={e => {
                              const updated = [...scenes];
                              updated[idx].interactiveZones[zoneIdx].height = Number(e.target.value);
                              setScenes(updated);
                            }} placeholder="Height" className="border rounded px-2 py-1 w-16 text-xs" />
                          </div>
                          {/* Puzzle linking for zone */}
                          <div className="mt-1">
                            <label className="block text-xs">Linked Puzzle (optional)</label>
                            <select value={zone.linkedPuzzleId || ''} onChange={e => {
                              const updated = [...scenes];
                              updated[idx].interactiveZones[zoneIdx].linkedPuzzleId = e.target.value || undefined;
                              setScenes(updated);
                            }} className="border rounded px-2 py-1 text-xs">
                              <option value="">None</option>
                              {dummyPuzzles.map(pz => <option key={pz.id} value={pz.id}>{pz.title}</option>)}
                            </select>
                          </div>

                          <div className="mb-2">
                            <label className="block text-xs font-semibold">Unlock / Use Wiring (optional)</label>
                            <div className="flex flex-wrap items-center gap-3">
                              <div>
                                <label className="block text-xs">Requires Item (drag this onto the zone)</label>
                                <select
                                  value={zone.requiredItemId || ''}
                                  onChange={(e) => {
                                    const updated = [...scenes];
                                    updated[idx].interactiveZones[zoneIdx].requiredItemId = e.target.value || undefined;
                                    setScenes(updated);
                                  }}
                                  className="border rounded px-2 py-1 text-xs"
                                >
                                  <option value="">None</option>
                                  {scene.items.map((it) => (
                                    <option key={it.id} value={it.id}>
                                      {it.name || 'Unnamed Item'}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <label className="text-xs flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={!!zone.disabledByDefault}
                                  onChange={(e) => {
                                    const updated = [...scenes];
                                    updated[idx].interactiveZones[zoneIdx].disabledByDefault = !!e.target.checked;
                                    setScenes(updated);
                                  }}
                                />
                                Disabled by default (must be enabled by an effect)
                              </label>

                              <label className="text-xs flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={zone.consumeItemOnUse === false}
                                  onChange={(e) => {
                                    const updated = [...scenes];
                                    updated[idx].interactiveZones[zoneIdx].consumeItemOnUse = e.target.checked ? false : undefined;
                                    setScenes(updated);
                                  }}
                                />
                                Do not consume item on use
                              </label>
                            </div>

                            <div className="mt-2 grid grid-cols-1 gap-2">
                              <div className="text-xs text-gray-500">
                                Use effects: hide/show items, enable zones, switch item sprite states, or override item image URLs.
                              </div>

                              <div className="flex flex-wrap gap-6">
                                <div>
                                  <div className="text-xs font-semibold">Hide Item(s)</div>
                                  <div className="max-h-32 overflow-auto border rounded p-2 text-xs">
                                    {scene.items.length === 0 ? (
                                      <div className="text-gray-400">No items in this scene.</div>
                                    ) : (
                                      scene.items.map((it) => {
                                        const selected = Array.isArray(zone.useEffect?.hideItemIds) && zone.useEffect!.hideItemIds!.includes(it.id);
                                        return (
                                          <label key={it.id} className="flex items-center gap-2">
                                            <input
                                              type="checkbox"
                                              checked={!!selected}
                                              onChange={(e) => {
                                                const updated = [...scenes];
                                                const z = updated[idx].interactiveZones[zoneIdx];
                                                const ue = { ...(z.useEffect || {}) } as any;
                                                const cur = Array.isArray(ue.hideItemIds) ? ue.hideItemIds.slice() : [];
                                                const next = e.target.checked ? Array.from(new Set([...cur, it.id])) : cur.filter((x: string) => x !== it.id);
                                                ue.hideItemIds = next;
                                                z.useEffect = ue;
                                                updated[idx].interactiveZones[zoneIdx] = { ...z };
                                                setScenes(updated);
                                              }}
                                            />
                                            {it.name || it.id}
                                          </label>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>

                                <div>
                                  <div className="text-xs font-semibold">Show Item(s)</div>
                                  <div className="max-h-32 overflow-auto border rounded p-2 text-xs">
                                    {scene.items.length === 0 ? (
                                      <div className="text-gray-400">No items in this scene.</div>
                                    ) : (
                                      scene.items.map((it) => {
                                        const selected = Array.isArray(zone.useEffect?.showItemIds) && zone.useEffect!.showItemIds!.includes(it.id);
                                        return (
                                          <label key={it.id} className="flex items-center gap-2">
                                            <input
                                              type="checkbox"
                                              checked={!!selected}
                                              onChange={(e) => {
                                                const updated = [...scenes];
                                                const z = updated[idx].interactiveZones[zoneIdx];
                                                const ue = { ...(z.useEffect || {}) } as any;
                                                const cur = Array.isArray(ue.showItemIds) ? ue.showItemIds.slice() : [];
                                                const next = e.target.checked ? Array.from(new Set([...cur, it.id])) : cur.filter((x: string) => x !== it.id);
                                                ue.showItemIds = next;
                                                z.useEffect = ue;
                                                updated[idx].interactiveZones[zoneIdx] = { ...z };
                                                setScenes(updated);
                                              }}
                                            />
                                            {it.name || it.id}
                                          </label>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>

                                <div>
                                  <div className="text-xs font-semibold">Enable Zone(s)</div>
                                  <div className="max-h-32 overflow-auto border rounded p-2 text-xs">
                                    {scene.interactiveZones.length === 0 ? (
                                      <div className="text-gray-400">No zones in this scene.</div>
                                    ) : (
                                      scene.interactiveZones.map((z2) => {
                                        const selected = Array.isArray(zone.useEffect?.enableHotspotIds) && zone.useEffect!.enableHotspotIds!.includes(z2.id);
                                        return (
                                          <label key={z2.id} className="flex items-center gap-2">
                                            <input
                                              type="checkbox"
                                              checked={!!selected}
                                              onChange={(e) => {
                                                const updated = [...scenes];
                                                const z = updated[idx].interactiveZones[zoneIdx];
                                                const ue = { ...(z.useEffect || {}) } as any;
                                                const cur = Array.isArray(ue.enableHotspotIds) ? ue.enableHotspotIds.slice() : [];
                                                const next = e.target.checked ? Array.from(new Set([...cur, z2.id])) : cur.filter((x: string) => x !== z2.id);
                                                ue.enableHotspotIds = next;
                                                z.useEffect = ue;
                                                updated[idx].interactiveZones[zoneIdx] = { ...z };
                                                setScenes(updated);
                                              }}
                                            />
                                            {z2.label || z2.id} ({z2.actionType})
                                          </label>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>

                                <div>
                                  <div className="text-xs font-semibold">Set Item State</div>
                                  <div className="max-h-32 overflow-auto border rounded p-2 text-xs">
                                    {scene.items.length === 0 ? (
                                      <div className="text-gray-400">No items in this scene.</div>
                                    ) : (
                                      scene.items.map((it) => {
                                        const spriteStates = (it.properties?.spriteStates && typeof it.properties.spriteStates === 'object') ? it.properties.spriteStates as Record<string, string> : {};
                                        const stateKeys = Object.keys(spriteStates).filter((k) => typeof spriteStates[k] === 'string');
                                        const selectedState = typeof zone.useEffect?.setItemStateById?.[it.id] === 'string' ? zone.useEffect!.setItemStateById![it.id] : '';
                                        return (
                                          <div key={it.id} className="mb-2">
                                            <div className="text-[11px] text-gray-300">{it.name || it.id}</div>
                                            <select
                                              value={selectedState}
                                              onChange={(e) => {
                                                const updated = [...scenes];
                                                const z = updated[idx].interactiveZones[zoneIdx];
                                                const ue = { ...(z.useEffect || {}) } as any;
                                                const curMap = (ue.setItemStateById && typeof ue.setItemStateById === 'object') ? { ...ue.setItemStateById } : {};
                                                const nextValue = e.target.value;
                                                if (nextValue) curMap[it.id] = nextValue;
                                                else delete curMap[it.id];
                                                ue.setItemStateById = Object.keys(curMap).length > 0 ? curMap : undefined;
                                                z.useEffect = ue;
                                                updated[idx].interactiveZones[zoneIdx] = { ...z };
                                                setScenes(updated);
                                              }}
                                              className="border rounded px-2 py-1 text-xs w-full"
                                            >
                                              <option value="">No change</option>
                                              {stateKeys.map((key) => (
                                                <option key={`${it.id}-${key}`} value={key}>{key}</option>
                                              ))}
                                            </select>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>

                                <div>
                                  <div className="text-xs font-semibold">Set Item Image URL</div>
                                  <div className="max-h-32 overflow-auto border rounded p-2 text-xs">
                                    {scene.items.length === 0 ? (
                                      <div className="text-gray-400">No items in this scene.</div>
                                    ) : (
                                      scene.items.map((it) => {
                                        const selectedImage = typeof zone.useEffect?.setItemImageById?.[it.id] === 'string' ? zone.useEffect!.setItemImageById![it.id] : '';
                                        return (
                                          <div key={it.id} className="mb-2">
                                            <div className="text-[11px] text-gray-300">{it.name || it.id}</div>
                                            <input
                                              type="text"
                                              value={selectedImage}
                                              onChange={(e) => {
                                                const updated = [...scenes];
                                                const z = updated[idx].interactiveZones[zoneIdx];
                                                const ue = { ...(z.useEffect || {}) } as any;
                                                const curMap = (ue.setItemImageById && typeof ue.setItemImageById === 'object') ? { ...ue.setItemImageById } : {};
                                                const nextValue = e.target.value.trim();
                                                if (nextValue) curMap[it.id] = nextValue;
                                                else delete curMap[it.id];
                                                ue.setItemImageById = Object.keys(curMap).length > 0 ? curMap : undefined;
                                                z.useEffect = ue;
                                                updated[idx].interactiveZones[zoneIdx] = { ...z };
                                                setScenes(updated);
                                              }}
                                              placeholder="No change"
                                              className="border rounded px-2 py-1 text-xs w-full"
                                            />
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>

                                <div>
                                  <div className="text-xs font-semibold">Set Item Opacity</div>
                                  <div className="max-h-32 overflow-auto border rounded p-2 text-xs">
                                    {scene.items.length === 0 ? (
                                      <div className="text-gray-400">No items in this scene.</div>
                                    ) : (
                                      scene.items.map((it) => {
                                        const selectedAlpha = zone.useEffect?.setItemAlphaById?.[it.id];
                                        return (
                                          <div key={it.id} className="mb-2">
                                            <div className="text-[11px] text-gray-300">{it.name || it.id}</div>
                                            <input
                                              type="number"
                                              min={0}
                                              max={1}
                                              step={0.05}
                                              value={selectedAlpha === undefined ? '' : selectedAlpha}
                                              onChange={(e) => {
                                                const updated = [...scenes];
                                                const z = updated[idx].interactiveZones[zoneIdx];
                                                const ue = { ...(z.useEffect || {}) } as any;
                                                const curMap = (ue.setItemAlphaById && typeof ue.setItemAlphaById === 'object') ? { ...ue.setItemAlphaById } : {};
                                                const raw = e.target.value.trim();
                                                if (!raw) {
                                                  delete curMap[it.id];
                                                } else {
                                                  const parsed = Number(raw);
                                                  if (Number.isFinite(parsed)) curMap[it.id] = Math.max(0, Math.min(1, parsed));
                                                }
                                                ue.setItemAlphaById = Object.keys(curMap).length > 0 ? curMap : undefined;
                                                z.useEffect = ue;
                                                updated[idx].interactiveZones[zoneIdx] = { ...z };
                                                setScenes(updated);
                                              }}
                                              placeholder="No change"
                                              className="border rounded px-2 py-1 text-xs w-full"
                                            />
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>

                                <div>
                                  <div className="text-xs font-semibold">Set Item Scale</div>
                                  <div className="max-h-32 overflow-auto border rounded p-2 text-xs">
                                    {scene.items.length === 0 ? (
                                      <div className="text-gray-400">No items in this scene.</div>
                                    ) : (
                                      scene.items.map((it) => {
                                        const selectedScale = zone.useEffect?.setItemScaleById?.[it.id];
                                        return (
                                          <div key={it.id} className="mb-2">
                                            <div className="text-[11px] text-gray-300">{it.name || it.id}</div>
                                            <input
                                              type="number"
                                              min={0.1}
                                              max={5}
                                              step={0.1}
                                              value={selectedScale === undefined ? '' : selectedScale}
                                              onChange={(e) => {
                                                const updated = [...scenes];
                                                const z = updated[idx].interactiveZones[zoneIdx];
                                                const ue = { ...(z.useEffect || {}) } as any;
                                                const curMap = (ue.setItemScaleById && typeof ue.setItemScaleById === 'object') ? { ...ue.setItemScaleById } : {};
                                                const raw = e.target.value.trim();
                                                if (!raw) {
                                                  delete curMap[it.id];
                                                } else {
                                                  const parsed = Number(raw);
                                                  if (Number.isFinite(parsed) && parsed > 0) curMap[it.id] = Math.max(0.1, Math.min(5, parsed));
                                                }
                                                ue.setItemScaleById = Object.keys(curMap).length > 0 ? curMap : undefined;
                                                z.useEffect = ue;
                                                updated[idx].interactiveZones[zoneIdx] = { ...z };
                                                setScenes(updated);
                                              }}
                                              placeholder="No change"
                                              className="border rounded px-2 py-1 text-xs w-full"
                                            />
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>

                                <div>
                                  <div className="text-xs font-semibold">Set Item Rotation (deg)</div>
                                  <div className="max-h-32 overflow-auto border rounded p-2 text-xs">
                                    {scene.items.length === 0 ? (
                                      <div className="text-gray-400">No items in this scene.</div>
                                    ) : (
                                      scene.items.map((it) => {
                                        const selectedRotation = zone.useEffect?.setItemRotationById?.[it.id];
                                        return (
                                          <div key={it.id} className="mb-2">
                                            <div className="text-[11px] text-gray-300">{it.name || it.id}</div>
                                            <input
                                              type="number"
                                              step={1}
                                              value={selectedRotation === undefined ? '' : selectedRotation}
                                              onChange={(e) => {
                                                const updated = [...scenes];
                                                const z = updated[idx].interactiveZones[zoneIdx];
                                                const ue = { ...(z.useEffect || {}) } as any;
                                                const curMap = (ue.setItemRotationById && typeof ue.setItemRotationById === 'object') ? { ...ue.setItemRotationById } : {};
                                                const raw = e.target.value.trim();
                                                if (!raw) {
                                                  delete curMap[it.id];
                                                } else {
                                                  const parsed = Number(raw);
                                                  if (Number.isFinite(parsed)) curMap[it.id] = parsed;
                                                }
                                                ue.setItemRotationById = Object.keys(curMap).length > 0 ? curMap : undefined;
                                                z.useEffect = ue;
                                                updated[idx].interactiveZones[zoneIdx] = { ...z };
                                                setScenes(updated);
                                              }}
                                              placeholder="No change"
                                              className="border rounded px-2 py-1 text-xs w-full"
                                            />
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>

                                <div>
                                  <div className="text-xs font-semibold">Set Item Tint</div>
                                  <div className="max-h-32 overflow-auto border rounded p-2 text-xs">
                                    {scene.items.length === 0 ? (
                                      <div className="text-gray-400">No items in this scene.</div>
                                    ) : (
                                      scene.items.map((it) => {
                                        const selectedTint = typeof zone.useEffect?.setItemTintById?.[it.id] === 'string' ? zone.useEffect!.setItemTintById![it.id] : '';
                                        return (
                                          <div key={it.id} className="mb-2">
                                            <div className="text-[11px] text-gray-300">{it.name || it.id}</div>
                                            <input
                                              type="text"
                                              value={selectedTint}
                                              onChange={(e) => {
                                                const updated = [...scenes];
                                                const z = updated[idx].interactiveZones[zoneIdx];
                                                const ue = { ...(z.useEffect || {}) } as any;
                                                const curMap = (ue.setItemTintById && typeof ue.setItemTintById === 'object') ? { ...ue.setItemTintById } : {};
                                                const nextValue = e.target.value.trim();
                                                if (nextValue) curMap[it.id] = nextValue;
                                                else delete curMap[it.id];
                                                ue.setItemTintById = Object.keys(curMap).length > 0 ? curMap : undefined;
                                                z.useEffect = ue;
                                                updated[idx].interactiveZones[zoneIdx] = { ...z };
                                                setScenes(updated);
                                              }}
                                              placeholder="#ffcc00"
                                              className="border rounded px-2 py-1 text-xs w-full"
                                            />
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Cross-scene effects */}
                            <div className="mt-3">
                              <div className="text-xs font-semibold text-amber-300">Cross-Scene Effects</div>
                              <p className="text-[11px] text-gray-400 mb-2">When this zone fires, show/hide items or enable/disable zones in OTHER scenes (essential for multi-room co-op).</p>
                              {scenes.filter(s => s.id !== scene.id).length === 0 ? (
                                <div className="text-xs text-gray-400">Add more scenes to wire cross-scene effects.</div>
                              ) : (
                                <div className="space-y-3">
                                  {scenes.filter(s => s.id !== scene.id).map(targetScene => {
                                    const cseList: Array<any> = Array.isArray(zone.useEffect?.crossSceneEffects) ? zone.useEffect!.crossSceneEffects! : [];
                                    const cse = cseList.find((c: any) => c?.sceneId === targetScene.id) || null;
                                    const toggleCse = (field: string, itemId: string, checked: boolean) => {
                                      const updated = [...scenes];
                                      const z = updated[idx].interactiveZones[zoneIdx];
                                      const ue = { ...(z.useEffect || {}) } as any;
                                      const cur: any[] = Array.isArray(ue.crossSceneEffects) ? ue.crossSceneEffects.slice() : [];
                                      const existing = cur.find((c: any) => c?.sceneId === targetScene.id);
                                      if (existing) {
                                        const arr = Array.isArray(existing[field]) ? existing[field].slice() : [];
                                        existing[field] = checked ? Array.from(new Set([...arr, itemId])) : arr.filter((x: string) => x !== itemId);
                                      } else if (checked) {
                                        cur.push({ sceneId: targetScene.id, [field]: [itemId] });
                                      }
                                      ue.crossSceneEffects = cur.filter((c: any) => {
                                        return (['showItemIds','hideItemIds','enableHotspotIds','disableHotspotIds'] as const).some(f => Array.isArray(c[f]) && c[f].length > 0);
                                      });
                                      z.useEffect = Object.keys(ue).length > 0 ? ue : undefined;
                                      updated[idx].interactiveZones[zoneIdx] = { ...z };
                                      setScenes(updated);
                                    };
                                    return (
                                      <details key={targetScene.id} className="border border-slate-600 rounded p-2">
                                        <summary className="text-xs cursor-pointer text-cyan-200">→ {targetScene.name || `Scene (${targetScene.id.slice(-6)})`}</summary>
                                        <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                                          {(['showItemIds', 'hideItemIds'] as const).map(field => (
                                            <div key={field}>
                                              <div className="font-semibold">{field === 'showItemIds' ? 'Show Items' : 'Hide Items'}</div>
                                              {targetScene.items.length === 0 ? <div className="text-gray-400">No items</div> : targetScene.items.map(it => (
                                                <label key={it.id} className="flex items-center gap-1">
                                                  <input type="checkbox"
                                                    checked={!!(cse && Array.isArray(cse[field]) && cse[field].includes(it.id))}
                                                    onChange={e => toggleCse(field, it.id, e.target.checked)}
                                                  />
                                                  {it.name || it.id}
                                                </label>
                                              ))}
                                            </div>
                                          ))}
                                          {(['enableHotspotIds', 'disableHotspotIds'] as const).map(field => (
                                            <div key={field}>
                                              <div className="font-semibold">{field === 'enableHotspotIds' ? 'Enable Zones' : 'Disable Zones'}</div>
                                              {targetScene.interactiveZones.length === 0 ? <div className="text-gray-400">No zones</div> : targetScene.interactiveZones.map(tz => (
                                                <label key={tz.id} className="flex items-center gap-1">
                                                  <input type="checkbox"
                                                    checked={!!(cse && Array.isArray(cse[field]) && cse[field].includes(tz.id))}
                                                    onChange={e => toggleCse(field, tz.id, e.target.checked)}
                                                  />
                                                  {tz.label || tz.id}
                                                </label>
                                              ))}
                                            </div>
                                          ))}
                                        </div>
                                      </details>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Room Completion flag on use effect */}
                            <div className="mt-2 flex flex-wrap items-center gap-4">
                              <label className="text-xs flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={!!zone.useEffect?.completesRoom}
                                  onChange={e => {
                                    const updated = [...scenes];
                                    const z = updated[idx].interactiveZones[zoneIdx];
                                    const ue = { ...(z.useEffect || {}) } as any;
                                    ue.completesRoom = e.target.checked ? true : undefined;
                                    z.useEffect = Object.values(ue).some(v => v !== undefined) ? ue : undefined;
                                    updated[idx].interactiveZones[zoneIdx] = { ...z };
                                    setScenes(updated);
                                  }}
                                />
                                <span className="font-semibold text-emerald-300">This effect completes the room</span>
                              </label>
                              {zone.useEffect?.completesRoom && (
                                <div>
                                  <input
                                    value={zone.useEffect?.completionVariant || ''}
                                    onChange={e => {
                                      const updated = [...scenes];
                                      const z = updated[idx].interactiveZones[zoneIdx];
                                      const ue = { ...(z.useEffect || {}) } as any;
                                      ue.completionVariant = e.target.value || undefined;
                                      z.useEffect = ue;
                                      updated[idx].interactiveZones[zoneIdx] = { ...z };
                                      setScenes(updated);
                                    }}
                                    placeholder="Completion variant label (e.g. 'Hard Reset')"
                                    className="border rounded px-2 py-1 text-xs w-64"
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {zone.actionType === 'modal' && (
                            <>
                              <div className="mb-1">
                                <label className="block text-xs">Associated Item (shows image/description)</label>
                                <select
                                  value={zone.itemId || ''}
                                  onChange={e => {
                                    const updated = [...scenes];
                                    updated[idx].interactiveZones[zoneIdx].itemId = e.target.value || undefined;
                                    setScenes(updated);
                                  }}
                                  className="border rounded px-2 py-1 text-xs"
                                >
                                  <option value="">None</option>
                                  {scene.items.map(it => <option key={it.id} value={it.id}>{it.name || 'Unnamed Item'}</option>)}
                                </select>
                                <div className="mt-1">
                                  <label className="block text-xs">Modal image override (optional)</label>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={zone.imageUrl || ''}
                                      onChange={e => {
                                        const updated = [...scenes];
                                        updated[idx].interactiveZones[zoneIdx].imageUrl = e.target.value || undefined;
                                        setScenes(updated);
                                      }}
                                      placeholder="Paste an image URL (optional)"
                                      className="border rounded px-2 py-1 text-xs w-64"
                                    />

                                    <input
                                      type="file"
                                      accept="image/*"
                                      id={`zone-image-${idx}-${zoneIdx}`}
                                      style={{ display: 'none' }}
                                      onChange={async (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const file = e.target.files?.[0];
                                        const key = `${idx}-${zoneIdx}`;
                                        setZoneUploadState(prev => ({ ...prev, [key]: { uploading: true, error: '' } }));
                                        try {
                                          if (!file) {
                                            setZoneUploadState(prev => ({ ...prev, [key]: { uploading: false, error: 'No file selected' } }));
                                            return;
                                          }
                                          if (file.size > MAX_CLIENT_UPLOAD) {
                                            setZoneUploadState(prev => ({ ...prev, [key]: { uploading: false, error: `File too large (> ${Math.round(MAX_CLIENT_UPLOAD / (1024*1024))}MB)` } }));
                                            return;
                                          }
                                          const formData = new FormData();
                                          formData.append('file', file);
                                          if (editId) formData.append('puzzleId', editId);
                                          const res = await fetch('/api/admin/media', { method: 'POST', body: formData });
                                          const data = await res.json().catch(() => ({}));
                                          if (res.ok && (data.mediaUrl || data.url)) {
                                            const uploadedUrl = data.mediaUrl || data.url;
                                            const updated = [...scenes];
                                            updated[idx].interactiveZones[zoneIdx].imageUrl = uploadedUrl;
                                            setScenes(updated);
                                            setZoneUploadState(prev => ({ ...prev, [key]: { uploading: false, error: '' } }));
                                          } else {
                                            const errMsg = (data && (data.error || data.message)) || `Upload failed (${res.status})`;
                                            setZoneUploadState(prev => ({ ...prev, [key]: { uploading: false, error: errMsg } }));
                                          }
                                        } catch (err) {
                                          const errMsg = err instanceof Error ? err.message : String(err);
                                          setZoneUploadState(prev => ({ ...prev, [key]: { uploading: false, error: errMsg } }));
                                        }
                                      }}
                                    />
                                    <label
                                      htmlFor={`zone-image-${idx}-${zoneIdx}`}
                                      className="bg-blue-500 text-white px-2 py-1 rounded text-xs cursor-pointer"
                                    >
                                      Upload Image
                                    </label>

                                    {zoneUploadState[`${idx}-${zoneIdx}`]?.uploading && (
                                      <span className="text-xs text-blue-400">Uploading...</span>
                                    )}
                                    {zoneUploadState[`${idx}-${zoneIdx}`]?.error && (
                                      <span className="text-xs text-red-400">{zoneUploadState[`${idx}-${zoneIdx}`].error}</span>
                                    )}

                                    {zone.imageUrl && !zoneUploadState[`${idx}-${zoneIdx}`]?.uploading && (
                                      <img src={zone.imageUrl} alt="modal" className="h-8 w-8 object-cover rounded" />
                                    )}
                                  </div>
                                  <div className="text-[11px] text-gray-400 mt-1">
                                    If set, this image is shown in the player modal. Otherwise it uses the Associated Item image.
                                  </div>
                                </div>
                              </div>

                              <textarea
                                value={zone.modalContent}
                                onChange={e => {
                                  const updated = [...scenes];
                                  updated[idx].interactiveZones[zoneIdx].modalContent = e.target.value;
                                  setScenes(updated);
                                }}
                                placeholder="Modal Content (Markdown or HTML)"
                                className="border rounded px-2 py-1 w-full text-xs"
                              />

                              <div className="mt-2">
                                <div className="flex items-center justify-between">
                                  <label className="block text-xs font-semibold">Extra Interactions (optional)</label>
                                  <button
                                    type="button"
                                    className="bg-blue-500 text-white px-2 py-1 rounded text-xs"
                                    onClick={() => {
                                      const updated = [...scenes];
                                      const existing = updated[idx].interactiveZones[zoneIdx].interactions || [];
                                      updated[idx].interactiveZones[zoneIdx].interactions = [...existing, { label: 'Read', modalContent: '' }];
                                      setScenes(updated);
                                    }}
                                  >
                                    + Add Interaction
                                  </button>
                                </div>

                                {(zone.interactions || []).length === 0 ? (
                                  <div className="text-xs text-gray-400">No extra interactions.</div>
                                ) : (
                                  <div className="mt-1 space-y-2">
                                    {(zone.interactions || []).map((itx, itxIdx) => (
                                      <div key={itxIdx} className="border border-slate-600 rounded p-2 space-y-2">
                                        <div className="flex items-center gap-2">
                                          <input
                                            value={itx.label}
                                            onChange={e => {
                                              const updated = [...scenes];
                                              const arr = updated[idx].interactiveZones[zoneIdx].interactions || [];
                                              arr[itxIdx] = { ...arr[itxIdx], label: e.target.value };
                                              updated[idx].interactiveZones[zoneIdx].interactions = [...arr];
                                              setScenes(updated);
                                            }}
                                            placeholder="Button Label"
                                            className="border rounded px-2 py-1 text-xs flex-1"
                                          />
                                          <button
                                            type="button"
                                            className="text-red-500 text-xs"
                                            onClick={() => {
                                              const updated = [...scenes];
                                              const arr = (updated[idx].interactiveZones[zoneIdx].interactions || []).filter((_, j) => j !== itxIdx);
                                              updated[idx].interactiveZones[zoneIdx].interactions = arr;
                                              setScenes(updated);
                                            }}
                                          >
                                            Remove
                                          </button>
                                        </div>
                                        <textarea
                                          value={itx.modalContent}
                                          onChange={e => {
                                            const updated = [...scenes];
                                            const arr = updated[idx].interactiveZones[zoneIdx].interactions || [];
                                            arr[itxIdx] = { ...arr[itxIdx], modalContent: e.target.value };
                                            updated[idx].interactiveZones[zoneIdx].interactions = [...arr];
                                            setScenes(updated);
                                          }}
                                          placeholder="Modal content shown when this option is chosen"
                                          className="border rounded px-2 py-1 w-full text-xs"
                                        />
                                        {/* Branch effects + completion flag per interaction */}
                                        <div className="rounded border border-slate-700 bg-slate-800/50 p-2 space-y-2">
                                          <div className="text-[11px] text-amber-200 font-semibold">On Choose: Effects &amp; Completion</div>
                                          <label className="text-xs flex items-center gap-2">
                                            <input
                                              type="checkbox"
                                              checked={!!(itx as any).completesRoom}
                                              onChange={e => {
                                                const updated = [...scenes];
                                                const arr = updated[idx].interactiveZones[zoneIdx].interactions || [];
                                                arr[itxIdx] = { ...arr[itxIdx], completesRoom: e.target.checked ? true : undefined } as any;
                                                updated[idx].interactiveZones[zoneIdx].interactions = [...arr];
                                                setScenes(updated);
                                              }}
                                            />
                                            <span className="text-emerald-300">Choosing this option completes the room</span>
                                          </label>
                                          {(itx as any).completesRoom && (
                                            <input
                                              value={(itx as any).completionVariant || ''}
                                              onChange={e => {
                                                const updated = [...scenes];
                                                const arr = updated[idx].interactiveZones[zoneIdx].interactions || [];
                                                arr[itxIdx] = { ...arr[itxIdx], completionVariant: e.target.value || undefined } as any;
                                                updated[idx].interactiveZones[zoneIdx].interactions = [...arr];
                                                setScenes(updated);
                                              }}
                                              placeholder="Completion variant (e.g. 'Hard Reset Ending')"
                                              className="border rounded px-2 py-1 text-xs w-full"
                                            />
                                          )}
                                          <label className="text-xs flex items-center gap-2">
                                            <input
                                              type="checkbox"
                                              checked={!!(itx as any).triggersEffect}
                                              onChange={e => {
                                                const updated = [...scenes];
                                                const arr = updated[idx].interactiveZones[zoneIdx].interactions || [];
                                                arr[itxIdx] = { ...arr[itxIdx], triggersEffect: e.target.checked ? {} : undefined } as any;
                                                updated[idx].interactiveZones[zoneIdx].interactions = [...arr];
                                                setScenes(updated);
                                              }}
                                            />
                                            Triggers scene effects when chosen
                                          </label>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                          {zone.actionType === 'collect' && (
                            <div className="mb-1 space-y-2">
                              <label className="block text-xs">Collects Item</label>
                              <select value={zone.collectItemId || ''} onChange={e => {
                                const updated = [...scenes];
                                updated[idx].interactiveZones[zoneIdx].collectItemId = e.target.value || undefined;
                                setScenes(updated);
                              }} className="border rounded px-2 py-1 text-xs">
                                <option value="">None</option>
                                {scene.items.map(it => <option key={it.id} value={it.id}>{it.name || 'Unnamed Item'}</option>)}
                              </select>

                              <div>
                                <label className="block text-xs">Pickup Animation Preset</label>
                                <select
                                  value={zone.pickupAnimationPreset || 'cinematic'}
                                  onChange={e => {
                                    const updated = [...scenes];
                                    updated[idx].interactiveZones[zoneIdx].pickupAnimationPreset = (e.target.value as any) || 'cinematic';
                                    setScenes(updated);
                                  }}
                                  className="border rounded px-2 py-1 text-xs"
                                >
                                  {pickupAnimationPresetOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          )}
                          {zone.actionType === 'trigger' && (
                            <div className="mb-1">
                              <label className="block text-xs">Event/Action Name</label>
                              <input value={zone.eventId || ''} onChange={e => {
                                const updated = [...scenes];
                                updated[idx].interactiveZones[zoneIdx].eventId = e.target.value;
                                setScenes(updated);
                              }} placeholder="Event Name" className="border rounded px-2 py-1 text-xs" />
                            </div>
                          )}

                          {zone.actionType === 'codeEntry' && (
                            <div className="mb-2 space-y-2 rounded border border-cyan-800/50 bg-slate-800/40 p-3">
                              <div className="text-xs font-semibold text-cyan-300">Code Entry Configuration</div>
                              <div>
                                <label className="block text-xs">Correct Code / Answer</label>
                                <input
                                  value={zone.codeEntry?.correctCode || ''}
                                  onChange={e => {
                                    const updated = [...scenes];
                                    const z = updated[idx].interactiveZones[zoneIdx];
                                    z.codeEntry = { ...(z.codeEntry || { correctCode: '' }), correctCode: e.target.value };
                                    setScenes(updated);
                                  }}
                                  placeholder="e.g. 4782 or REACTOR"
                                  className="border rounded px-2 py-1 text-xs w-full"
                                />
                              </div>
                              <label className="text-xs flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={!!zone.codeEntry?.caseSensitive}
                                  onChange={e => {
                                    const updated = [...scenes];
                                    const z = updated[idx].interactiveZones[zoneIdx];
                                    z.codeEntry = { ...(z.codeEntry || { correctCode: '' }), caseSensitive: e.target.checked };
                                    setScenes(updated);
                                  }}
                                />
                                Case-sensitive
                              </label>
                              <div>
                                <label className="block text-xs">Error Message (wrong code)</label>
                                <input
                                  value={zone.codeEntry?.errorMessage || ''}
                                  onChange={e => {
                                    const updated = [...scenes];
                                    const z = updated[idx].interactiveZones[zoneIdx];
                                    z.codeEntry = { ...(z.codeEntry || { correctCode: '' }), errorMessage: e.target.value };
                                    setScenes(updated);
                                  }}
                                  placeholder="Incorrect code. Try again."
                                  className="border rounded px-2 py-1 text-xs w-full"
                                />
                              </div>
                              <div className="flex gap-3">
                                <div>
                                  <label className="block text-xs">Cooldown after wrong (seconds)</label>
                                  <input
                                    type="number" min={0} step={1}
                                    value={zone.codeEntry?.cooldownSeconds ?? ''}
                                    onChange={e => {
                                      const updated = [...scenes];
                                      const z = updated[idx].interactiveZones[zoneIdx];
                                      const v = e.target.value.trim();
                                      z.codeEntry = { ...(z.codeEntry || { correctCode: '' }), cooldownSeconds: v ? Number(v) : undefined };
                                      setScenes(updated);
                                    }}
                                    placeholder="0"
                                    className="border rounded px-2 py-1 text-xs w-24"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs">Max attempts (0 = unlimited)</label>
                                  <input
                                    type="number" min={0} step={1}
                                    value={zone.codeEntry?.maxAttempts ?? ''}
                                    onChange={e => {
                                      const updated = [...scenes];
                                      const z = updated[idx].interactiveZones[zoneIdx];
                                      const v = e.target.value.trim();
                                      z.codeEntry = { ...(z.codeEntry || { correctCode: '' }), maxAttempts: v ? Number(v) : undefined };
                                      setScenes(updated);
                                    }}
                                    placeholder="0"
                                    className="border rounded px-2 py-1 text-xs w-24"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs">Terminal Display Item (shows typed code in scene)</label>
                                <select
                                  value={zone.codeEntry?.displayItemId || ''}
                                  onChange={e => {
                                    const updated = [...scenes];
                                    const z = updated[idx].interactiveZones[zoneIdx];
                                    z.codeEntry = { ...(z.codeEntry || { correctCode: '' }), displayItemId: e.target.value || undefined };
                                    setScenes(updated);
                                  }}
                                  className="border rounded px-2 py-1 text-xs w-full"
                                >
                                  <option value="">None — modal only</option>
                                  {scene.items.map((it: any) => (
                                    <option key={it.id} value={it.id}>{it.name || it.id}</option>
                                  ))}
                                </select>
                              </div>
                              <p className="text-[11px] text-gray-400">On correct entry, the zone&apos;s Use Effects fire (see wiring above). Completion flag also applies.</p>
                            </div>
                          )}
                            </div>
                          </details>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {/* Live preview placeholder */}
                <div className="mb-2 text-xs text-blue-700">Live preview coming soon...</div>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Player Notes</h2>
        <div className="mb-2">
          <button className="bg-blue-600 text-white px-4 py-2 rounded" type="button" onClick={() => setUserSpecialties([...userSpecialties, { id: Date.now().toString(), name: '', description: '' }])}>+ Add Note</button>
        </div>
        {userSpecialties.length === 0 ? <div className="text-gray-500">No player notes added yet.</div> : (
          <ul className="space-y-4">
            {userSpecialties.map((spec, idx) => (
              <li key={spec.id} className="border p-4 rounded">
                <div className="flex justify-between items-center mb-2">
                  <input value={spec.name} onChange={e => {
                    const updated = [...userSpecialties];
                    updated[idx].name = e.target.value;
                    setUserSpecialties(updated);
                  }} placeholder="Note Title" className="border rounded px-2 py-1 mr-2" />
                  <button className="text-red-600" type="button" onClick={() => setUserSpecialties(userSpecialties.filter((_, i) => i !== idx))}>Remove</button>
                </div>
                <div>
                  <label className="block text-sm">Description</label>
                  <input value={spec.description} onChange={e => {
                    const updated = [...userSpecialties];
                    updated[idx].description = e.target.value;
                    setUserSpecialties(updated);
                  }} className="border rounded px-2 py-1 w-full" />
                </div>
              </li>
            ))}
          </ul>
        )}
        {/* Save button for in-progress escape room design, now after player notes */}
        <div className="mb-8 flex justify-end">
          <button
            className="bg-green-600 text-white px-6 py-2 rounded font-semibold hover:bg-green-700 transition"
            type="button"
            onClick={async () => {
              setValidationError("");
              // Basic validation (optional, can be expanded)
              if (!title.trim()) {
                setValidationError("Title is required.");
                return;
              }
              if (scenes.length === 0) {
                setValidationError("At least one scene/room is required.");
                return;
              }
              // Notify parent (PuzzleTypeFields) of the latest data
              if (typeof onChange === 'function') {
                onChange({ title, description, timeLimit, scenes, userSpecialties });
              }

              // If we're in the standalone designer edit page, persist to the API.
              if (editId) {
                try {
                  const res = await fetch(`/api/escape-rooms/designer/${encodeURIComponent(editId)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      title,
                      description,
                      timeLimit,
                      startMode,
                      scenes,
                      userSpecialties,
                    }),
                  });
                  const j = await res.json().catch(() => null);
                  if (!res.ok) {
                    setValidationError(j?.error || `Save failed (${res.status})`);
                    return;
                  }
                  setValidationError('Escape room saved.');
                  return;
                } catch (err) {
                  setValidationError('Save failed: network error');
                  return;
                }
              }

              // Otherwise, just save the draft into the parent form.
              setValidationError("Escape room draft saved (in form, not submitted yet).");
            }}
          >
            Save Escape Room
          </button>
        </div>
      </section>
      <style jsx global>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .designer-pickup-reveal-cinematic {
          animation: designerPickupRevealCinematic 0.95s cubic-bezier(0.2, 0.7, 0.15, 1) forwards;
        }

        .designer-pickup-to-inventory-cinematic {
          animation: designerPickupToInventoryCinematic 0.78s cubic-bezier(0.3, 0.7, 0.2, 1) forwards;
        }

        .designer-pickup-reveal-quick-spin {
          animation: designerPickupRevealQuickSpin 0.62s cubic-bezier(0.2, 0.7, 0.25, 1) forwards;
        }

        .designer-pickup-reveal-float-in {
          animation: designerPickupRevealFloatIn 0.9s cubic-bezier(0.22, 0.7, 0.2, 1) forwards;
        }

        .designer-pickup-reveal-power-drop {
          animation: designerPickupRevealPowerDrop 0.86s cubic-bezier(0.18, 0.82, 0.24, 1) forwards;
        }

        .designer-pickup-to-inventory-quick-spin {
          animation: designerPickupToInventoryQuickSpin 0.55s cubic-bezier(0.24, 0.66, 0.2, 1) forwards;
        }

        .designer-pickup-to-inventory-float-in {
          animation: designerPickupToInventoryFloatIn 0.9s cubic-bezier(0.25, 0.8, 0.2, 1) forwards;
        }

        .designer-pickup-to-inventory-power-drop {
          animation: designerPickupToInventoryPowerDrop 0.72s cubic-bezier(0.27, 0.78, 0.22, 1) forwards;
        }

        @keyframes designerPickupRevealCinematic {
          0% { transform: translate(0px, 0px) scale(1) rotate(0deg); opacity: 1; }
          100% { transform: translate(var(--designer-pickup-reveal-dx, 0px), var(--designer-pickup-reveal-dy, 0px)) scale(var(--designer-pickup-reveal-scale, 1.68)) rotate(900deg); opacity: 1; }
        }

        @keyframes designerPickupToInventoryCinematic {
          0% { transform: translate(0px, 0px) scale(1) rotate(0deg); opacity: 1; }
          100% { transform: translate(var(--designer-pickup-dx, 0px), var(--designer-pickup-dy, 0px)) scale(var(--designer-pickup-scale, 0.34)) rotate(560deg); opacity: 0; }
        }

        @keyframes designerPickupRevealQuickSpin {
          0% { transform: translate(0px, 0px) scale(1) rotate(0deg); opacity: 1; }
          100% { transform: translate(var(--designer-pickup-reveal-dx, 0px), var(--designer-pickup-reveal-dy, 0px)) scale(var(--designer-pickup-reveal-scale, 1.45)) rotate(840deg); opacity: 1; }
        }

        @keyframes designerPickupRevealFloatIn {
          0% { transform: translate(0px, 0px) scale(1) rotate(-16deg); opacity: 1; }
          100% { transform: translate(var(--designer-pickup-reveal-dx, 0px), var(--designer-pickup-reveal-dy, 0px)) scale(var(--designer-pickup-reveal-scale, 1.35)) rotate(220deg); opacity: 1; }
        }

        @keyframes designerPickupRevealPowerDrop {
          0% { transform: translate(0px, 0px) scale(1.05) rotate(70deg); opacity: 1; }
          100% { transform: translate(var(--designer-pickup-reveal-dx, 0px), var(--designer-pickup-reveal-dy, 0px)) scale(var(--designer-pickup-reveal-scale, 1.52)) rotate(680deg); opacity: 1; }
        }

        @keyframes designerPickupToInventoryQuickSpin {
          0% { transform: translate(0px, 0px) scale(1.02) rotate(0deg); opacity: 1; }
          100% { transform: translate(var(--designer-pickup-dx, 0px), var(--designer-pickup-dy, 0px)) scale(calc(var(--designer-pickup-scale, 0.34) * 0.92)) rotate(720deg); opacity: 0; }
        }

        @keyframes designerPickupToInventoryFloatIn {
          0% { transform: translate(0px, 0px) scale(1) rotate(0deg); opacity: 1; }
          55% { transform: translate(calc(var(--designer-pickup-dx, 0px) * 0.45), calc(var(--designer-pickup-dy, 0px) * 0.35 - 18px)) scale(0.72) rotate(140deg); opacity: 0.88; }
          100% { transform: translate(var(--designer-pickup-dx, 0px), var(--designer-pickup-dy, 0px)) scale(var(--designer-pickup-scale, 0.34)) rotate(220deg); opacity: 0; }
        }

        @keyframes designerPickupToInventoryPowerDrop {
          0% { transform: translate(0px, 0px) scale(1.08) rotate(0deg); opacity: 1; }
          100% { transform: translate(var(--designer-pickup-dx, 0px), var(--designer-pickup-dy, 0px)) scale(calc(var(--designer-pickup-scale, 0.34) * 1.05)) rotate(460deg); opacity: 0; }
        }
      `}</style>
      {/* Save/Preview section removed to prevent duplicate submit UI in main form */}
    </div>
  );
}
