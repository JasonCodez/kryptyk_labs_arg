"use client";

import Pressable from "@/components/juice/Pressable";

interface AnagramControlsProps {
  canPass: boolean;
  canSubmit: boolean;
  disabled?: boolean;
  onShuffle: () => void;
  onPass: () => void;
  onSubmit: () => void;
}

export default function AnagramControls({
  canPass,
  canSubmit,
  disabled = false,
  onShuffle,
  onPass,
  onSubmit,
}: AnagramControlsProps) {
  return (
    <div className="anagram-controls" data-testid="anagram-controls">
      <div className="anagram-secondary-controls">
        <Pressable type="button" className="anagram-control-button" noLift onClick={onShuffle} disabled={disabled}>
          Shuffle
        </Pressable>
        <Pressable type="button" className="anagram-control-button" noLift onClick={onPass} disabled={disabled || !canPass}>
          Pass
        </Pressable>
      </div>
      <Pressable
        type="button"
        className="anagram-submit-button"
        cue={canSubmit ? "success" : "tap"}
        noLift
        onClick={onSubmit}
        disabled={disabled || !canSubmit}
      >
        Submit
      </Pressable>
    </div>
  );
}
