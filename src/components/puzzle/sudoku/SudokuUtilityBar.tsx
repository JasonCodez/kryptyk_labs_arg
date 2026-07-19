"use client";

import Pressable from "@/components/juice/Pressable";

interface Props {
  notesMode: boolean;
  canUndo: boolean;
  canHint: boolean;
  showHint?: boolean;
  disabled?: boolean;
  onNotes: () => void;
  onUndo: () => void;
  onErase: () => void;
  onHint: () => void;
}

function IconNotes() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M4 19.5V16l10.5-10.5a2 2 0 0 1 2.83 0l.67.67a2 2 0 0 1 0 2.83L7.5 19.5H4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M13 6.5 17.5 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconUndo() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M6 8h8.5a4.5 4.5 0 0 1 0 9H10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 4.5 5.5 8 9 11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconErase() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M17.5 4.5 20 7l-9.5 9.5H7L4.5 14 14 4.5a1.5 1.5 0 0 1 3.5 0Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7 19.5h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconHint() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M12 3.5a5.5 5.5 0 0 0-3.2 9.98c.55.4.87 1.02.87 1.68V16h4.66v-.84c0-.66.32-1.28.87-1.68A5.5 5.5 0 0 0 12 3.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9.8 19h4.4M10.4 20.5h3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function SudokuUtilityBar(props: Props) {
  const notesLabel = `Notes mode ${props.notesMode ? "on" : "off"}`;

  return (
    <div className="sudoku-utility-bar" role="toolbar" aria-label="Sudoku tools">
      <Pressable
        type="button"
        className={`sudoku-tool${props.notesMode ? " sudoku-tool--notes-on" : " sudoku-tool--notes-off"}`}
        aria-pressed={props.notesMode}
        aria-label={notesLabel}
        onClick={props.onNotes}
        disabled={props.disabled}
      >
        <IconNotes />
        <span className="sudoku-tool-label">Notes</span>
        <span className="sudoku-tool-state">{props.notesMode ? "On" : "Off"}</span>
      </Pressable>
      <Pressable
        type="button"
        className="sudoku-tool"
        aria-label="Undo last move"
        onClick={props.onUndo}
        disabled={props.disabled || !props.canUndo}
      >
        <IconUndo />
        <span className="sudoku-tool-label">Undo</span>
      </Pressable>
      <Pressable
        type="button"
        className="sudoku-tool"
        aria-label="Erase selected cell"
        onClick={props.onErase}
        disabled={props.disabled}
      >
        <IconErase />
        <span className="sudoku-tool-label">Erase</span>
      </Pressable>
      {props.showHint !== false && (
        <Pressable
          type="button"
          className="sudoku-tool"
          aria-label="Reveal a Sudoku hint"
          onClick={props.onHint}
          disabled={props.disabled || !props.canHint}
        >
          <IconHint />
          <span className="sudoku-tool-label">Hint</span>
        </Pressable>
      )}
    </div>
  );
}
