'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

export type RoomIntro = {
  /** Direct video URL (mp4/webm) or YouTube watch/embed URL */
  videoUrl?: string;
  /** Optional poster image shown before the video plays (and used as a background card when there is no video) */
  posterUrl?: string;
  /** Optional separate voiceover audio track to play alongside the video / lore text */
  voiceoverUrl?: string;
  /** Headline displayed under / over the video */
  title?: string;
  /** Multi-paragraph lore / history text */
  bodyText?: string;
  /** Whether the skip button is shown at all (default true) */
  skipAllowed?: boolean;
  /** Seconds to wait before the skip button appears (default 5) */
  skipDelaySeconds?: number;
};

interface RoomIntroPlayerProps {
  intro: RoomIntro;
  onComplete: () => void;
  /** Override the skip/continue button label */
  completeLabel?: string;
}

const FADE_IN_MS = 400;
const FADE_OUT_MS = 700;

// ─── helpers ────────────────────────────────────────────────────────────────

function isYouTubeUrl(url: string): boolean {
  return url.includes('youtube.com') || url.includes('youtu.be');
}

function toYouTubeEmbedUrl(url: string): string {
  let id = '';
  try {
    if (url.includes('youtu.be/')) {
      id = url.split('youtu.be/')[1].split(/[?&]/)[0];
    } else if (url.includes('youtube.com/watch')) {
      id = new URL(url).searchParams.get('v') || '';
    } else if (url.includes('youtube.com/embed/')) {
      id = url.split('youtube.com/embed/')[1].split(/[?&]/)[0];
    }
  } catch {
    // fallback below
  }
  return id ? `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1` : url;
}

// ─── component ──────────────────────────────────────────────────────────────

/**
 * Fullscreen intro overlay that plays before the briefing/run start.
 *
 * Supports:
 *  - Direct video files (.mp4 / .webm) with native <video> autoplay
 *  - YouTube embed URLs (iframe with autoplay)
 *  - Poster image fallback when no video is present
 *  - Optional separate voiceover audio track
 *  - Timed skip button (appears after `skipDelaySeconds`)
 *  - Lore title + multi-paragraph body text
 */
