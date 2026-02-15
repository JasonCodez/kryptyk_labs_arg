import React from "react";

export type PuzzleModalType = "keypad" | "riddle" | "info" | string;

export interface PuzzleModalProps {
  open: boolean;
  type: PuzzleModalType;
  config?: any;
  onClose: () => void;
  onComplete?: (result?: any) => void;
}

export default function PuzzleModal({ open, type, config, onClose, onComplete }: PuzzleModalProps) {
  if (!open) return null;

  let content: React.ReactNode = null;
  switch (type) {
    case "keypad":
      content = <div>Keypad interaction coming soon.</div>;
      break;
    case "riddle":
      content = <div>Riddle interaction coming soon.</div>;
      break;
    case "info":
      content = <div>{config?.message || "Info modal"}</div>;
      break;
    default:
      content = <div>Unknown modal type: {type}</div>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-lg shadow-lg p-6 min-w-[320px] max-w-full relative">
        <button
          className="absolute top-2 right-2 text-gray-500 hover:text-black"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        {content}
      </div>
    </div>
  );
}
