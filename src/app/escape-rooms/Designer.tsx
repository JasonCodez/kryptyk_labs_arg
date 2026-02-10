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
  linkedPuzzleId?: string;
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
  linkedPuzzleId?: string;
}

interface InteractiveZone {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  actionType: "modal" | "collect" | "trigger";
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
  interactions?: Array<{ label: string; modalContent: string }>;
  // Optional: designer-wired effects that are applied when using an inventory item on this zone.
  // NOTE: enable/disable IDs are designer zone ids (not DB hotspot ids).
  useEffect?: {
    hideItemIds?: string[];
    showItemIds?: string[];
    disableHotspotIds?: string[];
    enableHotspotIds?: string[];
  };
  eventId?: string;
  linkedPuzzleId?: string;
  collectItemId?: string;
}

interface UserSpecialty {
  id: string;
  name: string;
  description: string;
}

// Dummy puzzle list for linking (replace with real data from backend)
const dummyPuzzles = [
  { id: 'pz1', title: 'Sudoku Challenge' },
  { id: 'pz2', title: 'Riddle of the Sphinx' },
  { id: 'pz3', title: 'Logic Grid' },
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
  const [playtestSceneState, setPlaytestSceneState] = useState<{
    hiddenItemIds: string[];
    shownItemIds: string[];
    disabledHotspotIds: string[]; // stores designer zone ids in playtest
    enabledHotspotIds: string[]; // stores designer zone ids in playtest
  }>({ hiddenItemIds: [], shownItemIds: [], disabledHotspotIds: [], enabledHotspotIds: [] });
  const [playtestModal, setPlaytestModal] = useState<null | {
    title: string;
    content: string;
    imageUrl?: string | null;
    choices?: Array<{ label: string; modalContent: string }>;
  }>(null);
  const [previewImageError, setPreviewImageError] = useState<string | null>(null);
  const [previewProxying, setPreviewProxying] = useState(false);
  // Track upload status and errors for each item by scene/item index
  const [itemUploadState, setItemUploadState] = useState<Record<string, { uploading: boolean; error: string }>>({});
  // Track upload status and errors for each zone (for modal image overrides)
  const [zoneUploadState, setZoneUploadState] = useState<Record<string, { uploading: boolean; error: string }>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const previewRef = useRef<HTMLDivElement | null>(null);
  const createFileInputRef = useCallback((idx: number, itemIdx: number) => (el: HTMLInputElement | null) => {
    const key = `${idx}-${itemIdx}`;
    fileInputRefs.current[key] = el;
  }, []);

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
      (window as any).onEscapeRoomDesignerChange({ title, description, timeLimit, startMode, scenes: serializableScenes, userSpecialties });
    }
    if (typeof onChange === 'function') {
      onChange({ title, description, timeLimit, startMode, scenes: serializableScenes, userSpecialties });
    }
  };

  useEffect(() => {
    if (initialData) {
      if (initialData.title !== undefined && initialData.title !== title) setTitle(initialData.title || "");
      if (initialData.description !== undefined && initialData.description !== description) setDescription(initialData.description || "");
      if (initialData.timeLimit !== undefined && initialData.timeLimit !== timeLimit) setTimeLimit(initialData.timeLimit || 1200);
      if (initialData.startMode !== undefined && initialData.startMode !== startMode) setStartMode(initialData.startMode || 'leader-start');
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
    setPlaytestSceneState({ hiddenItemIds: [], shownItemIds: [], disabledHotspotIds: [], enabledHotspotIds: [] });
    setPlaytestMessage('');
    setPlaytestCompleted(false);
    setPlaytestModal(null);
  }, [previewMode, previewSceneIdx, scenes.length]);

  // Call notifyParent whenever title changes
  useEffect(() => {
    notifyParent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, timeLimit, startMode, scenes, userSpecialties]);

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
            <div className="mb-2 text-xs text-gray-300">
              Playtest: click Collect zones to pick up items. Select an inventory item, then click a zone to use it.
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

                const applyUseEffect = (useEffect: any) => {
                  const hideItemIds: string[] = Array.isArray(useEffect?.hideItemIds) ? useEffect.hideItemIds.filter((x: any) => typeof x === 'string') : [];
                  const showItemIds: string[] = Array.isArray(useEffect?.showItemIds) ? useEffect.showItemIds.filter((x: any) => typeof x === 'string') : [];
                  const disableHotspotIds: string[] = Array.isArray(useEffect?.disableHotspotIds) ? useEffect.disableHotspotIds.filter((x: any) => typeof x === 'string') : [];
                  const enableHotspotIds: string[] = Array.isArray(useEffect?.enableHotspotIds) ? useEffect.enableHotspotIds.filter((x: any) => typeof x === 'string') : [];

                  setPlaytestSceneState(prev => {
                    const nextHidden = new Set<string>(Array.isArray(prev.hiddenItemIds) ? prev.hiddenItemIds : []);
                    const nextShown = new Set<string>(Array.isArray(prev.shownItemIds) ? prev.shownItemIds : []);
                    const nextDisabled = new Set<string>(Array.isArray(prev.disabledHotspotIds) ? prev.disabledHotspotIds : []);
                    const nextEnabled = new Set<string>(Array.isArray(prev.enabledHotspotIds) ? prev.enabledHotspotIds : []);

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

                    return {
                      hiddenItemIds: Array.from(nextHidden),
                      shownItemIds: Array.from(nextShown),
                      disabledHotspotIds: Array.from(nextDisabled),
                      enabledHotspotIds: Array.from(nextEnabled),
                    };
                  });
                };

                const handleZoneClick = (z: any) => {
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
                    setPlaytestInventoryItemIds(prev => (prev.includes(collectItemId) ? prev : [...prev, collectItemId]));
                    const item = findItemById(collectItemId);
                    setPlaytestMessage(`Picked up ${(item?.name || collectItemId)}.`);
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
                };

                return (
                  <>
                    {/* Visible items */}
                    {scene.items.filter(isItemVisible).map((item: any, i: number) => (
                      <div
                        key={item.id}
                        style={{
                          position: 'absolute',
                          left: item.x ?? (20 + i * 60),
                          top: item.y ?? 20,
                          zIndex: 2,
                          borderRadius: 4,
                          padding: 2,
                          minWidth: 40,
                          textAlign: 'center',
                          userSelect: 'none',
                          touchAction: 'none'
                        }}
                      >
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            style={{ width: (item.w ?? 48), height: (item.h ?? 48), objectFit: 'contain', display: 'block', borderRadius: 4 }}
                            draggable={false}
                          />
                        ) : (
                          <div style={{ width: 48, height: 48, background: 'rgba(255,255,255,0.15)', borderRadius: 4 }} />
                        )}
                      </div>
                    ))}

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
                          <div style={{ fontWeight: 700 }}>{playtestModal.title}</div>
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
                                onClick={() => setPlaytestModal(prev => prev ? ({ ...prev, content: c.modalContent }) : prev)}
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

            {/* Inventory */}
            <div className="border rounded-lg p-2 bg-slate-900/40">
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
              <li key={scene.id} className="border p-4 rounded">
                <div className="flex justify-between items-center mb-2">
                  <input value={scene.name} onChange={e => {
                    const updated = [...scenes];
                    updated[idx].name = e.target.value;
                    setScenes(updated);
                  }} placeholder="Scene Name" className="border rounded px-2 py-1 mr-2" />
                  <button className="text-red-600" type="button" onClick={() => setScenes(scenes.filter((_, i) => i !== idx))}>Remove</button>
                </div>
                <div className="mb-2">
                  {/* Puzzle linking for scene */}
                  <label className="block text-xs font-semibold">Linked Puzzle (optional)</label>
                  <select value={scene.linkedPuzzleId || ''} onChange={e => {
                    const updated = [...scenes];
                    updated[idx].linkedPuzzleId = e.target.value || undefined;
                    setScenes(updated);
                  }} className="border rounded px-2 py-1 text-xs mb-2">
                    <option value="">None</option>
                    {dummyPuzzles.map(pz => <option key={pz.id} value={pz.id}>{pz.title}</option>)}
                  </select>
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
                        <li key={item.id} className="border p-2 rounded">
                          <div className="flex gap-2 items-center mb-1">
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
                          <div className="mt-1 flex gap-2 items-center">
                            <div className="text-xs text-gray-300">
                              <div>Size: {Math.round(item.w ?? 48)}×{Math.round(item.h ?? 48)}</div>
                              <div className="text-[11px] text-gray-400">Resize on the preview canvas (corner handles). Hold Shift to lock aspect ratio.</div>
                            </div>
                            <div style={{ marginLeft: 12 }}>
                              <label className="block text-xs">Linked Puzzle (optional)</label>
                              <select value={item.linkedPuzzleId || ''} onChange={e => {
                                const updated = [...scenes];
                                updated[idx].items[itemIdx].linkedPuzzleId = e.target.value || undefined;
                                setScenes(updated);
                              }} className="border rounded px-2 py-1 text-xs">
                                <option value="">None</option>
                                {dummyPuzzles.map(pz => <option key={pz.id} value={pz.id}>{pz.title}</option>)}
                              </select>
                            </div>
                          </div>
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
                        <li key={zone.id} className="border p-2 rounded">
                          <div className="flex gap-2 items-center mb-1">
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
                              <option value="trigger">Trigger Event</option>
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
                                Use effects: swap images by hiding/showing items, and reveal loot by enabling a disabled Collect zone.
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
                              </div>
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
                                      <div key={itxIdx} className="border rounded p-2">
                                        <div className="flex items-center gap-2 mb-1">
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
                                            className="border rounded px-2 py-1 text-xs"
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
                                          placeholder="Interaction Content"
                                          className="border rounded px-2 py-1 w-full text-xs"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                          {zone.actionType === 'collect' && (
                            <div className="mb-1">
                              <label className="block text-xs">Collects Item</label>
                              <select value={zone.collectItemId || ''} onChange={e => {
                                const updated = [...scenes];
                                updated[idx].interactiveZones[zoneIdx].collectItemId = e.target.value || undefined;
                                setScenes(updated);
                              }} className="border rounded px-2 py-1 text-xs">
                                <option value="">None</option>
                                {scene.items.map(it => <option key={it.id} value={it.id}>{it.name || 'Unnamed Item'}</option>)}
                              </select>
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
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {/* Live preview placeholder */}
                <div className="mb-2 text-xs text-blue-700">Live preview coming soon...</div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">User Specialties</h2>
        <div className="mb-2">
          <button className="bg-blue-600 text-white px-4 py-2 rounded" type="button" onClick={() => setUserSpecialties([...userSpecialties, { id: Date.now().toString(), name: '', description: '' }])}>+ Add Specialty</button>
        </div>
        {userSpecialties.length === 0 ? <div className="text-gray-500">No specialties added yet.</div> : (
          <ul className="space-y-4">
            {userSpecialties.map((spec, idx) => (
              <li key={spec.id} className="border p-4 rounded">
                <div className="flex justify-between items-center mb-2">
                  <input value={spec.name} onChange={e => {
                    const updated = [...userSpecialties];
                    updated[idx].name = e.target.value;
                    setUserSpecialties(updated);
                  }} placeholder="Specialty Name" className="border rounded px-2 py-1 mr-2" />
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
        {/* Save button for in-progress escape room design, now after specialties */}
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
      {/* Save/Preview section removed to prevent duplicate submit UI in main form */}
    </div>
  );
}
