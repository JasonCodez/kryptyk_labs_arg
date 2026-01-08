"use client";

import React, { useState } from "react";

interface RatingInputProps {
  puzzleId: string;
  onSubmit?: (rating: number, review: string) => Promise<void>;
  onCancel?: () => void;
  initialRating?: number;
  initialReview?: string;
}

export function RatingInput({
  puzzleId,
  onSubmit,
  onCancel,
  initialRating = 0,
  initialReview = "",
}: RatingInputProps) {
  const [hoveredRating, setHoveredRating] = useState(0);
  const [selectedRating, setSelectedRating] = useState(initialRating);
  const [review, setReview] = useState(initialReview);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleStarClick = (rating: number) => {
    setSelectedRating(rating);
  };

  const handleSubmit = async () => {
    if (selectedRating === 0) {
      setError("Please select a rating");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/puzzles/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          puzzleId,
          rating: selectedRating,
          review: review.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit rating");
      }

      setSuccess(true);
      setTimeout(() => {
        onSubmit?.(selectedRating, review);
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit rating");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
        <p className="text-green-700 font-semibold">✓ Thanks for rating!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Star Rating Input */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Rate this puzzle
        </label>
        <div className="flex gap-2 text-3xl">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => handleStarClick(star)}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              className="transition-transform hover:scale-110"
              disabled={isSubmitting}
            >
              <span
                className={
                  star <= (hoveredRating || selectedRating)
                    ? "text-yellow-400 cursor-pointer"
                    : "text-gray-300 cursor-pointer"
                }
              >
                ★
              </span>
            </button>
          ))}
        </div>
        {selectedRating > 0 && (
          <p className="text-sm text-gray-600">
            {selectedRating} star{selectedRating !== 1 ? "s" : ""} selected
          </p>
        )}
      </div>

      {/* Review Text (Optional) */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Write a review (optional)
        </label>
        <textarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder="Share your thoughts about this puzzle..."
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
          style={{ backgroundColor: "rgba(56, 145, 166, 0.1)" }}
          rows={3}
          maxLength={500}
          disabled={isSubmitting}
        />
        <p className="text-xs text-gray-500 text-right">
          {review.length}/500
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3 justify-end">
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || selectedRating === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Submitting..." : "Submit Rating"}
        </button>
      </div>
    </div>
  );
}