export default function RoomIntroPlayer({ intro, onComplete, completeLabel }: RoomIntroPlayerProps) {
  const {
    videoUrl,
    posterUrl,
    voiceoverUrl,
    title,
    bodyText,
    skipAllowed = true,
    skipDelaySeconds = 5,
  } = intro;

  const [skipCountdown, setSkipCountdown] = useState<number>(
    skipAllowed && skipDelaySeconds > 0 ? skipDelaySeconds : 0
  );
  const [canSkip, setCanSkip] = useState(!skipAllowed || skipDelaySeconds <= 0);
  // fade-in on mount, fade-out before onComplete fires
  const [opacity, setOpacity] = useState(0);
  const [fading, setFading] = useState(false);
  // autoplay may be blocked by the browser (common on Safari) — track so we can show a play button
  const [videoBlocked, setVideoBlocked] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const voiceoverRef = useRef<HTMLAudioElement | null>(null);
  const hasCompletedRef = useRef(false);
  const fadeOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // — fade in on mount ———————————————————————————————————————————————————————
  useEffect(() => {
    // rAF ensures the initial opacity:0 has been painted before we animate to 1
    const raf = requestAnimationFrame(() => setOpacity(1));
    return () => cancelAnimationFrame(raf);
  }, []);

  // — autoplay: attempt programmatic play and surface a play button if blocked
  // (Safari requires a direct user gesture even after prior page interaction in some cases)
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.play().catch(() => setVideoBlocked(true));
  }, [videoUrl]);

  // — countdown ticker ————————————————————————————————————————————————————————
  useEffect(() => {
    if (!skipAllowed || skipDelaySeconds <= 0) return;
    if (skipCountdown <= 0) {
      setCanSkip(true);
      return;
    }
    const id = setInterval(() => {
      setSkipCountdown((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          setCanSkip(true);
          clearInterval(id);
        }
        return Math.max(0, next);
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // — voiceover ——————————————————————————————————————————————————————————————
  useEffect(() => {
    if (!voiceoverUrl) return;
    const audio = new Audio(voiceoverUrl);
    voiceoverRef.current = audio;
    audio.play().catch(() => {
      // autoplay may be blocked — silently ignore
    });
    return () => {
      audio.pause();
      voiceoverRef.current = null;
    };
  }, [voiceoverUrl]);

  // — skip / complete —————————————————————————————————————————————————————
  const handleComplete = useCallback(() => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    // Fade out, then call onComplete after the animation finishes
    setFading(true);
    setOpacity(0);
    fadeOutTimerRef.current = setTimeout(() => {
      // Stop voiceover after the visual transition
      if (voiceoverRef.current) {
        voiceoverRef.current.pause();
        voiceoverRef.current = null;
      }
      onComplete();
    }, FADE_OUT_MS);
  }, [onComplete]);

  useEffect(() => {
    return () => {
      if (fadeOutTimerRef.current) clearTimeout(fadeOutTimerRef.current);
    };
  }, []);

  const isYT = !!videoUrl && isYouTubeUrl(videoUrl);
  const hasPoster = !!posterUrl;
  const hasText = !!(title || bodyText);

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black overflow-y-auto"
      style={{
        backdropFilter: 'blur(4px)',
        opacity,
        transition: fading
          ? `opacity ${FADE_OUT_MS}ms cubic-bezier(0.4,0,0.2,1)`
          : `opacity ${FADE_IN_MS}ms ease-out`,
        pointerEvents: fading ? 'none' : undefined,
      }}
    >
      {/* Faint background overlay using poster if no video */}
      {!videoUrl && hasPoster && (
        <div
          className="absolute inset-0 opacity-10 bg-cover bg-center pointer-events-none"
          style={{ backgroundImage: `url(${posterUrl})` }}
        />
      )}

      <div className="relative w-full max-w-4xl mx-auto px-4 py-10 flex flex-col items-center gap-6">

        {/* ── Video block ──────────────────────────────────────────────── */}
        {videoUrl ? (
          isYT ? (
            <div className="w-full aspect-video rounded-xl overflow-hidden shadow-2xl">
              <iframe
                src={toYouTubeEmbedUrl(videoUrl)}
                className="w-full h-full"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                title={title || 'Room introduction'}
              />
            </div>
          ) : (
            <div className="relative w-full">
              <video
                ref={videoRef}
                className="w-full max-h-[62vh] rounded-xl shadow-2xl object-contain"
                src={videoUrl}
                poster={hasPoster ? posterUrl : undefined}
                autoPlay
                playsInline
                onPlay={() => setVideoBlocked(false)}
                onEnded={handleComplete}
              />
              {/* Play-button fallback shown when browser blocks autoplay */}
              {videoBlocked && (
                <button
                  type="button"
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50 rounded-xl"
                  onClick={() => {
                    videoRef.current?.play().catch(() => {});
                    setVideoBlocked(false);
                  }}
                  aria-label="Play video"
                >
                  <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur flex items-center justify-center shadow-xl">
                    <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                  <span className="text-white text-sm font-medium">Click to play</span>
                </button>
              )}
            </div>
          )
        ) : hasPoster ? (
          /* Poster-only mode */
          <div className="w-full max-w-2xl overflow-hidden rounded-xl shadow-2xl">
            <img
              src={posterUrl}
              alt={title || 'Room introduction'}
              className="w-full object-contain"
            />
          </div>
        ) : null}

        {/* ── Lore text block ──────────────────────────────────────────── */}
        {hasText && (
          <div className="max-w-2xl w-full text-center px-2">
            {title && (
              <h2 className="text-3xl font-bold text-white mb-4 tracking-wide drop-shadow-lg">
                {title}
              </h2>
            )}
            {bodyText && (
              <p className="text-gray-300 text-base leading-relaxed whitespace-pre-wrap">
                {bodyText}
              </p>
            )}
          </div>
        )}

        {/* ── Skip / Continue button ────────────────────────────────────── */}
        <div className="mt-2 flex flex-col items-center gap-2">
          {canSkip ? (
            <button
              type="button"
              onClick={handleComplete}
              className="px-8 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-semibold text-base transition-all shadow-lg"
            >
              {completeLabel ?? (videoUrl && !isYT ? 'Skip Intro' : 'Enter the Room')}
            </button>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <div className="text-gray-500 text-sm">
                {skipAllowed ? `Skip available in ${skipCountdown}s…` : 'Please watch the introduction…'}
              </div>
              {/* Progress bar */}
              {skipAllowed && skipDelaySeconds > 0 && (
                <div className="w-48 h-1 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all"
                    style={{
                      width: `${Math.max(0, Math.min(100, ((skipDelaySeconds - skipCountdown) / skipDelaySeconds) * 100))}%`,
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
