"use client";

import Pressable from "@/components/juice/Pressable";

export default function SudokuNumberPad({ onDigit, disabled = false }: { onDigit: (digit: number) => void; disabled?: boolean }) {
  return (
    <div className="sudoku-number-pad" role="group" aria-label="Number pad">
      {Array.from({ length: 9 }, (_, index) => index + 1).map((digit) => (
        <Pressable key={digit} type="button" className="sudoku-number-key" disabled={disabled} onClick={() => onDigit(digit)} aria-label={`Enter ${digit}`}>
          {digit}
        </Pressable>
      ))}
    </div>
  );
}
