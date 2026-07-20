"use client";

import { useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence, type Variants, useReducedMotion } from "framer-motion";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

export interface WordDefinitionData {
  phonetic: string | null;
  audioUrl: string | null;
  partOfSpeech: string | null;
  definition: string;
  example: string | null;
}

export interface WordDefinitionModalProps {
  word: string;
  color: { bg: string; border: string; text: string };
  status: "loading" | "found" | "not-found";
  data?: WordDefinitionData;
  onDismiss: () => void;
}

function merriamWebsterUrl(word: string): string {
  return `https://www.merriam-webster.com/dictionary/${encodeURIComponent(word.toLowerCase())}`;
}

function IconCheck() {
  return (
    <svg width={12} height={12} viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path d="M3 8.5 6.5 12 13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function IconSpeaker() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" />
      <path d="M16.3 8.5a5 5 0 0 1 0 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M19 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity=".6" />
    </svg>
  );
}

function IconExternalLink() {
  return (
    <svg width={12} height={12} viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path d="M6.5 3H3v10h10V9.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 3h4v4M13 3 7 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Spells the found word out as grid-style letter tiles — the same visual language as the
// puzzle board itself — instead of plain text, so the modal reads as a direct continuation
// of the find rather than a generic dialog bolted on top of it. The row never wraps (a single
// orphaned letter dropping to its own line would look broken); instead each tile is a flex
// item with a capped basis that shrinks — together with a per-tile container-query font size —
// as more letters compete for the same row, so short words stay comfortably large while very
// long ones scale down smoothly without ever truncating a letter or scrolling horizontally.
function LetterTiles({ word, reduceMotion }: { word: string; reduceMotion: boolean }) {
  const letters = word.toUpperCase().split("");
  return (
    <div className="word-definition-tiles" data-tile-layout="single-row">
      {letters.map((ch, i) => (
        <motion.span
          key={i}
          className="word-definition-tile"
          initial={reduceMotion ? false : { opacity: 0, y: -6, scale: 0.88 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={reduceMotion ? { duration: 0 } : { delay: Math.min(i * 0.02, 0.3), duration: 0.22, ease: "easeOut" }}
        >
          {ch}
        </motion.span>
      ))}
    </div>
  );
}

export default function WordDefinitionModal({ word, color, status, data, onDismiss }: WordDefinitionModalProps) {
  useBodyScrollLock();
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const reduceMotion = Boolean(useReducedMotion());

  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => dialogRef.current?.focus());
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onDismiss(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])'));
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
      if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("keydown", handleKey); returnFocusRef.current?.focus(); };
  }, [onDismiss]);

  const playPronunciation = useCallback(() => {
    if (!data?.audioUrl) return;
    try {
      const clip = new Audio(data.audioUrl);
      clip.volume = 0.7;
      void clip.play().catch(() => {});
    } catch {}
  }, [data]);

  const containerVariants: Variants = reduceMotion
    ? { hidden: {}, show: {} }
    : { hidden: {}, show: { transition: { staggerChildren: 0.045, delayChildren: 0.04 } } };
  const itemVariants: Variants = reduceMotion
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.24, ease: "easeOut" } } };

  const statusText = status === "loading"
    ? `Loading definition for ${word}`
    : status === "found"
      ? `Definition loaded for ${word}`
      : `No quick definition found for ${word}`;

  return (
    <AnimatePresence>
      <motion.div
        key="word-def-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="word-definition-layer"
        onClick={onDismiss}
      >
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={`${word} definition`}
          aria-busy={status === "loading"}
          data-definition-status={status}
          tabIndex={-1}
          key="word-def-card"
          initial={reduceMotion ? false : { scale: 0.94, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { scale: 0.94, opacity: 0, y: 10 }}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 280, damping: 26 }}
          className="word-definition-card"
          style={{
            "--word-definition-bg": color.bg,
            "--word-definition-border": color.border,
            "--word-definition-text": color.text,
          } as React.CSSProperties}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="word-definition-glow" aria-hidden="true" />
          <div className="word-definition-texture" aria-hidden="true" />
          <div className="word-definition-highlight" aria-hidden="true" />

          <button type="button" onClick={onDismiss} aria-label="Close" className="word-definition-close">
            <IconClose />
          </button>

          <p className="sr-only" aria-live="polite">{statusText}</p>

          <motion.div variants={containerVariants} initial="hidden" animate="show" className="word-definition-content">
            <motion.div variants={itemVariants} className="word-definition-badge">
              <IconCheck />
              <span>Word found</span>
            </motion.div>

            <motion.div variants={itemVariants}>
              <LetterTiles word={word} reduceMotion={reduceMotion} />
            </motion.div>

            {status === "loading" && (
              <div className="word-definition-loading" aria-hidden="true">
                <span className="word-definition-skeleton" style={{ width: "38%" }} />
                <span className="word-definition-skeleton" style={{ width: "92%" }} />
                <span className="word-definition-skeleton" style={{ width: "80%" }} />
                <span className="word-definition-skeleton" style={{ width: "62%" }} />
              </div>
            )}

            {status === "not-found" && (
              <motion.p variants={itemVariants} className="word-definition-fallback">
                A quick definition was not available for this word.
              </motion.p>
            )}

            {status === "found" && data && (
              <>
                {data.audioUrl && (
                  // Raw IPA transcription (e.g. "/ˈæs.ɪd/") is unfamiliar notation to anyone who
                  // doesn't read phonetic alphabet, so the audio button remains the only
                  // pronunciation aid shown.
                  <motion.button
                    variants={itemVariants}
                    type="button"
                    onClick={playPronunciation}
                    className="word-definition-pronunciation"
                    aria-label={`Hear pronunciation for ${word}`}
                  >
                    <IconSpeaker />
                    <span>Hear pronunciation</span>
                  </motion.button>
                )}

                {data.partOfSpeech && (
                  <motion.p variants={itemVariants} className="word-definition-part">
                    {data.partOfSpeech}
                  </motion.p>
                )}

                <motion.p variants={itemVariants} className="word-definition-copy">
                  {data.definition}
                </motion.p>

                {data.example && (
                  <motion.div variants={itemVariants} className="word-definition-example">
                    <span className="word-definition-example-label">Example</span>
                    <p>{data.example}</p>
                  </motion.div>
                )}
              </>
            )}

            {(status === "found" || status === "not-found") && (
              <motion.a
                variants={itemVariants}
                href={merriamWebsterUrl(word)}
                target="_blank"
                rel="noopener noreferrer"
                className="word-definition-source"
                aria-label={`View full definition for ${word} on Merriam-Webster, opens in a new tab`}
              >
                <span>View full definition</span>
                <IconExternalLink />
              </motion.a>
            )}

            <motion.button
              variants={itemVariants}
              type="button"
              onClick={onDismiss}
              disabled={status === "loading"}
              className="word-definition-action"
            >
              <span>Keep searching</span>
              <IconArrowRight />
            </motion.button>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
