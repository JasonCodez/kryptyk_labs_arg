// Web Audio sound engine for UI feedback — every cue is synthesized on the fly
// (oscillators + gain envelopes), so there are zero audio assets to load and the
// first sound plays with no network latency. Swap individual cues for recorded
// assets later by replacing the builder for that cue name.

import { isSoundEnabled } from "./prefs";

export type SoundCue =
  | "tap"      // soft click — any button/tile press
  | "tick"     // wooden tick — toggles, steppers, dial detents
  | "pop"      // satisfying pop — card flip, item added, chip select
  | "whoosh"   // paper shuffle / panel slide — menus, drawers, page transitions
  | "success"  // magical sparkle — correct answer, clue solved
  | "error"    // gentle low thud — incorrect answer (never punishing)
  | "unlock"   // lock opening — new chapter/evidence unlocked
  | "reward";  // reward chime fanfare — XP, coins, level complete

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function getContext(): { ctx: AudioContext; master: GainNode } | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.40; // keep UI sounds well under content audio
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return master ? { ctx, master } : null;
}

/** One enveloped oscillator note. Frequencies may glide start → end. */
function note(
  ac: AudioContext,
  out: GainNode,
  opts: {
    type?: OscillatorType;
    freq: number;
    freqEnd?: number;
    at?: number;       // seconds from now
    duration: number;  // seconds
    peak?: number;     // 0..1 relative volume
  },
) {
  const t0 = ac.currentTime + (opts.at ?? 0);
  const t1 = t0 + opts.duration;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.freq, t0);
  if (opts.freqEnd) osc.frequency.exponentialRampToValueAtTime(opts.freqEnd, t1);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(opts.peak ?? 0.5, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t1);
  osc.connect(gain).connect(out);
  osc.start(t0);
  osc.stop(t1 + 0.02);
}

/** Short burst of band-passed noise — the basis of whooshes and shuffles. */
function noiseSweep(
  ac: AudioContext,
  out: GainNode,
  opts: { duration: number; from: number; to: number; peak?: number },
) {
  const t0 = ac.currentTime;
  const t1 = t0 + opts.duration;
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * opts.duration), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(opts.from, t0);
  filter.frequency.exponentialRampToValueAtTime(opts.to, t1);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(opts.peak ?? 0.3, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t1);
  src.connect(filter).connect(gain).connect(out);
  src.start(t0);
  src.stop(t1 + 0.02);
}

const cues: Record<SoundCue, (ac: AudioContext, out: GainNode) => void> = {
  tap: (ac, out) => {
    note(ac, out, { type: "sine", freq: 950, freqEnd: 620, duration: 0.055, peak: 0.35 });
  },
  tick: (ac, out) => {
    note(ac, out, { type: "triangle", freq: 1350, freqEnd: 1100, duration: 0.035, peak: 0.3 });
  },
  pop: (ac, out) => {
    note(ac, out, { type: "sine", freq: 320, freqEnd: 640, duration: 0.09, peak: 0.5 });
  },
  whoosh: (ac, out) => {
    noiseSweep(ac, out, { duration: 0.22, from: 400, to: 2400, peak: 0.25 });
  },
  success: (ac, out) => {
    // Rising major triad — bright but brief, leaves room for the reward fanfare later
    note(ac, out, { type: "triangle", freq: 1046.5, at: 0.0, duration: 0.14, peak: 0.4 });  // C6
    note(ac, out, { type: "triangle", freq: 1318.5, at: 0.07, duration: 0.14, peak: 0.4 }); // E6
    note(ac, out, { type: "triangle", freq: 1568.0, at: 0.14, duration: 0.22, peak: 0.45 }); // G6
    note(ac, out, { type: "sine", freq: 3136.0, at: 0.14, duration: 0.22, peak: 0.12 });    // shimmer
  },
  error: (ac, out) => {
    // Soft descending thud — communicates "not quite" without stinging
    note(ac, out, { type: "sine", freq: 220, freqEnd: 130, duration: 0.16, peak: 0.45 });
    note(ac, out, { type: "sine", freq: 165, freqEnd: 110, at: 0.09, duration: 0.16, peak: 0.3 });
  },
  unlock: (ac, out) => {
    note(ac, out, { type: "square", freq: 480, duration: 0.03, peak: 0.18 });               // mechanism click
    note(ac, out, { type: "triangle", freq: 660, freqEnd: 1320, at: 0.08, duration: 0.2, peak: 0.4 }); // swing open
  },
  reward: (ac, out) => {
    // Four-note fanfare with a sparkle tail — the "you earned this" moment
    note(ac, out, { type: "triangle", freq: 523.25, at: 0.0, duration: 0.16, peak: 0.45 });  // C5
    note(ac, out, { type: "triangle", freq: 659.25, at: 0.1, duration: 0.16, peak: 0.45 });  // E5
    note(ac, out, { type: "triangle", freq: 783.99, at: 0.2, duration: 0.16, peak: 0.45 });  // G5
    note(ac, out, { type: "triangle", freq: 1046.5, at: 0.3, duration: 0.4, peak: 0.5 });    // C6
    note(ac, out, { type: "sine", freq: 2093.0, at: 0.3, duration: 0.45, peak: 0.15 });      // octave shimmer
    note(ac, out, { type: "sine", freq: 3135.96, at: 0.38, duration: 0.4, peak: 0.08 });     // sparkle
  },
};

/** Play a named UI sound. No-ops server-side or when the user has sound off. */
export function playSound(cue: SoundCue) {
  if (!isSoundEnabled()) return;
  const audio = getContext();
  if (!audio) return;
  try {
    cues[cue](audio.ctx, audio.master);
  } catch {
    // Audio failures must never break the interaction they decorate
  }
}
