"use client";

import Pressable from "@/components/juice/Pressable";

interface Props {
  foundCount: number;
  totalWords: number;
  selectedText: string;
  onOpenWordList: () => void;
}

export default function WordSearchWordDock({ foundCount, totalWords, selectedText, onOpenWordList }: Props) {
  return (
    <section className="word-search-word-dock" aria-label="Word progress">
      <div className="word-search-progress-strip" role="status" aria-live="polite">
        <span>{foundCount} / {totalWords} found</span>
        <span className="word-search-selected-text">{selectedText || "Drag through a word"}</span>
      </div>
      <Pressable type="button" className="word-search-list-button" onClick={onOpenWordList}>
        Words
      </Pressable>
    </section>
  );
}
