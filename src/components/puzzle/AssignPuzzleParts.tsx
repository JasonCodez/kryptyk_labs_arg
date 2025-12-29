"use client";

import { useState, useEffect } from "react";
import { useTeamPuzzle } from "@/lib/useTeamPuzzle";

interface PuzzlePart {
  id: string;
  title: string;
  order: number;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
}

interface AssignPuzzlePartsProps {
  teamId: string;
  puzzleId: string;
  puzzleParts: PuzzlePart[];
  teamMembers: TeamMember[];
  onAssignmentsChanged?: () => void;
}

export function AssignPuzzleParts({
  teamId,
  puzzleId,
  puzzleParts,
  teamMembers,
  onAssignmentsChanged,
}: AssignPuzzlePartsProps) {
  const [assignments, setAssignments] = useState<
    Record<string, string>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  const { assignParts, loading, error } = useTeamPuzzle();

  // Validate puzzle eligibility on mount
  useEffect(() => {
    const validatePuzzle = async () => {
      setIsValidating(true);
      try {
        const response = await fetch(
          `/api/team/puzzles/validate?teamId=${teamId}&puzzleId=${puzzleId}`
        );
        const data = await response.json();

        if (!data.canAttempt && data.errors && data.errors.length > 0) {
          setValidationError(data.errors[0]);
        }
      } catch (err) {
        console.error("Error validating puzzle:", err);
      } finally {
        setIsValidating(false);
      }
    };

    validatePuzzle();
  }, [teamId, puzzleId]);

  // Initialize assignments - one member per part in round-robin fashion
  useEffect(() => {
    const initialAssignments: Record<string, string> = {};
    puzzleParts.forEach((part, index) => {
      const memberIndex = index % teamMembers.length;
      initialAssignments[part.id] = teamMembers[memberIndex].id;
    });
    setAssignments(initialAssignments);
  }, [puzzleParts, teamMembers]);

  const handleAssignmentChange = (partId: string, memberId: string) => {
    setAssignments({
      ...assignments,
      [partId]: memberId,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all parts are assigned
    for (const part of puzzleParts) {
      if (!assignments[part.id]) {
        alert(`Please assign a member to Part ${part.order + 1}`);
        return;
      }
    }

    setSubmitting(true);

    try {
      const assignmentList = puzzleParts.map((part) => ({
        partId: part.id,
        assignedToUserId: assignments[part.id],
      }));

      const result = await assignParts(teamId, puzzleId, assignmentList);

      if (result.success) {
        alert("✓ Part assignments have been set!");
        onAssignmentsChanged?.();
      }
    } catch (err) {
      console.error("Error assigning parts:", err);
      alert("Failed to save assignments");
    } finally {
      setSubmitting(false);
    }
  };

  const getMemberName = (memberId: string) => {
    return teamMembers.find((m) => m.id === memberId)?.name || "Unknown";
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-xl font-bold mb-4">Assign Team Members to Parts</h2>

      {validationError && (
        <div className="mb-4 p-4 bg-red-50 border-2 border-red-500 rounded-lg">
          <p className="text-red-700 font-semibold">⚠️ Cannot Assign Parts</p>
          <p className="text-red-600 text-sm mt-1">{validationError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-gray-600 text-sm">
          Each team member will solve their assigned part. All parts must be
          solved correctly for the team to complete the puzzle.
        </p>

        <div className="space-y-3">
          {puzzleParts.map((part) => (
            <div key={part.id} className="flex items-center gap-4">
              <label className="flex-shrink-0 font-medium w-40">
                Part {part.order + 1}: {part.title}
              </label>

              <select
                value={assignments[part.id] || ""}
                onChange={(e) =>
                  handleAssignmentChange(part.id, e.target.value)
                }
                disabled={submitting}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="">Select a member...</option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-4">
          <p className="text-sm text-blue-700">
            <strong>💡 Tip:</strong> You can assign multiple parts to the same
            member, or one part per member. Choose the distribution that makes
            sense for your team's skill levels!
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || loading}
          className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-bold py-2 px-4 rounded-lg transition-colors"
        >
          {submitting ? "Saving Assignments..." : "Save Part Assignments"}
        </button>
      </form>

      {/* Current Assignments Summary */}
      {Object.keys(assignments).length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="font-semibold mb-3">Assignment Summary</h3>

          <div className="space-y-2">
            {puzzleParts.map((part) => (
              <div key={part.id} className="flex justify-between p-2 bg-gray-50 rounded">
                <span>Part {part.order + 1}</span>
                <span className="font-medium">
                  {getMemberName(assignments[part.id])}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
