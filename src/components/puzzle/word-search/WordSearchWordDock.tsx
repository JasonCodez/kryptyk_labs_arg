"use client";

import Pressable from "@/components/juice/Pressable";

interface Props {
  foundCount: number;
  totalWords: number;
  selectedText: string;
  onOpenWordList: () => void;
  showProgress?: boolean;
}

function IconWordList() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <path d="M8 6h11M8 12h11M8 18h11" strokeLinecap="round" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" strokeLinecap="round" />
    </svg>
  );
}

export default function WordSearchWordDock({ foundCount, totalWords, selectedText, onOpenWordList, showProgress = true }: Props) {
  const hasSelection = selectedText.length > 0;
  return (
    <section className="word-search-word-dock" aria-label="Word progress">
      <div className="word-search-progress-strip" role="status" aria-live="polite" data-selection-active={hasSelection || undefined}>
        <div className="word-search-selection">
          <span className="word-search-selected-text" aria-label={hasSelection ? `Current selection: ${selectedText}` : undefined}>
            {hasSelection ? selectedText : "Drag or tap to select"}
          </span>
        </div>
        {showProgress && (
          <span className="word-search-found-count">{foundCount} / {totalWords} found</span>
        )}
      </div>
      <Pressable type="button" className="word-search-list-button" onClick={onOpenWordList}>
        <IconWordList />
        Words
      </Pressable>
    </section>
  );
}
