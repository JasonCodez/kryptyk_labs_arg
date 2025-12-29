import { Suspense } from "react";
import PuzzlesWrapper from "./puzzles-wrapper";

export default function PuzzlesPage() {
  return (
    <Suspense fallback={<div style={{ backgroundColor: '#020202' }} className="min-h-screen flex items-center justify-center"><p style={{ color: '#FDE74C' }}>Loading puzzles...</p></div>}>
      <PuzzlesWrapper />
    </Suspense>
  );
}

