"use client";

import { useEffect, useState } from "react";
import { useTeamPuzzle } from "@/lib/useTeamPuzzle";

interface PuzzlePart {
  id: string;
  title: string;
  content: string;
  order: number;
  pointsValue: number;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
}

interface TeamPuzzlePartProps {
  teamId: string;
  puzzleId: string;
  puzzleParts: PuzzlePart[];
  teamMembers: TeamMember[];
  currentUserId: string;
  isTeamAdmin: boolean;
}

export function TeamPuzzleParts({
  teamId,
  puzzleId,
  puzzleParts,
  teamMembers,
  currentUserId,
  isTeamAdmin,
}: TeamPuzzlePartProps) {
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  const [assignments, setAssignments] = useState<
    Map<string, { partId: string; userId: string; userName: string }>
  >(new Map());
  const [submissions, setSubmissions] = useState<
    Map<string, { isCorrect: boolean; attempts: number }>
  >(new Map());
  const [completed, setCompleted] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState<string>(
    puzzleParts[0]?.id || ""
  );
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { submitPart, getStatus, getAssignments, loading, error } =
    useTeamPuzzle();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPartId || !answer.trim()) {
      alert("Please select a part and enter an answer");
      return;
    }

    setSubmitting(true);

    try {
      const result = await submitPart(teamId, puzzleId, selectedPartId, answer);

      if (result.success) {
        // Update submissions map
        if (result.submission.isCorrect) {
          setSubmissions(
            new Map(submissions).set(selectedPartId, {
              isCorrect: true,
              attempts: result.submission.attempts,
            })
          );
        }

        if (result.teamPuzzleComplete) {
          setCompleted(true);
          alert("🎉 Team puzzle completed! All members contributed to the solution!");
        } else {
          alert(result.message);
        }

        setAnswer("");
      } else {
        alert(result.message || "Incorrect answer, try again!");
      }
    } catch (err) {
      console.error("Error submitting part:", err);
      alert("Failed to submit part");
    } finally {
      setSubmitting(false);
    }
  };

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

  // Load assignments and status on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const assignmentData = await getAssignments(teamId, puzzleId);
        const statusData = await getStatus(teamId, puzzleId);

        // Build assignments map
        const assignmentMap = new Map();
        assignmentData.forEach((a) => {
          assignmentMap.set(a.part.id, {
            partId: a.part.id,
            userId: a.assignedToUser.id,
            userName: a.assignedToUser.name,
          });
        });
        setAssignments(assignmentMap);

        // Build submissions map
        const submissionMap = new Map();
        statusData.submissions.forEach((s) => {
          if (s.isCorrect && s.solvedAt) {
            submissionMap.set(s.part.id, {
              isCorrect: true,
              attempts: s.attempts,
            });
          }
        });
        setSubmissions(submissionMap);
        setCompleted(statusData.completed);
      } catch (err) {
        console.error("Error loading team puzzle data:", err);
      }
    };

    loadData();
  }, [teamId, puzzleId, getAssignments, getStatus]);

  if (loading) {
    return <div className="p-4">Loading team puzzle...</div>;
  }

  if (validationError) {
    return (
      <div className="p-6 bg-red-50 border-2 border-red-500 rounded-lg">
        <h2 className="text-2xl font-bold text-red-700 mb-2">
          ⚠️ Cannot Attempt This Puzzle
        </h2>
        <p className="text-red-600 mb-4">{validationError}</p>
        <p className="text-sm text-red-500">
          Please contact your team admin to adjust team composition if needed.
        </p>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="p-6 bg-green-50 border-2 border-green-500 rounded-lg">
        <h2 className="text-2xl font-bold text-green-700 mb-2">
          ✓ Team Puzzle Completed!
        </h2>
        <p className="text-green-600">
          All team members have successfully solved their parts and earned
          points together!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Part Selection */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold mb-4">Puzzle Parts</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {puzzleParts.map((part) => {
            const assignment = assignments.get(part.id);
            const submission = submissions.get(part.id);
            const isAssignedToMe = assignment?.userId === currentUserId;

            return (
              <button
                key={part.id}
                onClick={() => setSelectedPartId(part.id)}
                className={`p-4 rounded-lg border-2 transition-colors text-left ${
                  selectedPartId === part.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                } ${submission?.isCorrect ? "bg-green-50 border-green-500" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Part {part.order + 1}</h3>
                    <p className="text-sm text-gray-600">{part.title}</p>
                    {assignment && (
                      <p className="text-xs text-gray-500 mt-1">
                        Assigned to:{" "}
                        <span className="font-medium">
                          {assignment.userName}
                        </span>
                        {isAssignedToMe && (
                          <span className="ml-2 inline-block px-2 py-0.5 bg-blue-200 text-blue-800 rounded text-xs font-medium">
                            You
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-700">
                      {part.pointsValue} pts
                    </p>
                    {submission?.isCorrect && (
                      <p className="text-sm text-green-600 font-medium">✓</p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Part Content */}
        {selectedPartId && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            {puzzleParts
              .filter((p) => p.id === selectedPartId)
              .map((part) => {
                const assignment = assignments.get(part.id);
                const isAssignedToMe = assignment?.userId === currentUserId;

                return (
                  <div key={part.id}>
                    <h3 className="font-bold text-lg mb-2">{part.title}</h3>
                    {!isAssignedToMe && !isTeamAdmin && (
                      <div className="bg-blue-100 border border-blue-300 rounded p-3 mb-4">
                        <p className="text-sm text-blue-800">
                          ℹ️ This part is assigned to{" "}
                          <span className="font-medium">
                            {assignment?.userName || "another team member"}
                          </span>
                          . You can view it but cannot submit answers.
                        </p>
                      </div>
                    )}
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: part.content }}
                    />
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Submission Form */}
      {selectedPartId && (() => {
        const assignment = assignments.get(selectedPartId);
        const isAssignedToMe = assignment?.userId === currentUserId;
        const submission = submissions.get(selectedPartId);

        if (submission?.isCorrect) {
          return (
            <div className="bg-green-50 border-2 border-green-500 rounded-lg p-6">
              <h3 className="text-lg font-bold text-green-700 mb-2">✓ Solved</h3>
              <p className="text-green-600">
                This part has been solved by {assignment?.userName} in{" "}
                {submission.attempts} attempt{submission.attempts !== 1 ? "s" : ""}
                .
              </p>
            </div>
          );
        }

        if (!isAssignedToMe && !isTeamAdmin) {
          return null;
        }

        return (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-lg border border-gray-200 p-6"
          >
            <h3 className="font-bold text-lg mb-4">Submit Your Answer</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Answer:
              </label>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Enter your answer here..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
                disabled={submitting}
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !answer.trim()}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              {submitting ? "Submitting..." : "Submit Answer"}
            </button>

            {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
          </form>
        );
      })()}

      {/* Team Progress */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-bold text-lg mb-4">Team Progress</h3>

        <div className="space-y-2">
          {puzzleParts.map((part) => {
            const assignment = assignments.get(part.id);
            const submission = submissions.get(part.id);

            return (
              <div
                key={part.id}
                className="flex items-center justify-between p-2 bg-gray-50 rounded"
              >
                <div>
                  <p className="font-medium">
                    Part {part.order + 1}: {part.title}
                  </p>
                  <p className="text-sm text-gray-600">
                    Assigned to: {assignment?.userName || "Unassigned"}
                  </p>
                </div>
                <div className="text-right">
                  {submission?.isCorrect ? (
                    <p className="text-green-600 font-bold">✓ Solved</p>
                  ) : (
                    <p className="text-amber-600 font-medium">Pending...</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
