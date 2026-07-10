'use client';

import { useEffect, useRef, useMemo, useState } from 'react';

type DetectiveCasePrologue = {
  text: string;
  narratorName?: string;
  narratorVoice?: string;
  backgroundImage?: string;
  backgroundVideo?: string;
  audio?: string;
  audioLoop?: boolean;
};

type DetectiveCaseState = {
  puzzleId: string;
  noirTitle: string;
  intro: string | null;
  prologue: DetectiveCasePrologue | null;
  totalStages: number;
  solved: boolean;
  locked: boolean;
  lockedReason: string | null;
  currentStageIndex: number;
  stage: null | { id: string; title: string; prompt: string; kind: 'text' };
};

export default function DetectiveCasePuzzle({ puzzleId }: { puzzleId: string }) {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<DetectiveCaseState | null>(null);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [prologueRead, setPrologueRead] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stageLabel = useMemo(() => {
    if (!state) return '';
    const stageNum = Math.min(state.currentStageIndex + 1, state.totalStages);
    return `Stage ${stageNum} of ${state.totalStages}`;
  }, [state]);

  async function loadState() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/puzzles/${puzzleId}/detective/state`, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError((data && (data.error as string)) || 'Failed to load case');
        setState(null);
        return;
      }
      setState(data);
    } catch {
      setError('Failed to load case');
      setState(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzleId]);

  // Auto-attempt audio playback when prologue is shown
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.play().then(() => {
      setAudioPlaying(true);
      setAudioBlocked(false);
    }).catch(() => {
      setAudioBlocked(true);
      setAudioPlaying(false);
    });
  }, [state?.prologue?.audio, prologueRead]);

  function toggleAudio() {
    const el = audioRef.current;
    if (!el) return;
    if (audioPlaying) {
      el.pause();
      setAudioPlaying(false);
    } else {
      el.play().then(() => {
        setAudioPlaying(true);
        setAudioBlocked(false);
      }).catch(() => setAudioBlocked(true));
    }
  }

  async function submitStage() {
    if (!state?.stage) return;
    if (state.locked) return;
    if (state.solved) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/puzzles/${puzzleId}/detective/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId: state.stage.id, answer }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = (data && (data.error as string)) || 'Submission failed';
        setError(msg);
        await loadState();
        return;
      }

      if (data && data.correct === false) {
        setError('Incorrect. Case locked — no retry.');
        await loadState();
        return;
      }

      setAnswer('');
      await loadState();
    } catch {
      setError('Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-black/50 p-6">
        <div className="text-yellow-200">Loading case…</div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-black/50 p-6">
        <div className="text-red-300">
          {error || 'Unable to load detective case.'}
          {error && error.toLowerCase().includes('not configured') ? (
            <div className="mt-2 text-zinc-300 text-sm">
              This puzzle is marked as <span className="text-zinc-100 font-semibold">detective_case</span> but has no
              <span className="text-zinc-100 font-semibold"> puzzleData.detectiveCase</span> stages. Ask an admin to add the case JSON
              in the puzzle creator.
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // ── Prologue screen ─────────────────────────────────────────────────────────
  if (state.prologue && !prologueRead && !state.locked && !state.solved) {
    const { text, narratorName, narratorVoice, backgroundImage, backgroundVideo, audio, audioLoop } = state.prologue;

    return (
      <div
        className="relative rounded-xl overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse at 60% 0%, #1a1209 0%, #0a0a0a 60%, #000 100%)',
          border: '1px solid rgba(234,179,8,0.15)',
          minHeight: '480px',
        }}
      >
        {/* ── Background video layer (muted autoplay loop) ── */}
        {backgroundVideo && (
          <video
            autoPlay
            muted
            loop
            playsInline
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', zIndex: 0, opacity: 0.25,
            }}
          >
            <source src={backgroundVideo} />
          </video>
        )}

        {/* ── Background image layer (only if no video) ── */}
        {!backgroundVideo && backgroundImage && (
          <div
            style={{
              position: 'absolute', inset: 0, zIndex: 0,
              backgroundImage: `url(${backgroundImage})`,
              backgroundSize: 'cover', backgroundPosition: 'center',
              opacity: 0.2,
            }}
          />
        )}

        {/* ── Dark gradient overlay for readability ── */}
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 1,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.75) 60%, rgba(0,0,0,0.92) 100%)',
          }}
        />

        {/* ── Audio element (hidden) ── */}
        {audio && (
          <audio ref={audioRef} src={audio} loop={audioLoop ?? false} />
        )}

        {/* ── Audio control (top-right) ── */}
        {audio && (
          <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 10 }}>
            {audioBlocked && !audioPlaying ? (
              <button
                onClick={toggleAudio}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
                style={{
                  background: 'rgba(234,179,8,0.18)',
                  border: '1px solid rgba(234,179,8,0.4)',
                  color: '#fde68a',
                }}
              >
                ▶ Play audio
              </button>
            ) : (
              <button
                onClick={toggleAudio}
                title={audioPlaying ? 'Pause' : 'Play'}
                className="flex items-center justify-center w-8 h-8 rounded-full text-base transition-all"
                style={{
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid rgba(234,179,8,0.3)',
                  color: audioPlaying ? '#fde68a' : 'rgba(161,161,170,0.6)',
                }}
              >
                {audioPlaying ? '🔊' : '🔇'}
              </button>
            )}
          </div>
        )}

        {/* ── Main content ── */}
        <div className="relative flex flex-col items-center px-8 pt-10 pb-8 text-center" style={{ zIndex: 2 }}>
          {/* Series badge */}
          <div
            className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-black tracking-[0.2em] uppercase"
            style={{ background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.3)', color: '#eab308' }}
          >
            <span style={{ fontSize: '0.6rem' }}>◆</span>
            WISE UP
            <span style={{ fontSize: '0.6rem' }}>◆</span>
          </div>

          {/* Case title */}
          <div className="text-white text-2xl font-bold tracking-wide mb-1" style={{ textShadow: '0 2px 20px rgba(234,179,8,0.25)' }}>
            {state.noirTitle}
          </div>

          {/* Decorative rule */}
          <div className="my-6 flex items-center gap-3 w-full max-w-xs">
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(234,179,8,0.4))' }} />
            <div className="text-yellow-600 text-xs">✦</div>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, rgba(234,179,8,0.4))' }} />
          </div>

          {/* Narrator name */}
          {narratorName && (
            <div className="mb-4 text-xs font-semibold tracking-widest uppercase" style={{ color: 'rgba(234,179,8,0.6)' }}>
              {narratorName}
              {narratorVoice ? <span className="ml-2 normal-case font-normal opacity-60">— {narratorVoice}</span> : null}
            </div>
          )}

          {/* Monologue */}
          <div
            className="max-w-md text-base leading-relaxed"
            style={{
              color: 'rgba(228,228,231,0.88)',
              fontStyle: 'italic',
              fontFamily: 'Georgia, "Times New Roman", serif',
              textShadow: '0 1px 6px rgba(0,0,0,0.9)',
            }}
          >
            {text.split('\n').map((line, i) => (
              <span key={i}>
                {line}
                {i < text.split('\n').length - 1 && <br />}
              </span>
            ))}
          </div>

          {/* Begin button */}
          <button
            onClick={() => {
              // Stop audio when moving past the prologue
              if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
              }
              setAudioPlaying(false);
              setPrologueRead(true);
            }}
            className="mt-10 group flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold tracking-wider uppercase transition-all duration-200"
            style={{
              background: 'rgba(234,179,8,0.15)',
              border: '1px solid rgba(234,179,8,0.4)',
              color: '#fde68a',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(234,179,8,0.25)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(234,179,8,0.7)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(234,179,8,0.15)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(234,179,8,0.4)';
            }}
          >
            Begin Investigation
            <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
          </button>

          <div className="mt-4 text-xs" style={{ color: 'rgba(161,161,170,0.5)' }}>
            {state.totalStages} stage{state.totalStages !== 1 ? 's' : ''} · one wrong answer locks the case
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-black/50 p-6">
        <div className="text-yellow-200">Loading case…</div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-black/50 p-6">
        <div className="text-red-300">
          {error || 'Unable to load detective case.'}
          {error && error.toLowerCase().includes('not configured') ? (
            <div className="mt-2 text-zinc-300 text-sm">
              This puzzle is marked as <span className="text-zinc-100 font-semibold">detective_case</span> but has no
              <span className="text-zinc-100 font-semibold"> puzzleData.detectiveCase</span> stages. Ask an admin to add the case JSON
              in the puzzle creator.
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // ── Prologue screen ─────────────────────────────────────────────────────────
  if (state.prologue && !prologueRead && !state.locked && !state.solved) {
    const { text, narratorName, narratorVoice } = state.prologue;
    return (
      <div
        className="relative rounded-xl overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse at 60% 0%, #1a1209 0%, #0a0a0a 60%, #000 100%)',
          border: '1px solid rgba(234,179,8,0.15)',
          minHeight: '480px',
        }}
      >
        {/* Grain texture overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")', backgroundSize: '200px 200px' }}
        />

        <div className="relative flex flex-col items-center px-8 pt-10 pb-8 text-center">
          {/* Series badge */}
          <div
            className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-black tracking-[0.2em] uppercase"
            style={{ background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.3)', color: '#eab308' }}
          >
            <span style={{ fontSize: '0.6rem' }}>◆</span>
            WISE UP
            <span style={{ fontSize: '0.6rem' }}>◆</span>
          </div>

          {/* Case title */}
          <div className="text-white text-2xl font-bold tracking-wide mb-1" style={{ textShadow: '0 2px 20px rgba(234,179,8,0.2)' }}>
            {state.noirTitle}
          </div>

          {/* Decorative rule */}
          <div className="my-6 flex items-center gap-3 w-full max-w-xs">
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(234,179,8,0.4))' }} />
            <div className="text-yellow-600 text-xs">✦</div>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, rgba(234,179,8,0.4))' }} />
          </div>

          {/* Narrator name */}
          {narratorName && (
            <div className="mb-4 text-xs font-semibold tracking-widest uppercase" style={{ color: 'rgba(234,179,8,0.6)' }}>
              {narratorName}
              {narratorVoice ? <span className="ml-2 normal-case font-normal opacity-60">— {narratorVoice}</span> : null}
            </div>
          )}

          {/* Monologue text */}
          <div
            className="max-w-md text-base leading-relaxed"
            style={{
              color: 'rgba(228,228,231,0.85)',
              fontStyle: 'italic',
              fontFamily: 'Georgia, "Times New Roman", serif',
              textShadow: '0 1px 4px rgba(0,0,0,0.8)',
            }}
          >
            {text.split('\n').map((line, i) => (
              <span key={i}>
                {line}
                {i < text.split('\n').length - 1 && <br />}
              </span>
            ))}
          </div>

          {/* Begin button */}
          <button
            onClick={() => setPrologueRead(true)}
            className="mt-10 group flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold tracking-wider uppercase transition-all duration-200"
            style={{
              background: 'rgba(234,179,8,0.15)',
              border: '1px solid rgba(234,179,8,0.4)',
              color: '#fde68a',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(234,179,8,0.25)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(234,179,8,0.7)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(234,179,8,0.15)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(234,179,8,0.4)';
            }}
          >
            Begin Investigation
            <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
          </button>

          {/* Stage count hint */}
          <div className="mt-4 text-xs" style={{ color: 'rgba(161,161,170,0.5)' }}>
            {state.totalStages} stage{state.totalStages !== 1 ? 's' : ''} · one wrong answer locks the case
          </div>
        </div>
      </div>
    );
  }

  if (state.locked) {
    return (
      <div className="rounded-xl border border-red-900/60 bg-black/50 p-6">
        <div className="text-red-200 text-xl font-semibold">Case Closed</div>
        <div className="mt-2 text-zinc-300">You made a wrong call. This case is locked forever.</div>
      </div>
    );
  }

  if (state.solved) {
    return (
      <div className="rounded-xl border border-emerald-900/60 bg-black/50 p-6">
        <div className="text-emerald-200 text-xl font-semibold">Case Solved</div>
        <div className="mt-2 text-zinc-300">The city exhales. Another secret buried.</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-black/50 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-black tracking-widest uppercase" style={{ color: 'rgba(234,179,8,0.6)' }}>Wise Up</span>
            <span className="text-zinc-700">·</span>
          </div>
          <div className="text-yellow-200 text-2xl font-semibold tracking-wide">{state.noirTitle}</div>
          <div className="mt-1 text-zinc-400 text-sm">{stageLabel}</div>
        </div>
        <div className="text-zinc-500 text-xs">No retries</div>
      </div>

      {state.intro ? <div className="mt-4 text-zinc-300 italic">{state.intro}</div> : null}

      {state.stage ? (
        <div className="mt-6">
          <div className="text-zinc-200 text-lg font-semibold">{state.stage.title}</div>
          <div className="mt-2 whitespace-pre-wrap text-zinc-300">{state.stage.prompt}</div>

          <div className="mt-6">
            <label className="block text-sm text-zinc-400">Your answer</label>
            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-yellow-500/40"
              placeholder="Type the code phrase…"
              disabled={submitting}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />

            {error ? <div className="mt-3 text-sm text-red-300">{error}</div> : null}

            <button
              onClick={submitStage}
              disabled={submitting || !answer.trim()}
              className="mt-4 rounded-lg bg-yellow-500/20 px-4 py-2 text-yellow-200 border border-yellow-500/30 hover:bg-yellow-500/25 disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 text-zinc-400">No active stage.</div>
      )}
    </div>
  );
}
