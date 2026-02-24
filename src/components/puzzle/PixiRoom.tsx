"use client";

import React, { useEffect, useRef, useState } from "react";
import * as PIXI from "pixi.js";

/** Check whether a URL points to a video file (mp4, webm, mov, avi). */
const isVideoUrl = (url: string | undefined | null): boolean => {
  if (!url || typeof url !== 'string') return false;
  const clean = url.split(/[?#]/)[0].toLowerCase();
  return /\.(mp4|webm|mov|avi)$/.test(clean);
};

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
  onEffectiveLayoutSize,
}: {
  puzzleId: string;
  layout: { id: string; title?: string | null; backgroundUrl?: string | null; width?: number | null; height?: number | null } | null;
  hotspots: Hotspot[];
  onHotspotAction: (hotspotId: string) => Promise<void> | void;
  onHotspotMove?: (hotspotId: string, x: number, y: number) => void;
  onHotspotTransform?: (hotspotId: string, x: number, y: number, w: number, h: number) => void;
  onEffectiveLayoutSize?: (w: number, h: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const createdCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const createdOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const runIdRef = useRef(0);
  const [runtimeForceCanvas, setRuntimeForceCanvas] = useState(false);
  const hotspotsRef = useRef<Hotspot[]>(hotspots);
  const onHotspotActionRef = useRef<typeof onHotspotAction>(onHotspotAction);
  // local handle for canvas created inside effect (so closures can reference it)
  let createdCanvasLocal: HTMLCanvasElement | null = null;

  useEffect(() => {
    hotspotsRef.current = hotspots;
  }, [hotspots]);

  useEffect(() => {
    onHotspotActionRef.current = onHotspotAction;
  }, [onHotspotAction]);

  // If we auto-fallback to Canvas due to a WebGL crash, keep it for this puzzle.
  // Reset when navigating to a different puzzle.
  useEffect(() => {
    setRuntimeForceCanvas(false);
  }, [puzzleId]);

  const layoutKey = layout?.id ?? null;
  const layoutBg = layout?.backgroundUrl ?? null;
  const layoutW = layout?.width ?? null;
  const layoutH = layout?.height ?? null;
  const layoutItemsSignature = (() => {
    try {
      const items = Array.isArray((layout as any)?.items) ? (layout as any).items : [];
      return JSON.stringify(
        items.map((it: any) => ({
          id: it?.id ?? null,
          imageUrl: it?.imageUrl ?? null,
          x: it?.x ?? null,
          y: it?.y ?? null,
          w: it?.w ?? null,
          h: it?.h ?? null,
          zIndex: it?.zIndex ?? it?.z ?? null,
          visualAlpha: it?.visualAlpha ?? null,
          visualScale: it?.visualScale ?? null,
          visualRotationDeg: it?.visualRotationDeg ?? null,
          visualTint: it?.visualTint ?? null,
        }))
      );
    } catch {
      return '[]';
    }
  })();

  const isEditor = typeof onHotspotMove === 'function' || typeof onHotspotTransform === 'function';

  const normalizeImageUrl = (raw: string | null | undefined): string => {
    const src = (raw || '').trim();
    if (!src) return '';
    // If a remote URL is used, route through the image proxy to avoid CORS blocking in WebGL.
    // (Proxy may be restricted in production via ALLOWED_IMAGE_HOSTS.)
    if (/^https?:\/\//i.test(src)) {
      return `/api/image-proxy?url=${encodeURIComponent(src)}`;
    }
    return src;
  };

  type FitMode = 'cover' | 'contain';

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    const runId = ++runIdRef.current;
    const isStale = () => cancelled || runId !== runIdRef.current;

    void (async () => {
      try {
        // Diagnostic: confirm effect runs and show initial state
        try { console.info('[PixiRoom] useEffect start', { puzzleId, hasContainer: !!containerRef.current, hasLayout: !!layout, layout }); } catch (_) { /* ignore */ }
        if (isStale()) return;
        if (!containerRef.current || !layout) {
          try { console.info('[PixiRoom] useEffect early exit - missing container or layout', { hasContainer: !!containerRef.current, hasLayout: !!layout }); } catch (_) { /* ignore */ }
          return;
        }

      let app: PIXI.Application | null = null;
      let forceCanvasOverride = false;
      // pure-canvas fallback state (declare early so we can enable fallback immediately)
      let usePureCanvas: boolean = false;
      let pureCtx: CanvasRenderingContext2D | null = null;
      let pureCanvasEl: HTMLCanvasElement | null = null;
      let bgImageEl: HTMLImageElement | null = null;
      // cache loaded HTMLImageElements to ensure ordered drawing on canvas fallback
      const imageCache = new Map<string, HTMLImageElement>();
      // pointer handler for overlay (kept so we can remove on cleanup)
      let overlayPointerHandler: ((ev: PointerEvent) => void) | null = null;
      let overlayPointerTarget: HTMLCanvasElement | null = null;
      // PIXI texture loading cache (avoid repeatedly calling Texture.from on URLs that aren't loaded yet)
      const pixiTextureCache = new Map<string, PIXI.Texture>();
      const pixiTextureLoading = new Set<string>();

      const getOrLoadPixiTexture = (url: string | null | undefined): PIXI.Texture | null => {
        const src = normalizeImageUrl(url);
        if (!src) return null;
        const cached = pixiTextureCache.get(src);
        if (cached) return cached;

        // Try PIXI Assets cache first (if already loaded elsewhere)
        try {
          const assetsAny = (PIXI as any).Assets;
          if (assetsAny && typeof assetsAny.get === 'function') {
            const asset = assetsAny.get(src);
            const tex = asset instanceof PIXI.Texture ? asset : (asset?.texture instanceof PIXI.Texture ? asset.texture : null);
            if (tex) {
              pixiTextureCache.set(src, tex);
              return tex;
            }
          }
        } catch (_) { /* ignore */ }

        if (!pixiTextureLoading.has(src)) {
          pixiTextureLoading.add(src);
          try {
            const assetsAny = (PIXI as any).Assets;
            const loadPromise: Promise<any> | null = assetsAny && typeof assetsAny.load === 'function' ? assetsAny.load(src) : null;
            if (loadPromise) {
              loadPromise
                .then((asset: any) => {
                  const tex = asset instanceof PIXI.Texture ? asset : (asset?.texture instanceof PIXI.Texture ? asset.texture : null);
                  if (tex) pixiTextureCache.set(src, tex);
                })
                .catch((err: any) => {
                  console.info('[PixiRoom] PIXI.Assets.load failed', src, err);
                })
                .finally(() => {
                  pixiTextureLoading.delete(src);
                  if (!isStale()) {
                    try { draw(); } catch (_) { /* ignore */ }
                  }
                });
            } else {
              // As a last resort, fall back to Texture.from (may warn, but can still load)
              try {
                const tex = PIXI.Texture.from(src);
                pixiTextureCache.set(src, tex);
                pixiTextureLoading.delete(src);
                return tex;
              } catch (_) {
                pixiTextureLoading.delete(src);
              }
            }
          } catch (_) {
            pixiTextureLoading.delete(src);
          }
        }
        return null;
      };

      // ---- Video texture support ----
      // Cache for PIXI textures created from <video> elements
      const videoTextureCache = new Map<string, { tex: PIXI.Texture; video: HTMLVideoElement }>();
      // Cache for <video> elements used in Canvas2D fallback
      const videoElementCache = new Map<string, HTMLVideoElement>();

      /** Create (or retrieve cached) a looping autoplay <video> element for a given URL. */
      const getOrCreateVideoElement = (url: string): HTMLVideoElement | null => {
        const src = normalizeImageUrl(url);
        if (!src) return null;
        const cached = videoElementCache.get(src);
        if (cached) return cached;
        const vid = document.createElement('video');
        vid.src = src;
        vid.crossOrigin = 'anonymous';
        vid.autoplay = true;
        vid.loop = true;
        vid.muted = true;
        vid.playsInline = true;
        vid.preload = 'auto';
        vid.play().catch(() => { /* autoplay may be blocked */ });
        videoElementCache.set(src, vid);
        return vid;
      };

      /** Get or create a PIXI.Texture from a video URL. Returns null if not ready. */
      const getOrLoadVideoTexture = (url: string): PIXI.Texture | null => {
        const src = normalizeImageUrl(url);
        if (!src) return null;
        const cached = videoTextureCache.get(src);
        if (cached) return cached.tex;
        const vid = getOrCreateVideoElement(url);
        if (!vid) return null;
        try {
          const tex = PIXI.Texture.from(vid);
          videoTextureCache.set(src, { tex, video: vid });
          // Re-draw periodically while video plays so it stays animated
          const onPlaying = () => {
            if (!isStale()) {
              const animate = () => {
                if (isStale() || vid.paused || vid.ended) return;
                try { draw(); } catch (_) { /* ignore */ }
                requestAnimationFrame(animate);
              };
              requestAnimationFrame(animate);
            }
          };
          vid.addEventListener('playing', onPlaying, { once: true });
          return tex;
        } catch (_) {
          return null;
        }
      };

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
        // Pixi v8: create Application then await `app.init()`.
        // We still keep a legacy fallback in case a different build is present.
        const appOptions = {
          // v8 prefers `canvas`; keep `view` out to avoid deprecated getters.
          canvas,
          // Player view uses a solid background so letterboxing from 'contain' isn't white.
          // Designer/editor stays transparent so it blends with the editor UI.
          backgroundAlpha: isEditor ? 0 : 1,
          backgroundColor: 0x0b1220,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
          // Ask explicitly for a stencil buffer; some Pixi features (masks) and pipelines assume it.
          // Also helps avoid warnings/errors when a context is created without stencil.
          stencil: true,
          antialias: true,
          // Render on-demand so render errors are catchable (avoid uncaught crashes inside Pixi's ticker).
          autoStart: false,
          width,
          height,
        } as any;

        // Hard override: allow forcing Canvas renderer for environments where WebGL is unstable.
        // - Set `NEXT_PUBLIC_PIXI_FORCE_CANVAS=1` (client-side env)
        // - Or append `?forceCanvas=1` to the URL
        forceCanvasOverride = false;
        try {
          const qp = new URLSearchParams(window.location.search);
          forceCanvasOverride = qp.get('forceCanvas') === '1';
        } catch (_) {
          // ignore
        }
        try {
          if ((process.env as any).NEXT_PUBLIC_PIXI_FORCE_CANVAS === '1') forceCanvasOverride = true;
        } catch (_) {
          // ignore
        }
        if (runtimeForceCanvas) forceCanvasOverride = true;
        if (forceCanvasOverride) {
          appOptions.forceCanvas = true;
          console.info('[PixiRoom] forceCanvas override enabled');
        }

        // Pixi v8 WebGL can crash inside its shader error logging on some stacks
        // (gl.getShaderSource(...) is null -> .split throws). The most reliable fix
        // for player mode is to bypass PIXI entirely and use the pure Canvas2D renderer.
        // Keep PIXI enabled only for editor interactions.
        const forcePureCanvas = !isEditor;
        if (forcePureCanvas) {
          console.info('[PixiRoom] using pure Canvas2D mode for player (skipping PIXI init)');
        }

        if (!forcePureCanvas) {
          // Detect WebGL availability WITHOUT touching the real canvas.
          // Calling `canvas.getContext('webgl')` here can create a context with default attributes
          // (often without stencil). Pixi will then reuse that context and warn/spam WebGL errors.
          let supportsWebGL = false;
          if (!appOptions.forceCanvas) {
            try {
              const testCanvas = document.createElement('canvas');
              supportsWebGL = !!(
                (testCanvas.getContext && testCanvas.getContext('webgl2', { stencil: true } as any)) ||
                (testCanvas.getContext && testCanvas.getContext('webgl', { stencil: true } as any))
              );
            } catch (_) {
              supportsWebGL = false;
            }
          }

          if (!supportsWebGL || appOptions.forceCanvas) {
            appOptions.forceCanvas = true;
            console.info('[PixiRoom] WebGL not detected (or forced off) — forcing Canvas renderer fallback');
          } else {
            console.info('[PixiRoom] WebGL detected — using GPU renderer when available');
          }
        }

        if (!forcePureCanvas) {
          try {
            // Pre-create diagnostics
            try { console.info('[PixiRoom] PIXI.version/info', { VERSION: (PIXI as any).VERSION || (PIXI as any).version || null, AppType: typeof PIXI.Application }); } catch (_) { /* ignore */ }
            try { console.info('[PixiRoom] appOptions before create', { width, height, resolution: appOptions.resolution, forceCanvas: appOptions.forceCanvas || false }); } catch (_) { /* ignore */ }
            try { console.info('[PixiRoom] canvas present in DOM?', !!(canvas && canvas.parentNode), 'canvas size:', { cw: canvas.width, ch: canvas.height, cssW: canvas.style?.width, cssH: canvas.style?.height }); } catch (_) { /* ignore */ }

            // Pixi v8: constructor does NOT fully initialize renderer; call `app.init()`.
            // eslint-disable-next-line new-cap
            const maybeApp = new (PIXI as any).Application();
            if (maybeApp && typeof maybeApp.init === 'function') {
              await maybeApp.init(appOptions);
              if (isStale()) {
                try {
                  try { maybeApp.ticker?.stop?.(); } catch (_) { /* ignore */ }
                  try { maybeApp.stop?.(); } catch (_) { /* ignore */ }
                  try { maybeApp.destroy?.({ removeView: true, children: true } as any); } catch (_) { /* ignore */ }
                } catch (_) { /* ignore */ }
                return;
              }
              app = maybeApp as PIXI.Application;
              console.info('[PixiRoom] Application.init() completed; renderer present?', !!(app as any).renderer);
            } else {
              // Legacy: some builds still accept constructor options.
              // eslint-disable-next-line new-cap
              app = new PIXI.Application({ ...(appOptions as any), view: canvas } as any);
              console.info('[PixiRoom] Legacy constructor created app', !!app, 'renderer present?', !!(app as any).renderer);
            }
          } catch (err) {
            console.error('[PixiRoom] Failed to init PIXI.Application, falling back to Canvas2D', err);
            // Ensure the component doesn't hard-crash; let the pure-canvas path handle rendering.
            app = null;
          }
        } else {
          app = null;
        }

        // Ensure no internal ticker is running. We render on-demand inside `draw()`.
        try {
          const appAny = app as any;
          if (appAny?.ticker) {
            try { appAny.ticker.autoStart = false; } catch (_) { /* ignore */ }
            try { appAny.ticker.stop?.(); } catch (_) { /* ignore */ }
          }
          try { appAny?.stop?.(); } catch (_) { /* ignore */ }
        } catch (_) {
          /* ignore */
        }
        // ensure renderer matches container immediately
        try {
          if (app && (app as any).renderer) {
            (app as any).renderer.resize(width, height);
          }
          // make sure the canvas element backing store matches DPR-scaled pixels
          try {
            canvas.width = Math.max(1, Math.floor(width * dpr));
            canvas.height = Math.max(1, Math.floor(height * dpr));
            canvas.style.width = width + 'px';
            canvas.style.height = height + 'px';
          } catch (_) { /* ignore */ }
        } catch (err) { /* ignore */ }
        appRef.current = app;
        // If the created PIXI Application lacks a renderer (some builds strip renderers),
        // enable the pure-canvas fallback immediately so the user sees a visible output.
        try {
          if (forcePureCanvas || !app || !(app as any).renderer) {
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
                  // keep overlay above the PIXI canvas, but below the fixed Navbar (z-50)
                  overlay.style.zIndex = '10';
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
                  overlayPointerTarget = overlay;
                  overlayPointerHandler = (ev: PointerEvent) => {
                    try {
                      const targetCanvas = overlayPointerTarget;
                      if (!targetCanvas) return;
                      const rect = targetCanvas.getBoundingClientRect();
                      const dprLocal = window.devicePixelRatio || 1;
                      // convert client coords to backing-store (canvas) pixels
                      const bx = (ev.clientX - rect.left) * dprLocal;
                      const by = (ev.clientY - rect.top) * dprLocal;
                      const canvasW = targetCanvas.width || Math.max(1, Math.floor(rect.width * dprLocal));
                      const canvasH = targetCanvas.height || Math.max(1, Math.floor(rect.height * dprLocal));
                      const layoutW = layout.width || (bgImageEl && bgImageEl.naturalWidth) || 800;
                      const layoutH = layout.height || (bgImageEl && bgImageEl.naturalHeight) || 600;
                      const mode = getFitMode();
                      const { scale, offsetX, offsetY } = computeTransform(layoutW, layoutH, canvasW, canvasH, mode);
                      const lx = (bx - offsetX) / scale;
                      const ly = (by - offsetY) / scale;
                      const hsNorm = normalizeHotspotsToLayout(hotspotsRef.current || [], layoutW, layoutH);
                      for (const hs of hsNorm || []) {
                        if (lx >= hs.x && lx <= hs.x + hs.w && ly >= hs.y && ly <= hs.y + hs.h) {
                          try {
                            const fn = onHotspotActionRef.current;
                            if (typeof fn === 'function') fn(hs.id);
                          } catch (e) {
                            console.error('Hotspot action error', e);
                          }
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
                // Prefer proxying remote hosts to avoid CORS issues (especially for canvas/WebGL).
                // Keep crossOrigin enabled; the proxy is same-origin.
                bgImageEl.crossOrigin = 'anonymous';
                bgImageEl.src = normalizeImageUrl(layout.backgroundUrl);
                bgImageEl.onload = () => { try { /* trigger a draw once loaded */ draw(); } catch (_) { /* ignore */ } };
              } catch (_) { bgImageEl = null; }
            }
            // If we ended up drawing directly on the base canvas (no overlay), we still need
            // a pointer handler so player-mode hotspots work.
            try {
              if (pureCtx && pureCanvasEl && !overlayPointerHandler) {
                overlayPointerTarget = pureCanvasEl;
                overlayPointerHandler = (ev: PointerEvent) => {
                  try {
                    const targetCanvas = overlayPointerTarget;
                    if (!targetCanvas) return;
                    const rect = targetCanvas.getBoundingClientRect();
                    const dprLocal = window.devicePixelRatio || 1;
                    const bx = (ev.clientX - rect.left) * dprLocal;
                    const by = (ev.clientY - rect.top) * dprLocal;
                    const canvasW = targetCanvas.width || Math.max(1, Math.floor(rect.width * dprLocal));
                    const canvasH = targetCanvas.height || Math.max(1, Math.floor(rect.height * dprLocal));
                    const eff = resolveLayoutSize();
                    const mode = getFitMode();
                    const { scale, offsetX, offsetY } = computeTransform(eff.w, eff.h, canvasW, canvasH, mode);
                    const lx = (bx - offsetX) / scale;
                    const ly = (by - offsetY) / scale;
                    const hsNorm = normalizeHotspotsToLayout(hotspotsRef.current || [], eff.w, eff.h);
                    for (const hs of hsNorm || []) {
                      if (lx >= hs.x && lx <= hs.x + hs.w && ly >= hs.y && ly <= hs.y + hs.h) {
                        try {
                          const fn = onHotspotActionRef.current;
                          if (typeof fn === 'function') fn(hs.id);
                        } catch (e) {
                          console.error('Hotspot action error', e);
                        }
                        ev.stopPropagation();
                        ev.preventDefault();
                        return;
                      }
                    }
                  } catch (_) {
                    /* ignore */
                  }
                };
                try { pureCanvasEl.addEventListener('pointerdown', overlayPointerHandler); } catch (_) { /* ignore */ }
              }
            } catch (_) { /* ignore */ }

            console.info('[PixiRoom] enabled pure Canvas2D fallback immediately', { hasCtx: !!pureCtx, forcePureCanvas });
          }
        } catch (_) { /* ignore */ }
        // If renderer missing, attempt a recovery by creating a PIXI.Application without `view` so
        // the runtime can construct its own renderer. Then attach that renderer canvas to the DOM.
        try {
          if (!forcePureCanvas && (!app || !(app as any).renderer)) {
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
                  const rendererEl = ((altApp.renderer as any)?.canvas || (altApp.renderer as any)?.view) as HTMLCanvasElement | undefined;
                  if (rendererEl) {
                    if (createdCanvasRef.current && createdCanvasRef.current.parentNode) {
                      try { createdCanvasRef.current.parentNode.replaceChild(rendererEl, createdCanvasRef.current); } catch (_) { /* ignore */ }
                    } else if (createdCanvasLocal && createdCanvasLocal.parentNode) {
                      try { createdCanvasLocal.parentNode.replaceChild(rendererEl, createdCanvasLocal); } catch (_) { /* ignore */ }
                    } else if (containerRef.current) {
                      try { containerRef.current.appendChild(rendererEl); } catch (_) { /* ignore */ }
                    }
                    createdCanvasRef.current = rendererEl;
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
        if (!forcePureCanvas) {
          try {
            // immediate diagnostics: report renderer and view presence and sizes
            if (app && (app as any).renderer) {
              const rendererExists = true;
              const rendererName = (app.renderer as any)?.constructor?.name || 'unknown';
              const canvasEl = ((app.renderer as any)?.canvas || (app.renderer as any)?.view) as HTMLCanvasElement | undefined;
              const viewInfo = canvasEl ? { width: canvasEl.width, height: canvasEl.height, cssWidth: canvasEl.style?.width, cssHeight: canvasEl.style?.height, has2d: !!(canvasEl.getContext && canvasEl.getContext('2d')) } : null;
              console.info('[PixiRoom] created renderer:', rendererName, 'rendererExists:', rendererExists, 'resolution:', app.renderer?.resolution, 'viewInfo:', viewInfo);
            } else {
              console.info('[PixiRoom] created renderer: none');
            }
          } catch (diagErr) {
            console.info('[PixiRoom] created renderer diagnostics failed', diagErr);
          }
        }
        // enforce renderer resolution and backing store size
        try {
          const dprEnforce = window.devicePixelRatio || 1;
          if (app && (app as any).renderer) {
            try { app.renderer.resolution = dprEnforce; } catch (_) { /* ignore */ }
            try { app.renderer.resize(width, height); } catch (_) { /* ignore */ }
            try {
              const canvasEl = ((app.renderer as any)?.canvas || (app.renderer as any)?.view) as HTMLCanvasElement | undefined;
              if (canvasEl) {
                canvasEl.width = Math.max(1, Math.floor(width * dprEnforce));
                canvasEl.height = Math.max(1, Math.floor(height * dprEnforce));
                canvasEl.style.width = width + 'px';
                canvasEl.style.height = height + 'px';
              }
              /* enforced canvas size */
            } catch (_) { /* ignore */ }
          }
        } catch (err) { /* ignore */ }
      } catch (err) {
        console.error('[PixiRoom] PIXI.Application init failed', err);
        return;
      }

    let bgSprite: PIXI.Sprite | null = null;
    let requestedCanvasFallback = false;
    let skipPixiRendering = false;

      const PREVIEW_W = 600;
      const PREVIEW_H = 320;

      const resolveLayoutSize = () => {
        let w = (layout.width || (bgImageEl && bgImageEl.naturalWidth) || 0) as number;
        let h = (layout.height || (bgImageEl && bgImageEl.naturalHeight) || 0) as number;

        if ((!w || !h) && bgSprite) {
          try {
            const tex: any = (bgSprite as any).texture;
            const base = tex?.baseTexture;
            const orig = tex?.orig;
            const iw = (orig && orig.width) || (base && (base.realWidth || base.width)) || 0;
            const ih = (orig && orig.height) || (base && (base.realHeight || base.height)) || 0;
            if ((!w || !h) && iw && ih) {
              w = iw;
              h = ih;
            }
          } catch {
            // ignore
          }
        }

        if (!w) w = 800;
        if (!h) h = 600;
        return { w, h };
      };

      let lastReportedLayoutW = 0;
      let lastReportedLayoutH = 0;
      const reportEffectiveLayoutSize = () => {
        try {
          const fn = onEffectiveLayoutSize;
          if (typeof fn !== 'function') return;
          const eff = resolveLayoutSize();
          if (!eff?.w || !eff?.h) return;
          if (eff.w === lastReportedLayoutW && eff.h === lastReportedLayoutH) return;
          lastReportedLayoutW = eff.w;
          lastReportedLayoutH = eff.h;
          fn(eff.w, eff.h);
        } catch (_) {
          /* ignore */
        }
      };

      const enablePureCanvasFallback = (reason: string) => {
        try {
          if (usePureCanvas) return;
          usePureCanvas = true;

          const width = containerRef.current?.clientWidth || 800;
          const height = containerRef.current?.clientHeight || 600;
          const dpr = window.devicePixelRatio || 1;

          // Prefer drawing into an overlay 2D canvas so we don't depend on the PIXI canvas context.
          // (A PIXI canvas may already have a WebGL context and refuse a 2D context.)
          let overlay = createdOverlayRef.current;
          if (!overlay && containerRef.current) {
            overlay = document.createElement('canvas');
            overlay.style.position = 'absolute';
            overlay.style.left = '0';
            overlay.style.top = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.pointerEvents = 'auto';
            overlay.style.zIndex = '10';
            createdOverlayRef.current = overlay;
            try { containerRef.current.appendChild(overlay); } catch (_) { /* ignore */ }
          }

          if (overlay) {
            try {
              overlay.width = Math.max(1, Math.floor(width * dpr));
              overlay.height = Math.max(1, Math.floor(height * dpr));
              overlay.style.width = width + 'px';
              overlay.style.height = height + 'px';
            } catch (_) { /* ignore */ }
            try { pureCtx = overlay.getContext && overlay.getContext('2d') ? overlay.getContext('2d') : null; } catch (_) { pureCtx = null; }
            pureCanvasEl = overlay;

            if (pureCtx && !overlayPointerHandler) {
              overlayPointerHandler = (ev: PointerEvent) => {
                try {
                  const rect = overlay!.getBoundingClientRect();
                  const dprLocal = window.devicePixelRatio || 1;
                  const bx = (ev.clientX - rect.left) * dprLocal;
                  const by = (ev.clientY - rect.top) * dprLocal;
                  const canvasW = overlay!.width || Math.max(1, Math.floor(rect.width * dprLocal));
                  const canvasH = overlay!.height || Math.max(1, Math.floor(rect.height * dprLocal));
                  const eff = resolveLayoutSize();
                  const mode = getFitMode();
                  const { scale, offsetX, offsetY } = computeTransform(eff.w, eff.h, canvasW, canvasH, mode);
                  const lx = (bx - offsetX) / scale;
                  const ly = (by - offsetY) / scale;
                  const hsNorm = normalizeHotspotsToLayout(hotspotsRef.current || [], eff.w, eff.h);
                  for (const hs of hsNorm || []) {
                    if (lx >= hs.x && lx <= hs.x + hs.w && ly >= hs.y && ly <= hs.y + hs.h) {
                      try {
                        const fn = onHotspotActionRef.current;
                        if (typeof fn === 'function') fn(hs.id);
                      } catch (e) {
                        console.error('Hotspot action error', e);
                      }
                      ev.stopPropagation();
                      ev.preventDefault();
                      return;
                    }
                  }
                } catch (_) {
                  /* ignore */
                }
              };
              try { overlay.addEventListener('pointerdown', overlayPointerHandler); } catch (_) { /* ignore */ }
            }
          } else {
            // Last resort: draw into the existing canvas if we can get a 2D context.
            pureCanvasEl = createdCanvasRef.current || createdCanvasLocal;
            try { pureCtx = pureCanvasEl && pureCanvasEl.getContext ? pureCanvasEl.getContext('2d') : null; } catch (_) { pureCtx = null; }
          }

          if (layout && layout.backgroundUrl && !bgImageEl) {
            try {
              bgImageEl = new Image();
              bgImageEl.crossOrigin = 'anonymous';
              bgImageEl.src = normalizeImageUrl(layout.backgroundUrl);
              bgImageEl.onload = () => { try { draw(); } catch (_) { /* ignore */ } };
            } catch (_) {
              bgImageEl = null;
            }
          }

          console.info('[PixiRoom] enabled pure Canvas2D fallback', { reason, hasCtx: !!pureCtx });
        } catch (_) {
          // ignore
        }
      };

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
        if (!Array.isArray(hsList) || hsList.length === 0) return [];
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

      const getFitMode = (): FitMode => {
        // Designer/editor expects cover so saved coords remain consistent.
        if (isEditor) return 'cover';
        // Player view should always show the full room (no crop) so scaling stays
        // consistent across all screen sizes and hotspot hit-testing remains aligned.
        return 'contain';
      };

      const computeScale = (sx: number, sy: number, mode: FitMode) => {
        return mode === 'contain' ? Math.min(sx, sy) : Math.max(sx, sy);
      };

      const computeTransform = (layoutW: number, layoutH: number, targetW: number, targetH: number, mode: FitMode) => {
        const safeW = layoutW || 1;
        const safeH = layoutH || 1;
        const sx = targetW / safeW;
        const sy = targetH / safeH;
        const scale = computeScale(sx, sy, mode);
        const offsetX = (targetW - safeW * scale) / 2;
        const offsetY = (targetH - safeH * scale) / 2;
        return { scale, offsetX, offsetY };
      };

      const draw = () => {
        reportEffectiveLayoutSize();
        if (usePureCanvas) {
            try {
            const canvasEl = pureCanvasEl || createdCanvasRef.current || createdCanvasLocal;
            if (!canvasEl) return;
            const ctx = pureCtx || (canvasEl.getContext && canvasEl.getContext('2d'));
            if (!ctx) return;
            // clear
            ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
            // fill fallback background
            ctx.fillStyle = '#0b1220';
            ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
            // draw background image if available
            if (bgImageEl && bgImageEl.complete && bgImageEl.naturalWidth) {
              // compute scale to fit
              const layoutW = layout.width || bgImageEl.naturalWidth || 800;
              const layoutH = layout.height || bgImageEl.naturalHeight || 600;
              const mode = getFitMode();
              const { scale, offsetX, offsetY } = computeTransform(layoutW, layoutH, canvasEl.width, canvasEl.height, mode);
              const drawW = Math.round(layoutW * scale);
              const drawH = Math.round(layoutH * scale);
              const dx = Math.floor(offsetX);
              const dy = Math.floor(offsetY);
              try { ctx.drawImage(bgImageEl, 0, 0, bgImageEl.naturalWidth, bgImageEl.naturalHeight, dx, dy, drawW, drawH); } catch (_) { /* ignore */ }
            }
            const { w: effectiveLayoutW, h: effectiveLayoutH } = resolveLayoutSize();

            // draw items (uploaded images) on top of background — only draw after image loads
            try {
              const items = (layout as any).items || [];
              console.info('[PixiRoom] canvas items count', Array.isArray(items) ? items.length : 0);
              if (Array.isArray(items) && items.length > 0) {
                // These match the Designer preview canvas size used when placing items.
                // Item coordinates are stored in that preview coordinate space.
                const PREVIEW_W = 600;
                const PREVIEW_H = 320;
                // Preserve Designer stacking order (array order) unless an explicit zIndex is provided.
                const itemsSorted = items
                  .map((it: any, idx: number) => ({ ...it, __idx: idx }))
                  .sort((a: any, b: any) => {
                    const za = (typeof a.zIndex === 'number' ? a.zIndex : (typeof a.z === 'number' ? a.z : a.__idx)) as number;
                    const zb = (typeof b.zIndex === 'number' ? b.zIndex : (typeof b.z === 'number' ? b.z : b.__idx)) as number;
                    return za - zb;
                  });
                for (const it of itemsSorted) {
                  try {
                    const src = it?.imageUrl || '';
                    if (!src) continue;
                    const isVid = isVideoUrl(src);
                    // For video items use a <video> element; for images use HTMLImageElement
                    let drawSource: HTMLImageElement | HTMLVideoElement | null = null;
                    let sourceReady = false;
                    if (isVid) {
                      const vid = getOrCreateVideoElement(src);
                      if (vid) {
                        drawSource = vid;
                        sourceReady = vid.readyState >= 2; // HAVE_CURRENT_DATA
                        if (!sourceReady) {
                          // Request redraw once video has data
                          vid.addEventListener('canplay', () => { try { draw(); } catch (_) { /* ignore */ } }, { once: true });
                        }
                      }
                    } else {
                      // reuse or create cached HTMLImageElement so we can draw items in order
                      let img = imageCache.get(src);
                      if (!img) {
                        img = new Image();
                        img.crossOrigin = 'anonymous';
                        img.src = normalizeImageUrl(src);
                        // when any image finishes loading, request a full redraw so draw() will render all items in order
                        img.onload = () => { try { draw(); } catch (_) { /* ignore */ } };
                        img.onerror = () => { console.info('[PixiRoom] item image load failed', src); };
                        imageCache.set(src, img);
                      }
                      drawSource = img;
                      sourceReady = img.complete && !!img.naturalWidth;
                    }
                    const itemLayoutW = effectiveLayoutW;
                    const itemLayoutH = effectiveLayoutH;
                    const scalePreview = Math.max(PREVIEW_W / itemLayoutW, PREVIEW_H / itemLayoutH);
                    const offsetPreviewX = (PREVIEW_W - itemLayoutW * scalePreview) / 2;
                    const offsetPreviewY = (PREVIEW_H - itemLayoutH * scalePreview) / 2;
                    const mode = getFitMode();
                    const { scale: scaleTarget, offsetX: offsetTargetX, offsetY: offsetTargetY } = computeTransform(itemLayoutW, itemLayoutH, canvasEl.width, canvasEl.height, mode);
                    const iw = (typeof it.w === 'number' && it.w > 0) ? it.w : 32;
                    const ih = (typeof it.h === 'number' && it.h > 0) ? it.h : 32;
                    const itemXInLayout = ((it.x || 0) - offsetPreviewX) / (scalePreview || 1);
                    const itemYInLayout = ((it.y || 0) - offsetPreviewY) / (scalePreview || 1);
                    const ix = Math.floor(offsetTargetX + itemXInLayout * scaleTarget);
                    const iy = Math.floor(offsetTargetY + itemYInLayout * scaleTarget);
                    // Item w/h are stored in Designer preview pixels (600x320). Convert preview-pixels -> layout-units -> target-pixels.
                    const sizeScale = (scaleTarget || 1) / (scalePreview || 1);
                    const iW = Math.max(1, Math.floor(iw * sizeScale));
                    const iH = Math.max(1, Math.floor(ih * sizeScale));
                    const alphaRaw = Number((it as any)?.visualAlpha);
                    const visualAlpha = Number.isFinite(alphaRaw) ? Math.max(0, Math.min(1, alphaRaw)) : 1;
                    const scaleRaw = Number((it as any)?.visualScale);
                    const visualScale = Number.isFinite(scaleRaw) && scaleRaw > 0 ? Math.max(0.1, Math.min(5, scaleRaw)) : 1;
                    const rotationRaw = Number((it as any)?.visualRotationDeg);
                    const visualRotationDeg = Number.isFinite(rotationRaw) ? rotationRaw : 0;
                    const tintRaw = typeof (it as any)?.visualTint === 'string' ? String((it as any).visualTint).trim() : '';
                    // Base transforms from Designer
                    const canvasBaseRotation = Number((it as any)?.rotation);
                    const canvasBaseScale = Number((it as any)?.scale);
                    const canvasBaseSkewX = Number((it as any)?.skewX);
                    const canvasBaseSkewY = Number((it as any)?.skewY);
                    const canvasTotalRotationDeg = (Number.isFinite(canvasBaseRotation) ? canvasBaseRotation : 0) + visualRotationDeg;
                    const canvasTotalScale = (Number.isFinite(canvasBaseScale) && canvasBaseScale > 0 ? canvasBaseScale : 1) * visualScale;
                    const canvasSkewXRad = Number.isFinite(canvasBaseSkewX) ? (canvasBaseSkewX * Math.PI) / 180 : 0;
                    const canvasSkewYRad = Number.isFinite(canvasBaseSkewY) ? (canvasBaseSkewY * Math.PI) / 180 : 0;
                    const scaledW = Math.max(1, Math.floor(iW * canvasTotalScale));
                    const scaledH = Math.max(1, Math.floor(iH * canvasTotalScale));
                    if (sourceReady && drawSource) {
                      try {
                        // Match Designer preview: <img style={{ objectFit: 'contain' }}>
                        // Draw the image/video inside the item box without distortion.
                        const srcW = (drawSource as HTMLImageElement).naturalWidth || (drawSource as HTMLVideoElement).videoWidth || scaledW;
                        const srcH = (drawSource as HTMLImageElement).naturalHeight || (drawSource as HTMLVideoElement).videoHeight || scaledH;
                        const srcAspect = srcW / Math.max(1, srcH);
                        const boxAspect = scaledW / Math.max(1, scaledH);
                        let dW = scaledW;
                        let dH = scaledH;
                        if (srcAspect > boxAspect) {
                          dW = scaledW;
                          dH = Math.max(1, Math.round(scaledW / srcAspect));
                        } else {
                          dH = scaledH;
                          dW = Math.max(1, Math.round(scaledH * srcAspect));
                        }
                        const localX = Math.floor((scaledW - dW) / 2);
                        const localY = Math.floor((scaledH - dH) / 2);
                        const cx = Math.floor(ix + iW / 2);
                        const cy = Math.floor(iy + iH / 2);
                        ctx.save();
                        ctx.translate(cx, cy);
                        if (canvasTotalRotationDeg !== 0) {
                          ctx.rotate((canvasTotalRotationDeg * Math.PI) / 180);
                        }
                        if (canvasSkewXRad !== 0 || canvasSkewYRad !== 0) {
                          // Apply skew via 2D transform matrix: [1, tan(skewY), tan(skewX), 1, 0, 0]
                          ctx.transform(1, Math.tan(canvasSkewYRad), Math.tan(canvasSkewXRad), 1, 0, 0);
                        }
                        ctx.globalAlpha = Math.max(0, Math.min(1, (ctx.globalAlpha || 1) * visualAlpha));
                        // Deep dramatic drop shadow
                        ctx.shadowColor = 'rgba(0,0,0,0.6)';
                        ctx.shadowBlur = 6;
                        ctx.shadowOffsetX = 5;
                        ctx.shadowOffsetY = 10;
                        ctx.drawImage(drawSource, 0, 0, srcW, srcH, -Math.floor(scaledW / 2) + localX, -Math.floor(scaledH / 2) + localY, dW, dH);
                        ctx.shadowColor = 'transparent'; // prevent shadow bleeding onto tint layer
                        if (tintRaw) {
                          ctx.save();
                          ctx.globalCompositeOperation = 'source-atop';
                          ctx.globalAlpha = Math.max(0, Math.min(1, visualAlpha * 0.35));
                          ctx.fillStyle = tintRaw;
                          ctx.fillRect(-Math.floor(scaledW / 2), -Math.floor(scaledH / 2), scaledW, scaledH);
                          ctx.restore();
                        }
                        ctx.restore();
                      } catch (_) {
                        /* ignore */
                      }
                    }
                  } catch (_) { /* ignore per-item */ }
                }
              }
            } catch (_) { /* ignore */ }
            // draw hotspots
            try {
              const hsNorm = normalizeHotspotsToLayout(hotspotsRef.current || [], effectiveLayoutW, effectiveLayoutH);
              for (const hs of hsNorm || []) {
                const layoutW = effectiveLayoutW;
                const layoutH = effectiveLayoutH;
                const mode = getFitMode();
                const { scale, offsetX, offsetY } = computeTransform(layoutW, layoutH, canvasEl.width, canvasEl.height, mode);
                const x = Math.floor(offsetX + hs.x * scale);
                const y = Math.floor(offsetY + hs.y * scale);
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

        // Defensive: Pixi (especially WebGL shader error formatting) can throw synchronously.
        // Catch everything here so the page doesn't hard-crash, and attempt a Canvas fallback.
        try {

      // defensive: ensure app still exists
      if (!appRef.current) return;
      const appInst = appRef.current;
      const renderer = (appInst as any).renderer;
      const rendererCanvas = (renderer && ((renderer as any).canvas || (renderer as any).view)) as HTMLCanvasElement | undefined;
      if (!renderer || !rendererCanvas) return;

      // Pixi v8 events: make sure the stage participates in event processing.
      try {
        (appInst.stage as any).eventMode = 'static';
        (appInst.stage as any).hitArea = (appInst as any).screen;
      } catch (_) { /* ignore */ }
      appInst.stage.removeChildren();

      // background
      if (layout.backgroundUrl) {
        const tex = getOrLoadPixiTexture(layout.backgroundUrl);
        if (!tex) {
          // Visible placeholder while the image loads
          const bg = new PIXI.Graphics();
          const targetW = renderer.width || (rendererCanvas && rendererCanvas.width) || 0;
          const targetH = renderer.height || (rendererCanvas && rendererCanvas.height) || 0;
          bg.beginFill(0xf3f4f6, 1);
          bg.drawRect(0, 0, Math.max(1, targetW), Math.max(1, targetH));
          bg.endFill();
          appInst.stage.addChild(bg);
          // skip item rendering until background loads (draw() will be called again when load finishes)
        } else {
          bgSprite = new PIXI.Sprite(tex);
        // Decide which logical layout size to use: prefer persisted layout, else try image intrinsic size, else fallback
        let layoutW = layout.width || 0;
        let layoutH = layout.height || 0;
        const targetW = renderer.width || (rendererCanvas && rendererCanvas.width) || 0;
        const targetH = renderer.height || (rendererCanvas && rendererCanvas.height) || 0;

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
            // Preserve Designer stacking order (array order) unless an explicit zIndex is provided.
            const itemsSorted = items
              .map((it: any, idx: number) => ({ ...it, __idx: idx }))
              .sort((a: any, b: any) => {
                const za = (typeof a.zIndex === 'number' ? a.zIndex : (typeof a.z === 'number' ? a.z : a.__idx)) as number;
                const zb = (typeof b.zIndex === 'number' ? b.zIndex : (typeof b.z === 'number' ? b.z : b.__idx)) as number;
                return za - zb;
              });
            for (let sortedIdx = 0; sortedIdx < itemsSorted.length; sortedIdx++) {
              const it = itemsSorted[sortedIdx];
              try {
                const itemUrl = it.imageUrl || '';
                const texIt = isVideoUrl(itemUrl) ? getOrLoadVideoTexture(itemUrl) : getOrLoadPixiTexture(itemUrl);
                if (!texIt) continue;
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
                const alphaRaw = Number((it as any)?.visualAlpha);
                const visualAlpha = Number.isFinite(alphaRaw) ? Math.max(0, Math.min(1, alphaRaw)) : 1;
                const scaleRaw = Number((it as any)?.visualScale);
                const visualScale = Number.isFinite(scaleRaw) && scaleRaw > 0 ? Math.max(0.1, Math.min(5, scaleRaw)) : 1;
                const rotationRaw = Number((it as any)?.visualRotationDeg);
                const visualRotationDeg = Number.isFinite(rotationRaw) ? rotationRaw : 0;
                // Base transform properties from Designer (rotation, scale, skew)
                const baseRotation = Number((it as any)?.rotation);
                const baseScale = Number((it as any)?.scale);
                const baseSkewX = Number((it as any)?.skewX);
                const baseSkewY = Number((it as any)?.skewY);
                const totalRotationDeg = (Number.isFinite(baseRotation) ? baseRotation : 0) + visualRotationDeg;
                const totalScale = (Number.isFinite(baseScale) && baseScale > 0 ? baseScale : 1) * visualScale;
                const skewXRad = Number.isFinite(baseSkewX) ? (baseSkewX * Math.PI) / 180 : 0;
                const skewYRad = Number.isFinite(baseSkewY) ? (baseSkewY * Math.PI) / 180 : 0;
                const tintRaw = typeof (it as any)?.visualTint === 'string' ? String((it as any).visualTint).trim() : '';
                let tintParsed: number | null = null;
                if (tintRaw) {
                  const m = tintRaw.match(/^#?([0-9a-fA-F]{6})$/);
                  if (m) {
                    try { tintParsed = parseInt(m[1], 16); } catch (_) { tintParsed = null; }
                  }
                }
                // convert designer preview coords -> layout coords -> target coords
                const itemXInLayout = ((it.x || 0) - offsetPreviewX) / (scalePreview || 1);
                const itemYInLayout = ((it.y || 0) - offsetPreviewY) / (scalePreview || 1);
                // Item w/h are stored in Designer preview pixels; convert through layout coords.
                const sizeScale = (scaleTarget || 1) / (scalePreview || 1);
                const scaledW = Math.max(1, iw * sizeScale * totalScale);
                const scaledH = Math.max(1, ih * sizeScale * totalScale);
                const baseX = offsetTargetX + itemXInLayout * scaleTarget;
                const baseY = offsetTargetY + itemYInLayout * scaleTarget;
                sprIt.width = scaledW;
                sprIt.height = scaledH;
                sprIt.anchor.set(0.5);
                sprIt.x = baseX + scaledW / 2;
                sprIt.y = baseY + scaledH / 2;
                sprIt.rotation = (totalRotationDeg * Math.PI) / 180;
                if (skewXRad !== 0 || skewYRad !== 0) {
                  try { sprIt.skew.set(skewXRad, skewYRad); } catch (_) { /* ignore */ }
                }
                if (tintParsed !== null) {
                  try { (sprIt as any).tint = tintParsed; } catch (_) { /* ignore */ }
                }
                // Deep dramatic drop shadow — draw a blurred black copy beneath the sprite
                try {
                  const sprShadow = new PIXI.Sprite(texIt);
                  sprShadow.width = scaledW;
                  sprShadow.height = scaledH;
                  sprShadow.anchor.set(0.5);
                  sprShadow.x = sprIt.x + 5;
                  sprShadow.y = sprIt.y + 10;
                  sprShadow.rotation = sprIt.rotation;
                  if (skewXRad !== 0 || skewYRad !== 0) {
                    try { sprShadow.skew.set(skewXRad, skewYRad); } catch (_) { /* ignore */ }
                  }
                  try { (sprShadow as any).tint = 0x000000; } catch (_) { /* ignore */ }
                  sprShadow.alpha = 0;
                  try { sprShadow.filters = [new PIXI.BlurFilter({ strength: 6, quality: 3 })]; } catch (_) { sprShadow.filters = []; }
                  try { (sprShadow as any).zIndex = sortedIdx * 2; } catch (_) { /* ignore */ }
                  try { (sprIt as any).zIndex = sortedIdx * 2 + 1; } catch (_) { /* ignore */ }
                  appInst.stage.addChild(sprShadow);
                  // Fade shadow in sync with the main sprite
                  const shadowFadeTick = () => {
                    sprShadow.alpha = sprIt.alpha * 0.55 * visualAlpha;
                  };
                  try { appInst.ticker.add(shadowFadeTick); } catch (_) { sprShadow.alpha = 0.55 * visualAlpha; }
                  // Clean up shadow ticker when main sprite fades in
                  const origFadeTickRemover = () => {
                    try { appInst.ticker.remove(shadowFadeTick); } catch (_) { /* ignore */ }
                  };
                  setTimeout(origFadeTickRemover, 1500);
                } catch (_) { /* shadow not critical */ }
                const transitionMsRaw = Number((it as any)?.properties?.stateTransitionMs);
                const transitionMs = Number.isFinite(transitionMsRaw) && transitionMsRaw > 0
                  ? Math.min(1200, Math.max(80, Math.floor(transitionMsRaw)))
                  : 180;
                const fadeStart = performance.now();
                sprIt.alpha = 0;
                const fadeTick = () => {
                  const t = Math.max(0, Math.min(1, (performance.now() - fadeStart) / transitionMs));
                  sprIt.alpha = visualAlpha * t;
                  if (t >= 1) {
                    try { appInst.ticker.remove(fadeTick); } catch (_) { /* ignore */ }
                  }
                };
                try { appInst.ticker.add(fadeTick); } catch (_) { sprIt.alpha = 1; }
                // use sorted index so Designer ordering is preserved
                try { (sprIt as any).zIndex = sortedIdx; } catch (_) { /* ignore */ }

                // Player UX: allow clicking the item itself to trigger the hotspot that covers it.
                // (Designer mode keeps item sprites non-interactive.)
                if (!isEditor) {
                  try {
                    (sprIt as any).eventMode = 'static';
                    (sprIt as any).cursor = 'pointer';
                    sprIt.on('pointertap', async (event: any) => {
                      const hsRaw = hotspotsRef.current || [];
                      const hsList = normalizeHotspotsToLayout(hsRaw as any[], itemLayoutW, itemLayoutH);

                      const gx = (event && (event.global?.x ?? event.data?.global?.x)) as number | undefined;
                      const gy = (event && (event.global?.y ?? event.data?.global?.y)) as number | undefined;
                      const lx = (typeof gx === 'number') ? ((gx - offsetTargetX) / (scaleTarget || 1)) : null;
                      const ly = (typeof gy === 'number') ? ((gy - offsetTargetY) / (scaleTarget || 1)) : null;

                      // Fall back to the item center in layout coords if we couldn't read event coords.
                      const iwInLayout = (iw * visualScale) / (scalePreview || 1);
                      const ihInLayout = (ih * visualScale) / (scalePreview || 1);
                      const cx = itemXInLayout + iwInLayout / 2;
                      const cy = itemYInLayout + ihInLayout / 2;
                      const px = (lx == null ? cx : lx);
                      const py = (ly == null ? cy : ly);

                      const hit = (hsList as any[]).find((hs) => px >= hs.x && px <= hs.x + hs.w && py >= hs.y && py <= hs.y + hs.h);
                      if (!hit) return;
                      const fn = onHotspotActionRef.current;
                      if (typeof fn === 'function') await fn(hit.id);
                    });
                  } catch (_) {
                    // ignore
                  }
                }
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
      }
      else {
        // fallback visible background so canvas isn't empty
        const bg = new PIXI.Graphics();
        const layoutW = layout.width || 800;
        const layoutH = layout.height || 600;
        const targetW = renderer.width || (rendererCanvas && rendererCanvas.width) || 0;
        const targetH = renderer.height || (rendererCanvas && rendererCanvas.height) || 0;
        bg.beginFill(0xf3f4f6, 1);
        bg.drawRect(0, 0, Math.max(1, targetW), Math.max(1, targetH));
        bg.endFill();
        appInst.stage.addChild(bg);
      }

      // hotspots (now container-based for smooth dragging)
      // ensure stage supports zIndex sorting so hotspots with high zIndex sit above items
      try { appInst.stage.sortableChildren = true; } catch (_) { /* ignore */ }
      const { w: effLayoutW, h: effLayoutH } = resolveLayoutSize();
      const hsNorm = normalizeHotspotsToLayout(hotspotsRef.current || [], effLayoutW, effLayoutH);
      for (const hs of hsNorm || []) {
        const layoutW = effLayoutW;
        const layoutH = effLayoutH;
        const targetW = renderer.width || (rendererCanvas && rendererCanvas.width) || 0;
        const targetH = renderer.height || (rendererCanvas && rendererCanvas.height) || 0;
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
          // Pixi v8: use eventMode instead of interactive
          (hdl as any).eventMode = 'static';
          (hdl as any).cursor = cursor;
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
        // Pixi v8: use eventMode instead of interactive
        (c as any).eventMode = 'static';
        (c as any).cursor = 'pointer';
        try { (c as any).hitArea = new PIXI.Rectangle(0, 0, currW, currH); } catch (_) { /* ignore */ }
        // ensure hotspots render above scene items so they receive pointer events
        try { (c as any).zIndex = 99999; } catch (_) { /* ignore */ }

        // drag/resize state
        (c as any)._dragData = null;
        (c as any)._dragOffset = { x: 0, y: 0 };
        (c as any)._dragging = false;
        (c as any)._downPos = { x: 0, y: 0 };
        (c as any)._downTime = 0;
        (c as any)._resizing = null as null | { handle: 'nw' | 'ne' | 'sw' | 'se'; data: any; start: { x: number; y: number; w: number; h: number; px: number; py: number } };

        if (isEditor) {
          c.on("pointerover", () => { outline.alpha = 1.0; hNW.visible = hNE.visible = hSW.visible = hSE.visible = true; });
          c.on("pointerout", () => { if (!(c as any)._dragging && !(c as any)._resizing) { outline.alpha = 0.0; hNW.visible = hNE.visible = hSW.visible = hSE.visible = false; } });
        } else {
          outline.alpha = 0.0;
          hNW.visible = hNE.visible = hSW.visible = hSE.visible = false;
        }

        if (isEditor) {
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
        } else {
          // Player mode: treat the hotspot as a click target.
          c.on("pointertap", async () => {
            try {
              const fn = onHotspotActionRef.current;
              if (typeof fn === 'function') await fn(hs.id);
            } catch (e) {
              console.error('Hotspot action error', e);
            }
          });
        }

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
              try { (c as any).hitArea = new PIXI.Rectangle(0, 0, currW, currH); } catch (_) { /* ignore */ }
              try {
                (appInst as any).renderer.render(appInst.stage);
              } catch (err) {
                try {
                  const rendererName = (appInst as any)?.renderer?.constructor?.name || '';
                  const isWebGL = /webgl/i.test(String(rendererName));
                  if (isWebGL && !requestedCanvasFallback && !isStale()) {
                    console.info('[PixiRoom] switching to Canvas renderer due to WebGL render failure');
                    requestedCanvasFallback = true;
                    setRuntimeForceCanvas(true);
                  }
                } catch (_) { /* ignore */ }
              }
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
              try { (c as any).hitArea = new PIXI.Rectangle(0, 0, currW, currH); } catch (_) { /* ignore */ }
              try {
                (appInst as any).renderer.render(appInst.stage);
              } catch (err) {
                try {
                  const rendererName = (appInst as any)?.renderer?.constructor?.name || '';
                  const isWebGL = /webgl/i.test(String(rendererName));
                  if (isWebGL && !requestedCanvasFallback && !isStale()) {
                    console.info('[PixiRoom] switching to Canvas renderer due to WebGL render failure');
                    requestedCanvasFallback = true;
                    setRuntimeForceCanvas(true);
                  }
                } catch (_) { /* ignore */ }
              }
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
              try {
                const fn = onHotspotActionRef.current;
                if (typeof fn === 'function') await fn(hs.id);
              } catch (e) {
                console.error('Hotspot action error', e);
              }
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
        if (isEditor) {
          c.on("pointerup", finishDragOrResize);
          c.on("pointerupoutside", finishDragOrResize);
        }

        // handle pointerdown for each handle
        const startResize = (handleName: 'nw' | 'ne' | 'sw' | 'se') => (event: any) => {
          (c as any)._resizing = {
            handle: handleName,
            data: event.data,
            start: { x: c.x, y: c.y, w: currW, h: currH, px: event.data.getLocalPosition(appInst.stage).x, py: event.data.getLocalPosition(appInst.stage).y }
          };
        };
        if (isEditor) {
          hNW.on('pointerdown', startResize('nw'));
          hNE.on('pointerdown', startResize('ne'));
          hSW.on('pointerdown', startResize('sw'));
          hSE.on('pointerdown', startResize('se'));
        }

        // hide handles by default until hover
        hNW.visible = hNE.visible = hSW.visible = hSE.visible = false;

        appInst.stage.addChild(c);
      }

      // DOM overlay removed; rely on PIXI rendering

      // Render on-demand so we can catch renderer errors (some WebGL stacks crash inside PIXI shader logging).
      if (skipPixiRendering) return;
      try {
        (appInst as any).renderer.render(appInst.stage);
      } catch (err) {
        console.error('[PixiRoom] renderer.render failed', err);
        // If WebGL blows up, re-init with Canvas renderer.
        try {
          const rendererName = (appInst as any)?.renderer?.constructor?.name || '';
          const isWebGL = /webgl/i.test(String(rendererName));
          if (isWebGL && !requestedCanvasFallback && !isStale()) {
            console.info('[PixiRoom] switching to Canvas renderer due to WebGL render failure');
            requestedCanvasFallback = true;
            skipPixiRendering = true;
            // Immediately show something (Canvas2D) instead of waiting for React to re-init.
            enablePureCanvasFallback('webgl render failure');
            setRuntimeForceCanvas(true);
          }
        } catch (_) {
          /* ignore */
        }
      }
        } catch (err) {
          console.error('[PixiRoom] draw() threw (caught)', err);
          // If this was triggered by WebGL/Pixi internals, try switching to the pure Canvas2D path.
          try {
            const appInst = appRef.current as any;
            const rendererName = appInst?.renderer?.constructor?.name || '';
            const isWebGL = /webgl/i.test(String(rendererName));
            if (isWebGL && !requestedCanvasFallback && !isStale()) {
              console.info('[PixiRoom] switching to Canvas renderer due to draw() exception');
              requestedCanvasFallback = true;
              enablePureCanvasFallback('draw() exception');
              setRuntimeForceCanvas(true);
            }
          } catch (_) {
            /* ignore */
          }
        }
    };

    try { draw(); } catch (err) { console.error('[PixiRoom] draw() failed', err); }

    // Diagnostic pixel reads removed: extract.canvas can allocate huge buffers and break WebGL contexts.

    const resizeObserver = new ResizeObserver(() => {
      // Ensure renderer/canvases match container size then redraw.
      // IMPORTANT: player mode skips PIXI entirely, so we must resize the base canvas too.
      const appInst = appRef.current as any;
      const cw = containerRef.current?.clientWidth || 0;
      const ch = containerRef.current?.clientHeight || 0;
      const dprLocal = window.devicePixelRatio || 1;

      if (cw > 0 && ch > 0) {
        // Resize the base canvas (PIXI view or pure-canvas target).
        try {
          const baseCanvas = createdCanvasRef.current || createdCanvasLocal;
          if (baseCanvas) {
            baseCanvas.width = Math.max(1, Math.floor(cw * dprLocal));
            baseCanvas.height = Math.max(1, Math.floor(ch * dprLocal));
            baseCanvas.style.width = cw + 'px';
            baseCanvas.style.height = ch + 'px';
          }
        } catch (_) { /* ignore */ }

        // Resize PIXI renderer when present.
        if (appInst?.renderer) {
          try {
            appInst.renderer.resize(cw, ch);
          } catch (_) { /* ignore */ }
        }

        // Resize overlay backing store size when present.
        try {
          const ov = createdOverlayRef.current;
          if (ov) {
            ov.width = Math.max(1, Math.floor(cw * dprLocal));
            ov.height = Math.max(1, Math.floor(ch * dprLocal));
            ov.style.width = cw + 'px';
            ov.style.height = ch + 'px';
            // ensure overlay remains the last child (on top)
            try { if (ov.parentNode) ov.parentNode.appendChild(ov); } catch (_) { /* ignore */ }
          }
        } catch (_) { /* ignore */ }
      }

      try { draw(); } catch (err) { console.error('[PixiRoom] draw() failed during resize', err); }
    });
    if (containerRef.current) resizeObserver.observe(containerRef.current);

        cleanup = () => {
          try {
            resizeObserver.disconnect();
          } catch (err) {
            console.error('[PixiRoom] resizeObserver.disconnect failed', err);
          }
          // Pause & clean up cached video elements
          try {
            for (const [, vid] of videoElementCache) {
              try { vid.pause(); vid.src = ''; vid.load(); } catch (_) { /* ignore */ }
            }
            videoElementCache.clear();
            videoTextureCache.clear();
          } catch (_) { /* ignore */ }
          try {
            // Stop/destroy PIXI app first (important for React StrictMode which mounts/unmounts twice in dev).
            // If we leave the ticker running, it can continue rendering to a detached canvas and spam WebGL errors.
            try {
              const appInst = appRef.current as any;
              if (appInst) {
                try { appInst.ticker?.stop?.(); } catch (_) { /* ignore */ }
                try { appInst.stop?.(); } catch (_) { /* ignore */ }
                try { appInst.stage?.removeChildren?.(); } catch (_) { /* ignore */ }
                try {
                  // Pixi v7 signature: destroy(removeView, stageOptions)
                  appInst.destroy?.(true, { children: true } as any);
                } catch (_) {
                  // Pixi v8 signature: destroy(options)
                  try { appInst.destroy?.({ removeView: true, children: true } as any); } catch (_) { /* ignore */ }
                }
              }
            } catch (_) { /* ignore */ }

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
                  try {
                    if (typeof overlayPointerHandler === 'function') {
                      try { ov.removeEventListener('pointerdown', overlayPointerHandler); } catch (_) { /* ignore */ }
                      try {
                        const tgt = overlayPointerTarget;
                        if (tgt && tgt !== ov) tgt.removeEventListener('pointerdown', overlayPointerHandler);
                      } catch (_) { /* ignore */ }
                    }
                  } catch (_) { /* ignore */ }
                if (ov.parentNode) {
                  try { ov.parentNode.removeChild(ov); } catch (_) { /* ignore */ }
                }
              }
            } catch (_) { /* ignore */ }
            createdOverlayRef.current = null;
          } catch (err) {
            console.error('[PixiRoom] minimal cleanup failed', err);
          }
          // Do not clear container.innerHTML here; StrictMode/HMR can run effects concurrently and
          // nuking the container can remove the *new* instance's canvas.
        };
      } catch (err) {
        console.error('[PixiRoom] useEffect top-level error', err);
      }
    })();

    return () => {
      cancelled = true;
      try {
        cleanup?.();
      } catch (err) {
        console.error('[PixiRoom] cleanup wrapper failed', err);
      }
    };
  }, [layoutKey, layoutBg, layoutW, layoutH, layoutItemsSignature, puzzleId, runtimeForceCanvas]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 300 }} />
  );
}
