# Puzzle Warz Juice Guide

How to make every interaction feel rewarded. This is the playbook for rolling the
juice system out across screens — the kit lives in `src/lib/juice/` and
`src/components/juice/`, and the reference implementation is the puzzle solve flow
in `src/app/puzzles/[id]/page.tsx`.

## Philosophy

- Every tap is acknowledged (motion + sound + haptic) within one frame.
- Success creates anticipation for the next action; failure is soft, never punishing.
- Big-win effects (`celebrationEffects.tsx` fireworks/confetti) are the crescendo —
  micro-effects must stay modest so the crescendo still lands.
- Motion communicates purpose. If an animation doesn't tell the player something
  (pressed, correct, unlocked, earned), cut it.
- Reduced motion is sacred: every effect no-ops under the OS setting and the app's
  "Reduce Animations" toggle (`data-reduce-animations="true"` on `<html>`).

## Timing language

| Tier | Duration | Examples |
|---|---|---|
| Micro | 80–180 ms | press squash, ripple start, tick |
| Standard | 250–450 ms | error shake, pop-in, panel slide, card flip |
| Celebration | 600–1200 ms | reward fanfare, confetti, level-up |

Ease curves:

- **Overshoot settle** (signature): `cubic-bezier(0.34, 1.56, 0.64, 1)` — pop-ins, reveals
- **Soft decel**: `cubic-bezier(0.22, 1, 0.36, 1)` — ripples, particles, slides
- **Springs** (framer-motion): press `{ stiffness: 550, damping: 28 }`

## The kit

### Feedback combos — `import { juice } from "@/lib/juice"`

One call fires the matched sound + haptic pair. Never call `playSound`/`haptic`
separately in product code; the combos keep the feedback language consistent.

| Call | Sound | Haptic | Use for |
|---|---|---|---|
| `juice.tap()` | soft click | 8 ms | any button/tile press |
| `juice.tick()` | wooden tick | 8 ms | toggles, steppers, dial detents |
| `juice.pop()` | satisfying pop | 8 ms | card flip, chip select, item added |
| `juice.whoosh()` | paper shuffle | — | menus, drawers, page transitions |
| `juice.success()` | sparkle triad | double pulse | correct answer, clue solved |
| `juice.error()` | soft low thud | firm buzz | incorrect answer, invalid action |
| `juice.unlock()` | lock opening | double pulse | new chapter/evidence unlocked |
| `juice.reward()` | chime fanfare | celebration | XP, coins, level complete, daily reward |

Sounds are synthesized with Web Audio (no assets, no latency). To swap a cue for a
recorded asset later, replace its builder in `src/lib/juice/sound.ts`.
User toggles live in Settings → Feedback (localStorage: `pw-juice-sound`, `pw-juice-haptics`).

### `<Pressable>` — `@/components/juice/Pressable`

Drop-in `<button>` replacement: squash on press, springy release, hover lift,
ripple from the touch point, and a `cue` (default `"tap"`, `null` to silence).
Use `ripple="dark"` on light/gold buttons, `noLift` in dense lists.

### Particles — `@/components/juice/particles`

- `confettiBurstAt(element)` — small burst centered on a DOM node; the
  anticipation beat between success and the reward modal.
- `<SparkleBurst trigger={n} />` — sparks fly outward; bump `trigger` to fire.
- `<SuccessRing trigger={n} />` — expanding glow ring; taps, unlocks.
- `<AnimatedCheck />` — self-drawing checkmark.

Burst components are `absolute` overlays — parent needs `position: relative`.

### CSS utilities (globals.css)

- `.pw-shake` — wrong-answer shake (380 ms). Retrigger by changing the element's `key`.
- `.pw-pop-in` — overshoot entrance (300 ms) for messages, badges, cards.
- `.pw-glow-pulse` — soft gold glow loop for "look here" elements (CTAs, new items).
- `.pw-float` — gentle idle bob for decorative elements.

All are disabled automatically under reduced motion.

## Interaction recipes

| Moment | Recipe | Why it retains |
|---|---|---|
| Button press | `<Pressable>` (built in) | instant acknowledgment = the app feels alive |
| Correct answer | `juice.success()` + `confettiBurstAt(button)` + green flash | small win now, builds appetite for the modal |
| Incorrect answer | `juice.error()` + `.pw-shake` on input + red border + `.pw-pop-in` error | clear but gentle — invites retry instead of shaming |
| Reward/XP/level | `juice.reward()` as the modal opens (fireworks already handle visuals) | multi-sensory payoff cements the dopamine loop |
| New content unlocked | `juice.unlock()` + `<SuccessRing>` on the unlocked card | mystery-opening beat drives "just one more" |
| Card flip / evidence | `juice.pop()` + framer `rotateY` flip (350 ms) | tactile discovery |
| Menu/drawer opens | `juice.whoosh()` + slide with soft decel | space feels physical |
| Toggle/setting | `juice.tick()` | crisp confirmation |
| Notification appears | `.pw-pop-in` + `juice.pop()` | noticed without alarm |
| Idle CTA | `.pw-glow-pulse` (one element per screen, max) | draws the eye without noise |

## Site-wide coverage

`JuiceClickLayer` (mounted in the root layout) gives **every button and link on
every page** a tap sound + haptic via event delegation — no per-call-site wiring.
Opt out with `data-nojuice`; `<Pressable>` opts out automatically (`data-juiced`).
Press *visuals* stay per-element: `.pw-press` on link-cards, `<Pressable>` on buttons.

## Rollout checklist

1. ~~Puzzle solve flow~~ ✅ (reference implementation)
2. ~~Site-wide tap feedback~~ ✅ (`JuiceClickLayer` in layout)
3. ~~Hint reveal~~ ✅ (`HintCard` — `juice.unlock()`)
4. ~~Store purchases~~ ✅ (`juice.reward()` on success, `juice.error()` on failure)
5. ~~Achievements~~ ✅ (`juice.reward()` with the confetti entrance)
6. ~~Navigation~~ ✅ (bottom-nav `.pw-press`, navbar menu `juice.whoosh()`)
7. ~~Cards~~ ✅ (daily hub, campaign hub `.pw-press`; arcade card/row `:active` squash)
8. ~~Toasts / modals~~ ✅ (spring pop toasts; `ActionModal` variant-matched sound + pop-in; `ConfirmModal` pop-in)
9. ~~Team lobby~~ ✅ (`juice.pop()` on member join + incoming chat, `whoosh` on puzzle start)
10. ~~Game boards~~ ✅ (word search pop/thud/unlock; sudoku tick/error/success; hidden word
    reveal whoosh + win/lose cues; crossword word-pop + board-celebration success —
    these components serve both campaign puzzles and `/daily/*`)
11. `.pw-glow-pulse` on one featured CTA per screen (dashboard daily card)

Rules of thumb while rolling out: one glow-pulse per screen, one confetti source per
event, sounds under 500 ms except `reward`, and never gate input on an animation —
the interface must never feel slow.
