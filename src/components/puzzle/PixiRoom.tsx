"use client";

import React, { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";

type Hotspot = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  type: string;
  meta?: string | null;
};

export default function PixiRoom({
  puzzleId,
  layout,
  hotspots,
  onHotspotAction,
  onHotspotMove,
  onHotspotTransform,
}: {
  puzzleId: string;
  layout: { id: string; title?: string | null; backgroundUrl?: string | null; width?: number | null; height?: number | null } | null;
  hotspots: Hotspot[];
  onHotspotAction: (hotspotId: string) => Promise<void> | void;
  onHotspotMove?: (hotspotId: string, x: number, y: number) => void;
  onHotspotTransform?: (hotspotId: string, x: number, y: number, w: number, h: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const createdCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const createdOverlayRef = useRef<HTMLCanvasElement | null>(null);
  // local handle for canvas created inside effect (so closures can reference it)
  let createdCanvasLocal: HTMLCanvasElement | null = null;

  useEffect(() => {
    try {
      // Diagnostic: confirm effect runs and show initial state
      try { console.info('[PixiRoom] useEffect start', { puzzleId, hasContainer: !!containerRef.current, hasLayout: !!layout, layout }); } catch (_) { /* ignore */ }
      if (!containerRef.current || !layout) {
        try { console.info('[PixiRoom] useEffect early exit - missing container or layout', { hasContainer: !!containerRef.current, hasLayout: !!layout }); } catch (_) { /* ignore */ }
        return;
      }

      let app: PIXI.Application | null = null;
      // pure-canvas fallback state (declare early so we can enable fallback immediately)
      let usePureCanvas: boolean = false;
      let pureCtx: CanvasRenderingContext2D | null = null;
      let pureCanvasEl: HTMLCanvasElement | null = null;
      let bgImageEl: HTMLImageElement | null = null;
      // cache loaded HTMLImageElements to ensure ordered drawing on canvas fallback
      const imageCache = new Map<string, HTMLImageElement>();
      // pointer handler for overlay (kept so we can remove on cleanup)
      let overlayPointerHandler: ((ev: PointerEvent) => void) | null = null;
      try {
        // create a canvas element and pass it explicitly to PIXI.Application to avoid
        // using the deprecated `view` getter which accesses internal `canvas`.
        // If a canvas already exists in the container (e.g. created by Designer), reuse it.
        const existingCanvas = containerRef.current?.querySelector('canvas') as HTMLCanvasElement | null;
        const canvas = existingCanvas || document.createElement('canvas');
        createdCanvasLocal = canvas;
        // make canvas visible and fill container
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.display = 'block';
        canvas.style.outline = '1px dashed rgba(0,0,0,0.03)';
        if (!existingCanvas && containerRef.current) {
          try { containerRef.current.appendChild(canvas); createdCanvasRef.current = canvas; } catch (err) { console.error('[PixiRoom] append canvas failed', err); }
        }
        // ensure container has positioned context
        try { if (containerRef.current) containerRef.current.style.position = containerRef.current.style.position || 'relative'; } catch (_) { /* ignore */ }
        const width = containerRef.current?.clientWidth || 800;
        const height = containerRef.current?.clientHeight || 600;
        const dpr = window.devicePixelRatio || 1;
        // ensure canvas backing buffer matches container size (important when reusing an existing canvas)
        try {
          canvas.width = Math.max(1, Math.floor(width * dpr));
          canvas.height = Math.max(1, Math.floor(height * dpr));
        } catch (err) { /* ignore */ }
        // Prefer the modern Application.init() if provided by the installed PIXI build,
        // otherwise fall back to the constructor for compatibility with older builds.
        const appOptions = {
          view: canvas,
          backgroundAlpha: 0,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
          width,
          height,
        } as any;
        // detect WebGL availability on this canvas; if not available, force Canvas renderer
        let supportsWebGL = false;
        try {
          supportsWebGL = !!(canvas.getContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
        } catch (_) { supportsWebGL = false; }
        if (!supportsWebGL) {
          appOptions.forceCanvas = true;
          console.info('[PixiRoom] WebGL not detected — forcing Canvas renderer fallback');
        } else {
          console.info('[PixiRoom] WebGL detected — using GPU renderer when available');
        }

        try {
          // Pre-create diagnostics
          try { console.info('[PixiRoom] PIXI.version/info', { VERSION: (PIXI as any).VERSION || (PIXI as any).version || null, AppType: typeof PIXI.Application }); } catch (_) { /* ignore */ }
          try { console.info('[PixiRoom] appOptions before create', { width, height, resolution: appOptions.resolution, forceCanvas: appOptions.forceCanvas || false }); } catch (_) { /* ignore */ }
          try { console.info('[PixiRoom] canvas present in DOM?', !!(canvas && canvas.parentNode), 'canvas size:', { cw: canvas.width, ch: canvas.height, cssW: canvas.style?.width, cssH: canvas.style?.height }); } catch (_) { /* ignore */ }
          const AppCtorAny = PIXI.Application as any;
          try { console.info('[PixiRoom] AppCtorAny.init available?', !!(AppCtorAny && typeof AppCtorAny.init === 'function')); } catch (_) { /* ignore */ }
          if (AppCtorAny && typeof AppCtorAny.init === 'function') {
            try {
              app = AppCtorAny.init(appOptions) as PIXI.Application;
              console.info('[PixiRoom] Application.init() returned app?', !!app);
            } catch (initErr) {
              console.info('[PixiRoom] Application.init() threw, will fall back to constructor', initErr);
              // eslint-disable-next-line new-cap
              app = new PIXI.Application(appOptions);
              console.info('[PixiRoom] Fallback constructor created app after init error?', !!app);
            }
          } else {
            // older pixi builds: use constructor
            // eslint-disable-next-line new-cap
            app = new PIXI.Application(appOptions);
            console.info('[PixiRoom] Constructor path used to create app', !!app);
          }
        } catch (err) {
          // last-resort: attempt constructor
          try {
            // eslint-disable-next-line new-cap
            app = new PIXI.Application(appOptions);
            console.info('[PixiRoom] Constructor recovery created app?', !!app);
          } catch (e) {
            console.error('[PixiRoom] Failed to create PIXI.Application by any method', e);
            throw err;
          }
        }
        // ensure renderer matches container immediately
        try {
          app.renderer.resize(width, height);
          // make sure the canvas element backing store matches DPR-scaled pixels
          try {
            const view = app.renderer.view as unknown as HTMLCanvasElement;
            view.width = Math.max(1, Math.floor(width * dpr));
            view.height = Math.max(1, Math.floor(height * dpr));
            view.style.width = width + 'px';
            view.style.height = height + 'px';
          } catch (_) { /* ignore */ }
        } catch (err) { /* ignore */ }
        appRef.current = app;
        // If the created PIXI Application lacks a renderer (some builds strip renderers),
        // enable the pure-canvas fallback immediately so the user sees a visible output.
        try {
          if (!app || !(app as any).renderer) {
            usePureCanvas = true;
            pureCanvasEl = createdCanvasRef.current || createdCanvasLocal;
            try { pureCtx = pureCanvasEl && (pureCanvasEl.getContext && pureCanvasEl.getContext('2d')) ? pureCanvasEl.getContext('2d') : null; } catch (_) { pureCtx = null; }
            // If the existing canvas doesn't support 2D context (likely a WebGL-only canvas),
            // create an overlay 2D canvas so we can draw the fallback visuals.
                if (!pureCtx && containerRef.current) {
              try {
                const overlay = document.createElement('canvas');
                overlay.style.position = 'absolute';
                overlay.style.left = '0';
                overlay.style.top = '0';
                overlay.style.width = '100%';
                overlay.style.height = '100%';
                    // allow pointer events on the overlay so we can handle hotspot clicks in pure-canvas mode
                    overlay.style.pointerEvents = 'auto';
                    // ensure overlay is on top of any PIXI canvas/view
                    overlay.style.zIndex = '2147483647';
                createdOverlayRef.current = overlay;
                try { containerRef.current.appendChild(overlay); } catch (_) { /* ignore */ }
                try {
                  // set backing store size to DPR-scaled pixels so the overlay is crisp
                  overlay.width = Math.max(1, Math.floor(width * dpr));
                  overlay.height = Math.max(1, Math.floor(height * dpr));
                  overlay.style.width = width + 'px';
                  overlay.style.height = height + 'px';
                } catch (_) { /* ignore */ }
                try { pureCtx = overlay.getContext && overlay.getContext('2d') ? overlay.getContext('2d') : null; } catch (_) { pureCtx = null; }
                if (pureCtx) {
                  pureCanvasEl = overlay;
                  // attach pointer handler to map clicks to hotspots when using pure-canvas fallback
                  overlayPointerHandler = (ev: PointerEvent) => {
                    try {
                      const rect = overlay.getBoundingClientRect();
                      const dprLocal = window.devicePixelRatio || 1;
                      // convert client coords to backing-store (canvas) pixels
                      const bx = (ev.clientX - rect.left) * dprLocal;
                      const by = (ev.clientY - rect.top) * dprLocal;
                      const canvasW = overlay.width || Math.max(1, Math.floor(rect.width * dprLocal));
                      const canvasH = overlay.height || Math.max(1, Math.floor(rect.height * dprLocal));
                      const layoutW = layout.width || 800;
                      const layoutH = layout.height || 600;
                      const scale = Math.max(canvasW / layoutW, canvasH / layoutH);
                      const offsetX = (canvasW - layoutW * scale) / 2;
                      const offsetY = (canvasH - layoutH * scale) / 2;
                      const lx = (bx - offsetX) / scale;
                      const ly = (by - offsetY) / scale;
                      for (const hs of hotspots || []) {
                        if (lx >= hs.x && lx <= hs.x + hs.w && ly >= hs.y && ly <= hs.y + hs.h) {
                          try { if (typeof onHotspotAction === 'function') onHotspotAction(hs.id); } catch (e) { console.error('Hotspot action error', e); }
                          ev.stopPropagation();
                          ev.preventDefault();
                          return;
                        }
                      }
                    } catch (e) { /* ignore overlay click errors */ }
                  };
                  try { overlay.addEventListener('pointerdown', overlayPointerHandler); } catch (_) { /* ignore */ }
                }
              } catch (_) { /* ignore */ }
            }
            if (layout && layout.backgroundUrl) {
              try {
                bgImageEl = new Image();
                bgImageEl.crossOrigin = 'anonymous';
                bgImageEl.src = layout.backgroundUrl;
                bgImageEl.onload = () => { try { /* trigger a draw once loaded */ draw(); } catch (_) { /* ignore */ } };
              } catch (_) { bgImageEl = null; }
            }
            console.info('[PixiRoom] enabled pure Canvas2D fallback immediately after app creation', { hasCtx: !!pureCtx });
          }
        } catch (_) { /* ignore */ }
        // If renderer missing, attempt a recovery by creating a PIXI.Application without `view` so
        // the runtime can construct its own renderer. Then attach that renderer.view to the DOM.
        try {
          if (!app || !(app as any).renderer) {
            try { console.info('[PixiRoom] app or app.renderer missing after creation — attempting app-without-view fallback', app); } catch (_) { /* ignore */ }
            try {
              // Create options without `view` to let PIXI decide renderer implementation
              const fallbackOptions = { ...appOptions } as any;
              delete fallbackOptions.view;
              // ensure we still pass resolution/autoDensity/width/height/forceCanvas
              try { console.info('[PixiRoom] attempting new PIXI.Application without view', { resolution: fallbackOptions.resolution, forceCanvas: fallbackOptions.forceCanvas || false }); } catch (_) { /* ignore */ }
              // eslint-disable-next-line new-cap
              const altApp = new (PIXI as any).Application(fallbackOptions) as any;
              if (altApp && altApp.renderer) {
                try {
                  const viewEl = altApp.renderer.view as HTMLCanvasElement | undefined;
                  if (viewEl) {
                    if (createdCanvasRef.current && createdCanvasRef.current.parentNode) {
                      try { createdCanvasRef.current.parentNode.replaceChild(viewEl, createdCanvasRef.current); } catch (_) { /* ignore */ }
                    } else if (createdCanvasLocal && createdCanvasLocal.parentNode) {
                      try { createdCanvasLocal.parentNode.replaceChild(viewEl, createdCanvasLocal); } catch (_) { /* ignore */ }
                    } else if (containerRef.current) {
                      try { containerRef.current.appendChild(viewEl); } catch (_) { /* ignore */ }
                    }
                    createdCanvasRef.current = viewEl;
                    // ensure any overlay canvas remains on top after PIXI replaces/attaches its view
                    try {
                      const ov = createdOverlayRef.current;
                      if (ov && containerRef.current) {
                        try { containerRef.current.appendChild(ov); } catch (_) { /* ignore */ }
                      }
                    } catch (_) { /* ignore */ }
                  }
                } catch (_) { /* ignore */ }
                app = altApp as any;
                console.info('[PixiRoom] recovered app via constructor-without-view', !!app, !!(app as any).renderer);
              } else {
                console.info('[PixiRoom] altApp created but no renderer present', altApp);
              }
            } catch (manErr) {
              console.error('[PixiRoom] fallback app-without-view creation failed', manErr);
            }
          }
        } catch (_) { /* ignore */ }
        try {
          // immediate diagnostics: report renderer and view presence and sizes
          if (app && (app as any).renderer) {
            const rendererExists = true;
            const rendererName = (app.renderer as any)?.constructor?.name || 'unknown';
            const viewEl = (app.renderer as any)?.view as HTMLCanvasElement | undefined;
            const viewInfo = viewEl ? { width: viewEl.width, height: viewEl.height, cssWidth: viewEl.style?.width, cssHeight: viewEl.style?.height, has2d: !!(viewEl.getContext && viewEl.getContext('2d')) } : null;
            console.info('[PixiRoom] created renderer:', rendererName, 'rendererExists:', rendererExists, 'resolution:', app.renderer?.resolution, 'viewInfo:', viewInfo);
          } else {
            console.info('[PixiRoom] created renderer: none');
          }
        } catch (diagErr) {
          console.info('[PixiRoom] created renderer diagnostics failed', diagErr);
        }
        // enforce renderer resolution and backing store size
        try {
          const dprEnforce = window.devicePixelRatio || 1;
          if (app && (app as any).renderer) {
            try { app.renderer.resolution = dprEnforce; } catch (_) { /* ignore */ }
            try { app.renderer.resize(width, height); } catch (_) { /* ignore */ }
            try {
              const view = app.renderer.view as unknown as HTMLCanvasElement;
              view.width = Math.max(1, Math.floor(width * dprEnforce));
              view.height = Math.max(1, Math.floor(height * dprEnforce));
              view.style.width = width + 'px';
              view.style.height = height + 'px';
              /* enforced canvas size */
            } catch (_) { /* ignore */ }
          }
        } catch (err) { /* ignore */ }
      } catch (err) {
        console.error('[PixiRoom] PIXI.Application init failed', err);
        return;
      }

    let bgSprite: PIXI.Sprite | null = null;

      const draw = () => {
        if (usePureCanvas) {
            try {
            const canvasEl = pureCanvasEl || createdCanvasRef.current || createdCanvasLocal;
            if (!canvasEl) return;
            const ctx = pureCtx || (canvasEl.getContext && canvasEl.getContext('2d'));
            if (!ctx) return;
            const cssW = canvasEl.clientWidth || (canvasEl.style && parseInt(canvasEl.style.width || '0')) || 800;
            const cssH = canvasEl.clientHeight || (canvasEl.style && parseInt(canvasEl.style.height || '0')) || 600;
            // clear
            ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
            // fill fallback background
            ctx.fillStyle = '#f3f4f6';
            ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
            // draw background image if available
            if (bgImageEl && bgImageEl.complete && bgImageEl.naturalWidth) {
              // compute scale to fit
              const layoutW = layout.width || bgImageEl.naturalWidth || 800;
              const layoutH = layout.height || bgImageEl.naturalHeight || 600;
              // use 'cover' scaling so the background fills the canvas (may crop)
              const sx = canvasEl.width / layoutW;
              const sy = canvasEl.height / layoutH;
              const scale = Math.max(sx, sy);
              const drawW = Math.round(layoutW * scale);
              const drawH = Math.round(layoutH * scale);
              const dx = Math.floor((canvasEl.width - drawW) / 2);
              const dy = Math.floor((canvasEl.height - drawH) / 2);
              try { ctx.drawImage(bgImageEl, 0, 0, bgImageEl.naturalWidth, bgImageEl.naturalHeight, dx, dy, drawW, drawH); } catch (_) { /* ignore */ }
            }
            // draw items (uploaded images) on top of background — only draw after image loads
            try {
              const items = (layout as any).items || [];
              console.info('[PixiRoom] canvas items count', Array.isArray(items) ? items.length : 0);
              if (Array.isArray(items) && items.length > 0) {
                // sort by preview bottom (y + h) so items with lower bottom edge render on top (visual depth)
                const itemsSorted = items.slice().sort((a: any, b: any) => ((a.y || 0) + (a.h || 0)) - ((b.y || 0) + (b.h || 0)));
                for (const it of itemsSorted) {
                  try {
                    const src = it?.imageUrl || '';
                    if (!src) continue;
                    // reuse or create cached HTMLImageElement so we can draw items in order
                    let img = imageCache.get(src);
                    if (!img) {
                      img = new Image();
                      img.crossOrigin = 'anonymous';
                      img.src = src;
                      // when any image finishes loading, request a full redraw so draw() will render all items in order
                      img.onload = () => { try { draw(); } catch (_) { /* ignore */ } };
                      img.onerror = () => { console.info('[PixiRoom] item image load failed', src); };
                      imageCache.set(src, img);
                    }
                    const itemLayoutW = layout.width || 800;
                    const itemLayoutH = layout.height || (bgImageEl && bgImageEl.naturalHeight) || 600;
                    const PREVIEW_W = 600;
                    const PREVIEW_H = 320;
                    const scalePreview = Math.max(PREVIEW_W / itemLayoutW, PREVIEW_H / itemLayoutH);
                    const offsetPreviewX = (PREVIEW_W - itemLayoutW * scalePreview) / 2;
                    const offsetPreviewY = (PREVIEW_H - itemLayoutH * scalePreview) / 2;
                    const scaleTarget = Math.max((canvasEl.width) / itemLayoutW, (canvasEl.height) / itemLayoutH);
                    const offsetTargetX = Math.floor((canvasEl.width - itemLayoutW * scaleTarget) / 2);
                    const offsetTargetY = Math.floor((canvasEl.height - itemLayoutH * scaleTarget) / 2);
                    const iw = (typeof it.w === 'number' && it.w > 0) ? it.w : 32;
                    const ih = (typeof it.h === 'number' && it.h > 0) ? it.h : 32;
                    const itemXInLayout = ((it.x || 0) - offsetPreviewX) / (scalePreview || 1);
                    const itemYInLayout = ((it.y || 0) - offsetPreviewY) / (scalePreview || 1);
                    const ix = Math.floor(offsetTargetX + itemXInLayout * scaleTarget);
                    const iy = Math.floor(offsetTargetY + itemYInLayout * scaleTarget);
                    const iW = Math.max(1, Math.floor(iw * scaleTarget));
                    const iH = Math.max(1, Math.floor(ih * scaleTarget));
                    if (img.complete && img.naturalWidth) {
                      try { ctx.drawImage(img, 0, 0, img.naturalWidth || iW, img.naturalHeight || iH, ix, iy, iW, iH); } catch (_) { /* ignore */ }
                    }
                  } catch (_) { /* ignore per-item */ }
                }
              }
            } catch (_) { /* ignore */ }
            // draw hotspots
            try {
              for (const hs of hotspots || []) {
                const layoutW = layout.width || 800;
                const layoutH = layout.height || 600;
                // mirror PIXI cover logic: compute scale to cover target area
                const sx = (canvasEl.width) / layoutW;
                const sy = (canvasEl.height) / layoutH;
                const scale = Math.max(sx, sy);
                const x = Math.floor((canvasEl.width - layoutW * scale) / 2 + hs.x * scale);
                const y = Math.floor((canvasEl.height - layoutH * scale) / 2 + hs.y * scale);
                const w = Math.max(1, Math.floor(hs.w * scale));
                const h = Math.max(1, Math.floor(hs.h * scale));
                // hide hotspot outlines in player view (Designer shows them).
                // If you want visual debug outlines, restore the strokeRect call here.
              }
            } catch (_) { /* ignore */ }
          } catch (err) {
            console.error('[PixiRoom] pure-canvas draw failed', err);
          }
          return;
        }

      // defensive: ensure app still exists
      if (!appRef.current) return;
      const appInst = appRef.current;
      const renderer = (appInst as any).renderer;
      if (!renderer || !renderer.view) return;
      appInst.stage.removeChildren();

      // background
      if (layout.backgroundUrl) {
        const tex = PIXI.Texture.from(layout.backgroundUrl);
        bgSprite = new PIXI.Sprite(tex);
        // Decide which logical layout size to use: prefer persisted layout, else try image intrinsic size, else fallback
        let layoutW = layout.width || 0;
        let layoutH = layout.height || 0;
        const targetW = renderer.width || (renderer.view && renderer.view.width) || 0;
        const targetH = renderer.height || (renderer.view && renderer.view.height) || 0;

        const applySizing = () => {
          // If persisted layout size missing, try to read texture intrinsic size
          if (!layoutW || !layoutH) {
            try {
              const base = (bgSprite!.texture as any).baseTexture;
              const orig = (bgSprite!.texture as any).orig;
              const intrinsicW = (orig && orig.width) || (base && base.realWidth) || (base && base.width) || 0;
              const intrinsicH = (orig && orig.height) || (base && base.realHeight) || (base && base.height) || 0;
              if (intrinsicW && intrinsicH) {
                layoutW = intrinsicW;
                layoutH = intrinsicH;
              }
              // If PIXI failed to create a renderer, enable pure-canvas fallback
              if (!app || !(app as any).renderer) {
                  usePureCanvas = true;
                  pureCanvasEl = createdCanvasRef.current || createdCanvasLocal;
                  try { pureCtx = pureCanvasEl && (pureCanvasEl.getContext && pureCanvasEl.getContext('2d')) ? pureCanvasEl.getContext('2d') : null; } catch (_) { pureCtx = null; }
                  // preload background image for canvas fallback
                  if (layout.backgroundUrl) {
                    try {
                      bgImageEl = new Image();
                      bgImageEl.crossOrigin = 'anonymous';
                      bgImageEl.src = layout.backgroundUrl;
                      bgImageEl.onload = () => { try { draw(); } catch (_) { /* ignore */ } };
                    } catch (_) { bgImageEl = null; }
                  }
                  console.info('[PixiRoom] using pure Canvas2D fallback', { hasCtx: !!pureCtx });
              }
            } catch (_) { /* ignore */ }
          }
          if (!layoutW) layoutW = 800;
          if (!layoutH) layoutH = 600;

          // use 'cover' scaling so the PIXI background sprite fills the renderer area
          const sx = targetW / layoutW;
          const sy = targetH / layoutH;
          const scale = Math.max(sx, sy);
          bgSprite!.width = layoutW * scale;
          bgSprite!.height = layoutH * scale;
          bgSprite!.x = (targetW - bgSprite!.width) / 2;
          bgSprite!.y = (targetH - bgSprite!.height) / 2;
        };

        applySizing();
        appInst.stage.addChild(bgSprite);

        // Render any scene items (e.g., uploaded images) as PIXI sprites
        try {
          const items = (layout as any).items || [];
          if (Array.isArray(items) && items.length > 0) {
            // allow zIndex sorting so we can preserve Designer stacking order
            try { appInst.stage.sortableChildren = true; } catch (_) { /* ignore */ }
            // sort by preview bottom (y + h) so items with lower bottom edge render on top (visual depth)
            const itemsSorted = items.slice().sort((a: any, b: any) => ((a.y || 0) + (a.h || 0)) - ((b.y || 0) + (b.h || 0)));
            for (let sortedIdx = 0; sortedIdx < itemsSorted.length; sortedIdx++) {
              const it = itemsSorted[sortedIdx];
              try {
                const texIt = PIXI.Texture.from(it.imageUrl || it.imageUrl || '');
                const sprIt = new PIXI.Sprite(texIt);
                const itemLayoutW = layoutW || 800;
                const itemLayoutH = layoutH || 600;
                // Designer preview size (CSS) used when placing items in Designer
                const PREVIEW_W = 600;
                const PREVIEW_H = 320;
                // compute cover scales for preview and target using layout intrinsic size
                const scalePreview = Math.max(PREVIEW_W / itemLayoutW, PREVIEW_H / itemLayoutH);
                const offsetPreviewX = (PREVIEW_W - itemLayoutW * scalePreview) / 2;
                const offsetPreviewY = (PREVIEW_H - itemLayoutH * scalePreview) / 2;
                const scaleTarget = Math.max(targetW / itemLayoutW, targetH / itemLayoutH);
                const offsetTargetX = (targetW - itemLayoutW * scaleTarget) / 2;
                const offsetTargetY = (targetH - itemLayoutH * scaleTarget) / 2;
                const iw = (typeof it.w === 'number' && it.w > 0) ? it.w : 32;
                const ih = (typeof it.h === 'number' && it.h > 0) ? it.h : 32;
                // convert designer preview coords -> layout coords -> target coords
                const itemXInLayout = ((it.x || 0) - offsetPreviewX) / (scalePreview || 1);
                const itemYInLayout = ((it.y || 0) - offsetPreviewY) / (scalePreview || 1);
                sprIt.width = iw * scaleTarget;
                sprIt.height = ih * scaleTarget;
                sprIt.x = offsetTargetX + itemXInLayout * scaleTarget;
                sprIt.y = offsetTargetY + itemYInLayout * scaleTarget;
                // use sorted index so lower Y drawn first, higher Y on top
                try { (sprIt as any).zIndex = sortedIdx; } catch (_) { /* ignore */ }
                appInst.stage.addChild(sprIt);
              } catch (_) { /* ignore per-item errors */ }
            }
          }
        } catch (_) { /* ignore */ }

        // log texture status and handle unloaded textures
        try {
          const base = (bgSprite.texture as any).baseTexture;
          if (base && !base.valid) {
            base.on('loaded', () => { try { applySizing(); draw(); } catch (_) { /* ignore */ } });
            base.on('update', () => { try { applySizing(); draw(); } catch (_) { /* ignore */ } });
          }
        } catch (err) { console.error('[PixiRoom] bg texture check failed', err); }
      }
      else {
        // fallback visible background so canvas isn't empty
        const bg = new PIXI.Graphics();
        const layoutW = layout.width || 800;
        const layoutH = layout.height || 600;
        const targetW = renderer.width || (renderer.view && renderer.view.width) || 0;
        const targetH = renderer.height || (renderer.view && renderer.view.height) || 0;
        bg.beginFill(0xf3f4f6, 1);
        bg.drawRect(0, 0, Math.max(1, targetW), Math.max(1, targetH));
        bg.endFill();
        appInst.stage.addChild(bg);
      }

      // hotspots (now container-based for smooth dragging)
      // ensure stage supports zIndex sorting so hotspots with high zIndex sit above items
      try { appInst.stage.sortableChildren = true; } catch (_) { /* ignore */ }
      for (const hs of hotspots || []) {
        const layoutW = layout.width || 800;
        const layoutH = layout.height || 600;
        const targetW = renderer.width || (renderer.view && renderer.view.width) || 0;
        const targetH = renderer.height || (renderer.view && renderer.view.height) || 0;
        const sx = targetW / layoutW;
        const sy = targetH / layoutH;
        // Use 'cover' scaling so hotspots map to the background positioning
        const scale = Math.max(sx, sy);
        const x = (targetW - layoutW * scale) / 2 + hs.x * scale;
        const y = (targetH - layoutH * scale) / 2 + hs.y * scale;
        const w = hs.w * scale;
        const h = hs.h * scale;

        const c = new PIXI.Container();

        // track current canvas pixel size for this hotspot (mutable)
        let currW = w;
        let currH = h;

        // hotspot hit area
        const g = new PIXI.Graphics();
        const drawHit = () => {
          g.clear();
          g.beginFill(0xffffff, 0.001);
          g.drawRect(0, 0, currW, currH);
          g.endFill();
        };
        drawHit();
        c.addChild(g);

        // debug outline
        const outline = new PIXI.Graphics();
        const drawOutline = () => {
          outline.clear();
          outline.lineStyle(2, 0xffff66, 0.7);
          outline.drawRect(0, 0, currW, currH);
          outline.endFill();
        };
        drawOutline();
        outline.alpha = 0.0;
        c.addChild(outline);

        // resize handles
        const handleSize = Math.max(8, Math.round(8 * (window.devicePixelRatio || 1)));
        const makeHandle = (cursor: string) => {
          const hdl = new PIXI.Graphics();
          hdl.beginFill(0x333333, 0.9);
          hdl.drawRect(0, 0, handleSize, handleSize);
          hdl.endFill();
          hdl.interactive = true;
          hdl.cursor = cursor;
          return hdl;
        };
        const hNW = makeHandle('nwse-resize');
        const hNE = makeHandle('nesw-resize');
        const hSW = makeHandle('nesw-resize');
        const hSE = makeHandle('nwse-resize');
        const positionHandles = () => {
          hNW.x = -handleSize / 2;
          hNW.y = -handleSize / 2;
          hNE.x = currW - handleSize / 2;
          hNE.y = -handleSize / 2;
          hSW.x = -handleSize / 2;
          hSW.y = currH - handleSize / 2;
          hSE.x = currW - handleSize / 2;
          hSE.y = currH - handleSize / 2;
        };
        positionHandles();
        c.addChild(hNW, hNE, hSW, hSE);

        c.x = x;
        c.y = y;
        c.interactive = true;
        c.cursor = "pointer";
        // ensure hotspots render above scene items so they receive pointer events
        try { (c as any).zIndex = 99999; } catch (_) { /* ignore */ }

        // drag/resize state
        (c as any)._dragData = null;
        (c as any)._dragOffset = { x: 0, y: 0 };
        (c as any)._dragging = false;
        (c as any)._downPos = { x: 0, y: 0 };
        (c as any)._downTime = 0;
        (c as any)._resizing = null as null | { handle: 'nw' | 'ne' | 'sw' | 'se'; data: any; start: { x: number; y: number; w: number; h: number; px: number; py: number } };

        c.on("pointerover", () => { outline.alpha = 1.0; hNW.visible = hNE.visible = hSW.visible = hSE.visible = true; });
        c.on("pointerout", () => { if (!(c as any)._dragging && !(c as any)._resizing) { outline.alpha = 0.0; hNW.visible = hNE.visible = hSW.visible = hSE.visible = false; } });

        // pointerdown on container (start drag)
        c.on("pointerdown", (event: any) => {
          // don't start a drag if a handle started it
          if ((c as any)._resizing) return;
          (c as any)._dragData = event.data;
          (c as any)._dragging = true;
          try {
            const pos = (c as any)._dragData.getLocalPosition(appInst.stage);
            (c as any)._dragOffset.x = pos.x - c.x;
            (c as any)._dragOffset.y = pos.y - c.y;
            (c as any)._downPos.x = pos.x;
            (c as any)._downPos.y = pos.y;
          } catch (err) {
            // fallback
            (c as any)._dragOffset.x = 0;
            (c as any)._dragOffset.y = 0;
            (c as any)._downPos.x = 0;
            (c as any)._downPos.y = 0;
          }
          (c as any)._downTime = Date.now();
        });

        c.on("pointermove", () => {
          // dragging
          if ((c as any)._dragging && !(c as any)._resizing) {
            try {
              const pos = (c as any)._dragData.getLocalPosition(appInst.stage);
              const newX = pos.x - (c as any)._dragOffset.x;
              const newY = pos.y - (c as any)._dragOffset.y;
              // Clamp inside background bounds if background exists
              const bgLeft = (targetW - layoutW * scale) / 2;
              const bgTop = (targetH - layoutH * scale) / 2;
              const maxX = bgLeft + layoutW * scale - currW;
              const maxY = bgTop + layoutH * scale - currH;
              c.x = Math.max(bgLeft, Math.min(newX, maxX));
              c.y = Math.max(bgTop, Math.min(newY, maxY));
              return;
            } catch (err) {
              return;
            }
          }
          // resizing
          if ((c as any)._resizing) {
            const rs = (c as any)._resizing;
            try {
              const pos = rs.data.getLocalPosition(appInst.stage);
              const dx = pos.x - rs.start.px;
              const dy = pos.y - rs.start.py;
              let newX = rs.start.x;
              let newY = rs.start.y;
              let newW = rs.start.w;
              let newH = rs.start.h;
              const minSize = Math.max(8, 6 * (window.devicePixelRatio || 1));
              if (rs.handle === 'nw') {
                newW = Math.max(minSize, rs.start.w - dx);
                newH = Math.max(minSize, rs.start.h - dy);
                newX = rs.start.x + (rs.start.w - newW);
                newY = rs.start.y + (rs.start.h - newH);
              } else if (rs.handle === 'ne') {
                newW = Math.max(minSize, rs.start.w + dx);
                newH = Math.max(minSize, rs.start.h - dy);
                newY = rs.start.y + (rs.start.h - newH);
              } else if (rs.handle === 'sw') {
                newW = Math.max(minSize, rs.start.w - dx);
                newH = Math.max(minSize, rs.start.h + dy);
                newX = rs.start.x + (rs.start.w - newW);
              } else if (rs.handle === 'se') {
                newW = Math.max(minSize, rs.start.w + dx);
                newH = Math.max(minSize, rs.start.h + dy);
              }
              // clamp to bg
              const bgLeft = (targetW - layoutW * scale) / 2;
              const bgTop = (targetH - layoutH * scale) / 2;
              const maxX = bgLeft + layoutW * scale - newW;
              const maxY = bgTop + layoutH * scale - newH;
              newX = Math.max(bgLeft, Math.min(newX, maxX));
              newY = Math.max(bgTop, Math.min(newY, maxY));
              currW = newW;
              currH = newH;
              c.x = newX;
              c.y = newY;
              drawHit();
              drawOutline();
              positionHandles();
              return;
            } catch (err) {
              return;
            }
          }
        });

        const finishDragOrResize = async () => {
          // finish resizing
          if ((c as any)._resizing) {
            (c as any)._resizing = null;
            // callback transform
            const newLayoutX = (c.x - (targetW - layoutW * scale) / 2) / scale;
            const newLayoutY = (c.y - (targetH - layoutH * scale) / 2) / scale;
            const newLayoutW = currW / scale;
            const newLayoutH = currH / scale;
            if (typeof (onHotspotTransform as any) === 'function') {
              try { (onHotspotTransform as any)(hs.id, newLayoutX, newLayoutY, newLayoutW, newLayoutH); } catch (e) { console.error(e); }
            }
            outline.alpha = 0.0;
            hNW.visible = hNE.visible = hSW.visible = hSE.visible = false;
            return;
          }
          // finish dragging
          if ((c as any)._dragging) {
            (c as any)._dragging = false;
            const upTime = Date.now();
            const pos = (c as any)._dragOffset && (c as any)._dragData ? (c as any)._dragData.getLocalPosition(appInst.stage) : { x: (c as any)._downPos.x, y: (c as any)._downPos.y };
            const moved = Math.hypot(pos.x - (c as any)._downPos.x, pos.y - (c as any)._downPos.y);
            const timeDiff = upTime - (c as any)._downTime;
            if (moved < 6 && timeDiff < 400) {
              try { await onHotspotAction(hs.id); } catch (e) { console.error('Hotspot action error', e); }
            } else {
              const newLayoutX = (c.x - (targetW - layoutW * scale) / 2) / scale;
              const newLayoutY = (c.y - (targetH - layoutH * scale) / 2) / scale;
              if (typeof (onHotspotMove as any) === 'function') {
                try { (onHotspotMove as any)(hs.id, newLayoutX, newLayoutY); } catch (e) { console.error(e); }
              }
            }
            (c as any)._dragData = null;
          }
        };

          // finish handlers
        c.on("pointerup", finishDragOrResize);
        c.on("pointerupoutside", finishDragOrResize);

        // handle pointerdown for each handle
        const startResize = (handleName: 'nw' | 'ne' | 'sw' | 'se') => (event: any) => {
          (c as any)._resizing = {
            handle: handleName,
            data: event.data,
            start: { x: c.x, y: c.y, w: currW, h: currH, px: event.data.getLocalPosition(appInst.stage).x, py: event.data.getLocalPosition(appInst.stage).y }
          };
        };
        hNW.on('pointerdown', startResize('nw'));
        hNE.on('pointerdown', startResize('ne'));
        hSW.on('pointerdown', startResize('sw'));
        hSE.on('pointerdown', startResize('se'));

        // hide handles by default until hover
        hNW.visible = hNE.visible = hSW.visible = hSE.visible = false;

        appInst.stage.addChild(c);
      }

      // DOM overlay removed; rely on PIXI rendering
    };

    try { draw(); } catch (err) { console.error('[PixiRoom] draw() failed', err); }

    // force a render after draw to ensure canvas pixels update immediately
    try { if (appRef.current) appRef.current.renderer.render(appRef.current.stage); } catch (err) { /* ignore */ }

    // Diagnostic: attempt to read center pixel from the canvas (2D ctx or PIXI extract)
    try {
      const appInst = appRef.current;
      if (appInst) {
        const view = (appInst.renderer.view as unknown) as HTMLCanvasElement | undefined;
        if (view) {
          try {
            const dprLocal = window.devicePixelRatio || 1;
            const cw = Math.max(1, Math.floor((view.width || 1) / dprLocal));
            const ch = Math.max(1, Math.floor((view.height || 1) / dprLocal));
            // try 2d read first
            const ctx = view.getContext && view.getContext('2d');
            if (ctx) {
              try {
                const img = ctx.getImageData(Math.floor(cw / 2), Math.floor(ch / 2), 1, 1).data;
                console.info('[PixiRoom] center pixel (2d):', [img[0], img[1], img[2], img[3]]);
              } catch (e) {
                console.info('[PixiRoom] 2d getImageData failed', e);
              }
            } else if ((appInst.renderer as any).extract && typeof (appInst.renderer as any).extract.canvas === 'function') {
              try {
                const tmp = (appInst.renderer as any).extract.canvas(appInst.stage);
                const tctx = tmp.getContext && tmp.getContext('2d');
                if (tctx) {
                  const img = tctx.getImageData(Math.floor(tmp.width / 2), Math.floor(tmp.height / 2), 1, 1).data;
                  console.info('[PixiRoom] center pixel (extract.canvas):', [img[0], img[1], img[2], img[3]]);
                } else {
                  console.info('[PixiRoom] extract.canvas returned no 2d context');
                }
              } catch (e) {
                console.info('[PixiRoom] extract.canvas read failed', e);
              }
            } else {
              console.info('[PixiRoom] cannot read center pixel: no 2d ctx and no extract.canvas');
            }
          } catch (e) { console.info('[PixiRoom] pixel-read top-level error', e); }
        }
      }
    } catch (e) { /* ignore */ }

    const resizeObserver = new ResizeObserver(() => {
      // ensure renderer matches container size then redraw
      const appInst = appRef.current;
      const cw = containerRef.current?.clientWidth || 0;
      const ch = containerRef.current?.clientHeight || 0;
      const dprLocal = window.devicePixelRatio || 1;
      if (appInst && cw > 0 && ch > 0) {
        try {
          appInst.renderer.resize(cw, ch);
          try {
            const view = appInst.renderer.view as unknown as HTMLCanvasElement;
            view.width = Math.max(1, Math.floor(cw * dprLocal));
            view.height = Math.max(1, Math.floor(ch * dprLocal));
            view.style.width = cw + 'px';
            view.style.height = ch + 'px';
          } catch (_) { /* ignore */ }
        } catch (err) { /* ignore */ }
      }
      // update overlay backing store size when present
      try {
        const ov = createdOverlayRef.current;
        if (ov && cw > 0 && ch > 0) {
          try {
            ov.width = Math.max(1, Math.floor(cw * dprLocal));
            ov.height = Math.max(1, Math.floor(ch * dprLocal));
            ov.style.width = cw + 'px';
            ov.style.height = ch + 'px';
            // ensure overlay remains the last child (on top)
            try { if (ov.parentNode) ov.parentNode.appendChild(ov); } catch (_) { /* ignore */ }
          } catch (_) { /* ignore */ }
        }
      } catch (_) { /* ignore */ }
      draw();
    });
    if (containerRef.current) resizeObserver.observe(containerRef.current);

      return () => {
      try {
        resizeObserver.disconnect();
      } catch (err) {
        console.error('[PixiRoom] resizeObserver.disconnect failed', err);
      }
      try {
        // Only remove the canvas we created; if the Designer placed its own canvas,
        // leave it intact.
        try {
          const myCanvas = createdCanvasRef.current;
          if (myCanvas && myCanvas.parentNode) {
            try { myCanvas.parentNode.removeChild(myCanvas); } catch (_) { /* ignore */ }
          }
        } catch (_) { /* ignore */ }
        appRef.current = null;
        createdCanvasRef.current = null;
        // remove overlay canvas if created for pure-canvas fallback and detach handler
        try {
          const ov = createdOverlayRef.current;
          if (ov) {
            try { if (typeof overlayPointerHandler === 'function') ov.removeEventListener('pointerdown', overlayPointerHandler); } catch (_) { /* ignore */ }
            if (ov.parentNode) {
              try { ov.parentNode.removeChild(ov); } catch (_) { /* ignore */ }
            }
          }
        } catch (_) { /* ignore */ }
        createdOverlayRef.current = null;
      } catch (err) {
        console.error('[PixiRoom] minimal cleanup failed', err);
      }
      try { if (containerRef.current) containerRef.current.innerHTML = ""; } catch (err) { console.error('[PixiRoom] clear container failed', err); }
      };
    } catch (err) {
      console.error('[PixiRoom] useEffect top-level error', err);
    }
  }, [layout, hotspots, puzzleId, onHotspotAction]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 300 }} />
  );
}
