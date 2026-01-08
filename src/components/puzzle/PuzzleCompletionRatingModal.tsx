"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { RatingInput } from "./RatingInput";

interface PuzzleCompletionRatingModalProps {
  puzzleId: string;
  puzzleTitle: string;
  onClose: () => void;
  onSubmit?: () => void;
}

export default function PuzzleCompletionRatingModal({
  puzzleId,
  puzzleTitle,
  onClose,
  onSubmit,
}: PuzzleCompletionRatingModalProps) {
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleRatingSubmitted = () => {
    setIsSubmitted(true);
    // Auto-close after 2 seconds
    setTimeout(() => {
      onClose();
      onSubmit?.();
    }, 2000);
  };

  return (
    <>
      {/* Modal Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm"
        onClick={onClose}
      >
        {/* Modal Content */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.5, opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 200, damping: 25 }}
          className="bg-gray-900 rounded-lg border p-8 w-full max-w-md mx-4 shadow-2xl"
          style={{
            backgroundColor: "rgba(2, 2, 2, 0.95)",
            borderColor: "#FDE74C",
            borderWidth: "2px",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Great Job! 🎉</h2>
              <p
                className="text-sm mt-1"
                style={{ color: "#DDDBF1" }}
              >
                You solved "{puzzleTitle}"
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors text-2xl leading-none"
            >
              ✕
            </button>
          </div>

          {/* Success Message */}
          {isSubmitted && (
            <div
              className="mb-6 p-4 rounded-lg border text-white text-center"
              style={{
                backgroundColor: "rgba(56, 189, 248, 0.2)",
                borderColor: "#38B9F8",
              }}
            >
              ✓ Thanks for your rating!
            </div>
          )}

          {/* Rating Input Component */}
          {!isSubmitted && (
            <div>
              <p
                className="text-center mb-4 text-sm"
                style={{ color: "#DDDBF1" }}
              >
                How would you rate this puzzle?
              </p>
              <RatingInput
                puzzleId={puzzleId}
                onSubmit={async (rating, review) => {
                  handleRatingSubmitted();
                }}
              />
            </div>
          )}

          {/* Close Button (if already submitted) */}
          {isSubmitted && (
            <button
              onClick={onClose}
              className="w-full mt-4 px-4 py-2 rounded-lg font-semibold transition-colors"
              style={{
                backgroundColor: "#FDE74C",
                color: "#020202",
              }}
            >
              Continue
            </button>
          )}
        </motion.div>
      </motion.div>
    </>
  );
}
