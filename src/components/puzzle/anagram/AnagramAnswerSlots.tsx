"use client";

import Pressable from "@/components/juice/Pressable";

interface AnswerTile {
  id: string;
  letter: string;
}

interface AnagramAnswerSlotsProps {
  length: number;
  placedTiles: AnswerTile[];
  disabled?: boolean;
  feedback?: "correct" | "wrong" | null;
  recentTileId?: string | null;
  onReturn: (slotIndex: number) => void;
}

export default function AnagramAnswerSlots({
  length,
  placedTiles,
  disabled = false,
  feedback = null,
  recentTileId = null,
  onReturn,
}: AnagramAnswerSlotsProps) {
  return (
    <div
      className="anagram-answer-slots"
      role="group"
      aria-label="Anagram answer"
      data-feedback={feedback ?? undefined}
      data-testid="anagram-answer-slots"
    >
      {Array.from({ length }, (_, index) => {
        const tile = placedTiles[index];
        return (
          <Pressable
            key={`slot-${index}`}
            type="button"
            className="anagram-answer-slot"
            noLift
            cue={tile ? "tick" : null}
            disabled={disabled || !tile}
            data-filled={tile ? "true" : undefined}
            data-recent={tile?.id === recentTileId ? "true" : undefined}
            data-slot-index={index}
            data-tile-id={tile?.id}
            data-letter={tile?.letter}
            aria-label={tile ? `Answer slot ${index + 1}, ${tile.letter}. Return letter to tray` : `Answer slot ${index + 1}, empty`}
            onClick={() => onReturn(index)}
          >
            {tile?.letter ?? ""}
          </Pressable>
        );
      })}
    </div>
  );
}
