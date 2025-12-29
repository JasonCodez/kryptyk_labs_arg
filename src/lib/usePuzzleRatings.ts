import { useCallback, useState } from "react";

interface RatingStats {
  puzzleId: string;
  averageRating: number;
  ratingCount: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

interface UserRating {
  id: string;
  rating: number;
  review: string | null;
  createdAt: string;
  updatedAt: string;
}

export function usePuzzleRatings() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get rating stats for a puzzle
  const getRatingStats = useCallback(async (puzzleId: string): Promise<RatingStats | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/puzzles/ratings-stats?puzzleId=${puzzleId}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch rating stats");
      }

      return await response.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get user's rating for a puzzle
  const getUserRating = useCallback(async (puzzleId: string): Promise<UserRating | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/puzzles/rate?puzzleId=${puzzleId}`);

      if (!response.ok) {
        throw new Error("Failed to fetch user rating");
      }

      const data = await response.json();
      return data.rating || null;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Submit or update rating
  const submitRating = useCallback(
    async (puzzleId: string, rating: number, review?: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/puzzles/rate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            puzzleId,
            rating,
            review: review || null,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to submit rating");
        }

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    loading,
    error,
    getRatingStats,
    getUserRating,
    submitRating,
  };
}
