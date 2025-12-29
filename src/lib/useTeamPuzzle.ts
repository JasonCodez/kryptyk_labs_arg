import { useCallback, useState } from "react";

interface PuzzlePartAssignment {
  id: string;
  partId: string;
  assignedToUserId: string;
  assignedToUser: {
    id: string;
    name: string;
    email: string;
  };
  part: {
    id: string;
    title: string;
    order: number;
  };
}

interface TeamPuzzlePartSubmission {
  id: string;
  partId: string;
  submittedByUserId: string;
  submittedByUser: {
    name: string;
    email: string;
  };
  isCorrect: boolean;
  attempts: number;
  solvedAt: string | null;
  part: {
    id: string;
    title: string;
    order: number;
  };
}

interface TeamPuzzleStatus {
  submissions: TeamPuzzlePartSubmission[];
  assignments: PuzzlePartAssignment[];
  completed: boolean;
  totalPoints: number;
}

export function useTeamPuzzle() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assignParts = useCallback(
    async (
      teamId: string,
      puzzleId: string,
      assignments: Array<{
        partId: string;
        assignedToUserId: string;
      }>
    ) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/team/puzzles/assign-parts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teamId,
            puzzleId,
            assignments,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to assign parts");
        }

        return await response.json();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error occurred";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const submitPart = useCallback(
    async (
      teamId: string,
      puzzleId: string,
      partId: string,
      answer: string
    ) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/team/puzzles/submit-part", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teamId,
            puzzleId,
            partId,
            answer,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to submit part");
        }

        return data;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error occurred";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getStatus = useCallback(
    async (teamId: string, puzzleId: string): Promise<TeamPuzzleStatus> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/team/puzzles/submit-part?teamId=${teamId}&puzzleId=${puzzleId}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch puzzle status");
        }

        return await response.json();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error occurred";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getAssignments = useCallback(
    async (
      teamId: string,
      puzzleId: string
    ): Promise<PuzzlePartAssignment[]> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/team/puzzles/assign-parts?teamId=${teamId}&puzzleId=${puzzleId}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch assignments");
        }

        const data = await response.json();
        return data.assignments;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error occurred";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const validatePuzzle = useCallback(
    async (teamId: string, puzzleId: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/team/puzzles/validate?teamId=${teamId}&puzzleId=${puzzleId}`
        );

        if (!response.ok) {
          throw new Error("Failed to validate puzzle");
        }

        return await response.json();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error validating puzzle";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    loading,
    error,
    assignParts,
    submitPart,
    getStatus,
    getAssignments,
    validatePuzzle,
  };
}
