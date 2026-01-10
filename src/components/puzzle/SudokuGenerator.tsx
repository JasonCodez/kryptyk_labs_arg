"use client";

import React from "react";
import { SudokuDifficulty, SudokuGrid as SudokuGridType } from "@/lib/sudoku-engine";
import SudokuGrid from "./SudokuGrid";

interface Props {
  difficulty: SudokuDifficulty;
  onDifficultyChange: (d: SudokuDifficulty) => void;
  onPuzzleGenerated: (puzzle: number[][], solution: number[][]) => void;
}

export default function SudokuGenerator({ difficulty, onDifficultyChange, onPuzzleGenerated }: Props) {
  const [preview, setPreview] = React.useState<SudokuGridType | null>(null);
  const [generating, setGenerating] = React.useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/sudoku/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty }),
      });

      if (!res.ok) throw new Error(`Generation failed: ${res.status}`);

      const data = await res.json();
      if (data?.puzzle && data?.solution) {
        const generated: SudokuGridType = { puzzle: data.puzzle, solution: data.solution };
        setPreview(generated);
        onPuzzleGenerated(generated.puzzle, generated.solution);
      } else {
        throw new Error("Invalid response from generator");
      }
    } catch (err) {
      console.error("Sudoku generation failed:", err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-300">Difficulty</label>
        <select
          value={difficulty}
          onChange={(e) => onDifficultyChange(e.target.value as SudokuDifficulty)}
          className="px-3 py-2 rounded bg-slate-700 text-white"
        >
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
          <option value="expert">Expert</option>
          <option value="extreme">Extreme</option>
        </select>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="ml-auto px-4 py-2 rounded bg-emerald-600 text-black font-semibold disabled:opacity-60"
        >
          {generating ? "Generating..." : "Generate Sudoku"}
        </button>
      </div>

      {preview && (
        <div>
          <div className="text-sm text-gray-300 mb-2">Preview</div>
          <SudokuGrid puzzle={preview.puzzle} onSubmit={() => {}} disabled={true} />
        </div>
      )}
    </div>
  );
}
