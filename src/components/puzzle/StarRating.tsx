"use client";

import React from "react";

interface StarRatingProps {
  rating: number; // 0-5, can be decimal
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  ratingCount?: number;
}

export function StarRating({
  rating,
  size = "md",
  showText = true,
  ratingCount,
}: StarRatingProps) {
  const sizeClass = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  }[size];

  const renderStars = () => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;

    // Full stars - YELLOW (use CSS class to ensure higher specificity)
    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <span key={`full-${i}`} className="star-filled">
          ★
        </span>
      );
    }

    // Half star - YELLOW on one side
    if (hasHalfStar) {
      stars.push(
        <span key="half" className="relative inline-block">
          <span className="star-empty">★</span>
          <span className="star-half-overlay">★</span>
        </span>
      );
    }

    // Empty stars - GRAY
    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <span key={`empty-${i}`} className="star-empty">
          ★
        </span>
      );
    }

    return stars;
  };

  return (
    <div className="flex items-center gap-2">
      <div style={{ display: 'flex', gap: '0.125rem' }} className={sizeClass}>
        {renderStars()}
      </div>
      {showText && (
        <span style={{ color: '#DDDBF1' }} className="text-sm">
          {rating.toFixed(1)}
          {ratingCount && <span style={{ color: '#AB9F9D' }}> ({ratingCount})</span>}
        </span>
      )}
    </div>
  );
}
