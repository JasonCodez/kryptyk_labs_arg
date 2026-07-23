"use client";

import { useEffect, useState } from "react";
import { Crown } from "lucide-react";
import type { WarzBattleOutcome, WarzResultPlayer } from "@/lib/warzResult";

interface WarzResultScoreboardProps {
  challenger: WarzResultPlayer;
  opponent: WarzResultPlayer;
  battleOutcome: WarzBattleOutcome;
}

function PlayerAvatar({ player }: { player: WarzResultPlayer }) {
  const [showImage, setShowImage] = useState(Boolean(player.image));

  useEffect(() => {
    setShowImage(Boolean(player.image));
  }, [player.image]);

  if (showImage && player.image) {
    return (
      // User profile images can be remote and are already sanitized by the API.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={player.image}
        alt=""
        className="h-12 w-12 shrink-0 rounded-full object-cover"
        onError={() => setShowImage(false)}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-black uppercase"
      style={{
        color: "var(--pw-brand-secondary)",
        background: "color-mix(in srgb, var(--pw-brand-secondary) 14%, var(--pw-surface-2))",
      }}
    >
      {player.displayName.charAt(0) || "P"}
    </span>
  );
}

function PlayerCard({ player }: { player: WarzResultPlayer }) {
  return (
    <li
      data-testid={`result-player-${player.roleLabel.toLowerCase()}`}
      className="min-w-0 rounded-2xl p-4"
      style={{
        background: player.isWinner
          ? "color-mix(in srgb, var(--pw-success) 10%, var(--pw-surface-2))"
          : "var(--pw-surface-2)",
        border: `1px solid ${player.isWinner ? "var(--pw-success)" : "var(--pw-border-default)"}`,
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <PlayerAvatar player={player} />
        <div className="min-w-0 flex-1">
          <p className="break-words text-base font-extrabold leading-tight" style={{ color: "var(--pw-text-primary)" }}>
            {player.displayName}
          </p>
          <p className="mt-1 text-xs font-semibold" style={{ color: "var(--pw-text-muted)" }}>
            {player.isCurrentUser ? "You · " : ""}
            {player.roleLabel}
          </p>
        </div>
        {player.isWinner && (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide"
            style={{
              color: "var(--pw-success)",
              background: "color-mix(in srgb, var(--pw-success) 12%, transparent)",
            }}
          >
            <Crown aria-hidden="true" size={12} />
            Winner
          </span>
        )}
      </div>
      <p
        className="mt-4 text-center text-2xl font-black tabular-nums"
        style={{ color: player.finishKind === "forfeit" ? "var(--pw-error-text)" : "var(--pw-text-primary)" }}
      >
        {player.displayTime}
      </p>
    </li>
  );
}

export default function WarzResultScoreboard({
  challenger,
  opponent,
  battleOutcome,
}: WarzResultScoreboardProps) {
  return (
    <section aria-labelledby="warz-scoreboard-heading" data-battle-outcome={battleOutcome}>
      <h2
        id="warz-scoreboard-heading"
        className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em]"
        style={{ color: "var(--pw-text-muted)" }}
      >
        Battle scoreboard
      </h2>
      <ul className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-stretch">
        <PlayerCard player={challenger} />
        <li
          aria-hidden="true"
          className="flex items-center justify-center text-xs font-black uppercase tracking-[0.2em]"
          style={{ color: "var(--pw-text-muted)" }}
        >
          VS
        </li>
        <PlayerCard player={opponent} />
      </ul>
    </section>
  );
}
