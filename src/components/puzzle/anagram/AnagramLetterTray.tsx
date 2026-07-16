"use client";

import Pressable from "@/components/juice/Pressable";

interface AnagramLetterTrayTile {
  id: string;
  letter: string;
}

interface AnagramLetterTrayProps {
  tiles: AnagramLetterTrayTile[];
  placedTileIds: ReadonlySet<string>;
  disabled?: boolean;
  feedback?: "correct" | "wrong" | null;
  recentTileId?: string | null;
  onSelect: (tileId: string) => void;
}

export default function AnagramLetterTray({
  tiles,
  placedTileIds,
  disabled = false,
  feedback = null,
  recentTileId = null,
  onSelect,
}: AnagramLetterTrayProps) {
  return (
    <div
      className="anagram-letter-tray"
      role="group"
      aria-label="Scrambled letter tray"
      data-feedback={feedback ?? undefined}
      data-testid="anagram-letter-tray"
    >
      {tiles.map((tile) => {
        const used = placedTileIds.has(tile.id);
        return (
          <Pressable
            key={tile.id}
            type="button"
            className="anagram-letter-tile"
            noLift
            cue="pop"
            disabled={disabled || used}
            data-used={used ? "true" : undefined}
            data-recent={recentTileId === tile.id ? "true" : undefined}
            data-tile-id={tile.id}
            data-letter={tile.letter}
            aria-label={`${tile.letter}${used ? ", used" : ", available"}`}
            onClick={() => onSelect(tile.id)}
          >
            {tile.letter}
          </Pressable>
        );
      })}
    </div>
  );
}
