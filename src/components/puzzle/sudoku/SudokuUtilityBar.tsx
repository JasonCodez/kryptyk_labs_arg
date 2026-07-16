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

export default function SudokuUtilityBar(props: Props) {
  return (
    <div className="sudoku-utility-bar" role="toolbar" aria-label="Sudoku tools">
      <Pressable type="button" className="sudoku-tool" aria-pressed={props.notesMode} onClick={props.onNotes} disabled={props.disabled}>Notes<span>{props.notesMode ? "On" : "Off"}</span></Pressable>
      <Pressable type="button" className="sudoku-tool" onClick={props.onUndo} disabled={props.disabled || !props.canUndo}>Undo</Pressable>
      <Pressable type="button" className="sudoku-tool" onClick={props.onErase} disabled={props.disabled}>Erase</Pressable>
      {props.showHint !== false && <Pressable type="button" className="sudoku-tool" onClick={props.onHint} disabled={props.disabled || !props.canHint}>Hint</Pressable>}
    </div>
  );
}
