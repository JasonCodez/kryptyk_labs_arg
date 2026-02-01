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
  modalContent?: string;
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
  const [previewImageError, setPreviewImageError] = useState<string | null>(null);
  const [previewProxying, setPreviewProxying] = useState(false);
  // Track upload status and errors for each item by scene/item index
  const [itemUploadState, setItemUploadState] = useState<Record<string, { uploading: boolean; error: string }>>({});
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
          </div>
        )}
        {/* Live preview */}
        {scenes.length > 0 && (
          <div
            ref={previewRef}
            className="mb-6 border rounded-lg overflow-hidden"
            style={{ background: '#222', minHeight: 320, position: 'relative', width: 600, maxWidth: '100%' }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => e.preventDefault()}
            onClick={() => setSelectedItem(null)}
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
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', `${previewSceneIdx}-${i}`);
                }}
                onDragEnd={(e) => {
                  const rect = previewRef.current?.getBoundingClientRect();
                  if (rect) {
                    const newX = e.clientX - rect.left;
                    const newY = e.clientY - rect.top;
                    const updated = [...scenes];
                    const iw = (updated[previewSceneIdx].items[i].w as number) || 48;
                    const ih = (updated[previewSceneIdx].items[i].h as number) || 48;
                    updated[previewSceneIdx].items[i].x = Math.max(0, Math.min(newX, rect.width - iw));
                    updated[previewSceneIdx].items[i].y = Math.max(0, Math.min(newY, rect.height - ih));
                    setScenes(updated);
                  }
                }}
                onClick={(ev) => { ev.stopPropagation(); setSelectedItem({ sceneIdx: previewSceneIdx, itemIdx: i }); }}
                style={{
                  position: 'absolute',
                  left: item.x || 20 + i * 60,
                  top: item.y || 20,
                  zIndex: 2,
                  borderRadius: 4,
                  padding: 2,
                  minWidth: 40,
                  textAlign: 'center',
                  cursor: 'move',
                  userSelect: 'none'
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
                  setSelectedZone({ sceneIdx: previewSceneIdx, zoneIdx: i });
                  setSelectedItem(null);
                  const parentElem = (ev.currentTarget as HTMLElement).parentElement;
                  const parentRect = parentElem?.getBoundingClientRect();
                  if (!parentRect) return;
                  const startX = ev.clientX;
                  const startY = ev.clientY;
                  const origX = zone.x;
                  const origY = zone.y;
                  const onPointerMove = (pm: PointerEvent) => {
                    const dx = pm.clientX - startX;
                    const dy = pm.clientY - startY;
                    const newX = Math.max(0, Math.min(origX + dx, parentRect.width - zone.width));
                    const newY = Math.max(0, Math.min(origY + dy, parentRect.height - zone.height));
                    setScenes(prev => {
                      const copy = [...prev];
                      copy[previewSceneIdx].interactiveZones[i] = { ...copy[previewSceneIdx].interactiveZones[i], x: Math.round(newX), y: Math.round(newY) };
                      return copy;
                    });
                  };
                  const onPointerUp = () => {
                    window.removeEventListener('pointermove', onPointerMove);
                    window.removeEventListener('pointerup', onPointerUp);
                  };
                  window.addEventListener('pointermove', onPointerMove);
                  window.addEventListener('pointerup', onPointerUp);
                }}
                style={{ position: 'absolute', left: zone.x, top: zone.y, width: zone.width, height: zone.height, border: '2px dashed #38bdf8', background: 'rgba(56,189,248,0.1)', zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto', touchAction: 'none' }}
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
                          const parentElemForHandle = (ev.currentTarget as HTMLElement).parentElement;
                          const parentRectForHandle = parentElemForHandle?.getBoundingClientRect();
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
                          <div className="mt-1 flex gap-2 items-center">
                            <div>
                              <label className="block text-xs">Width</label>
                              <input type="number" value={Number(item.w ?? 48)} onChange={e => {
                                const updated = [...scenes];
                                updated[idx].items[itemIdx].w = Math.max(8, Number(e.target.value) || 8);
                                setScenes(updated);
                              }} className="border rounded px-2 py-1 w-24 text-xs" />
                            </div>
                            <div>
                              <label className="block text-xs">Height</label>
                              <input type="number" value={Number(item.h ?? 48)} onChange={e => {
                                const updated = [...scenes];
                                updated[idx].items[itemIdx].h = Math.max(8, Number(e.target.value) || 8);
                                setScenes(updated);
                              }} className="border rounded px-2 py-1 w-24 text-xs" />
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
                          {zone.actionType === 'modal' && (
                            <textarea value={zone.modalContent} onChange={e => {
                              const updated = [...scenes];
                              updated[idx].interactiveZones[zoneIdx].modalContent = e.target.value;
                              setScenes(updated);
                            }} placeholder="Modal Content (Markdown or HTML)" className="border rounded px-2 py-1 w-full text-xs" />
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
              // Optionally show a message
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
