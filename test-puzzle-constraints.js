#!/usr/bin/env node

/**
 * Puzzle Constraint System Test Suite
 * 
 * Tests the three main constraint rules:
 * 1. Solo Puzzles Only (single-step cannot be team)
 * 2. Team Size = Number of Parts (fair distribution)
 * 3. Minimum Team Requirements (future scalability)
 */

// Test scenarios
const testScenarios = [
  {
    id: 1,
    name: "Solo Puzzle - Valid Configuration",
    puzzle: {
      id: "puzzle_1",
      title: "Daily Riddle",
      parts: 1,
      isTeamPuzzle: false,
      minTeamSize: 1,
    },
    team: {
      id: "team_1",
      members: 5,
    },
    expected: {
      canAttempt: true,
      errors: [],
      reason: "Solo puzzles can be attempted by any team size",
    },
  },
  {
    id: 2,
    name: "Solo Puzzle - Invalid Configuration",
    puzzle: {
      id: "puzzle_2",
      title: "Bad Riddle",
      parts: 1,
      isTeamPuzzle: true, // ❌ WRONG
      minTeamSize: 1,
    },
    team: {
      id: "team_2",
      members: 1,
    },
    expected: {
      canAttempt: false,
      errors: [
        "This puzzle is incorrectly marked as team puzzle. Single-step puzzles must be solo only.",
      ],
      reason: "Single-step puzzles cannot be team puzzles",
    },
  },
  {
    id: 3,
    name: "Team Puzzle - Valid (Perfect Match)",
    puzzle: {
      id: "puzzle_3",
      title: "5-Step ARG",
      parts: 5,
      isTeamPuzzle: true,
      minTeamSize: 1,
    },
    team: {
      id: "team_3",
      members: 5,
    },
    expected: {
      canAttempt: true,
      errors: [],
      reason: "5 members = 5 parts (one per member)",
    },
  },
  {
    id: 4,
    name: "Team Puzzle - Valid (Under Max)",
    puzzle: {
      id: "puzzle_4",
      title: "5-Step ARG",
      parts: 5,
      isTeamPuzzle: true,
      minTeamSize: 1,
    },
    team: {
      id: "team_4",
      members: 3,
    },
    expected: {
      canAttempt: true,
      errors: [],
      reason: "3 members < 5 parts (some members solve multiple parts)",
    },
  },
  {
    id: 5,
    name: "Team Puzzle - Invalid (Too Many Members)",
    puzzle: {
      id: "puzzle_5",
      title: "3-Step Puzzle",
      parts: 3,
      isTeamPuzzle: true,
      minTeamSize: 1,
    },
    team: {
      id: "team_5",
      members: 5,
    },
    expected: {
      canAttempt: false,
      errors: [
        "Team has 5 members but puzzle only has 3 parts. Maximum team size for this puzzle is 3 (one member per part). Remove 2 members.",
      ],
      reason: "5 members > 3 parts (too many people)",
    },
  },
  {
    id: 6,
    name: "Team Puzzle - Minimum Team Size Not Met",
    puzzle: {
      id: "puzzle_6",
      title: "Epic Raid",
      parts: 10,
      isTeamPuzzle: true,
      minTeamSize: 8,
    },
    team: {
      id: "team_6",
      members: 5,
    },
    expected: {
      canAttempt: false,
      errors: [
        "This puzzle requires at least 8 team members. Your team has 5. Add 3 more member(s).",
      ],
      reason: "Puzzle requires minimum 8 members for epic content",
    },
  },
];

console.log("=".repeat(80));
console.log("PUZZLE CONSTRAINT SYSTEM TEST SUITE");
console.log("=".repeat(80));
console.log("");

let passed = 0;
let failed = 0;

testScenarios.forEach((scenario) => {
  console.log(`Test ${scenario.id}: ${scenario.name}`);
  console.log("-".repeat(80));
  console.log(`Puzzle: "${scenario.puzzle.title}" (${scenario.puzzle.parts} parts)`);
  console.log(
    `  - isTeamPuzzle: ${scenario.puzzle.isTeamPuzzle}`
  );
  console.log(`  - minTeamSize: ${scenario.puzzle.minTeamSize}`);
  console.log(`Team: ${scenario.team.members} members`);
  console.log("");
  console.log("Expected Result:");
  console.log(`  - Can Attempt: ${scenario.expected.canAttempt}`);
  console.log(
    `  - Errors: ${scenario.expected.errors.length > 0 ? scenario.expected.errors[0] : "None"}`
  );
  console.log(`  - Reason: ${scenario.expected.reason}`);
  console.log("");

  // Simulate validation logic
  const validation = validatePuzzle(scenario.puzzle, scenario.team);

  console.log("Actual Result:");
  console.log(`  - Can Attempt: ${validation.canAttempt}`);
  console.log(
    `  - Errors: ${validation.errors.length > 0 ? validation.errors[0] : "None"}`
  );
  console.log("");

  // Check if test passed
  const testPassed =
    validation.canAttempt === scenario.expected.canAttempt &&
    validation.errors.length === scenario.expected.errors.length;

  if (testPassed) {
    console.log("✅ PASSED");
    passed++;
  } else {
    console.log("❌ FAILED");
    failed++;
    console.log(`   Expected: canAttempt=${scenario.expected.canAttempt}, errors=${scenario.expected.errors.length}`);
    console.log(`   Got:      canAttempt=${validation.canAttempt}, errors=${validation.errors.length}`);
  }
  console.log("");
  console.log("=".repeat(80));
  console.log("");
});

console.log(`\nTest Summary: ${passed} Passed, ${failed} Failed`);
if (failed === 0) {
  console.log("✅ All tests passed!");
}

/**
 * Validation Logic (mirrors server-side logic)
 */
function validatePuzzle(puzzle, team) {
  const validation = {
    isSoloPuzzle: puzzle.parts <= 1,
    isTeamPuzzle: puzzle.isTeamPuzzle,
    partCount: puzzle.parts,
    teamSize: team.members,
    minTeamSize: puzzle.minTeamSize,
    canAttempt: false,
    errors: [],
  };

  // Check constraints
  if (puzzle.parts <= 1) {
    // Solo only puzzle
    if (puzzle.isTeamPuzzle) {
      validation.errors.push(
        "This puzzle is incorrectly marked as team puzzle. Single-step puzzles must be solo only."
      );
    }
    validation.isSoloPuzzle = true;
    validation.isTeamPuzzle = false;
  } else {
    // Multi-part puzzle
    if (!puzzle.isTeamPuzzle) {
      validation.errors.push(
        `This puzzle has ${puzzle.parts} parts. For team collaboration, it should be marked as a team puzzle.`
      );
    }

    // Check team size constraints
    if (team.members > puzzle.parts) {
      validation.errors.push(
        `Team has ${team.members} members but puzzle only has ${puzzle.parts} parts. Maximum team size for this puzzle is ${puzzle.parts} (one member per part). Remove ${team.members - puzzle.parts} members.`
      );
    }

    if (team.members < puzzle.minTeamSize) {
      validation.errors.push(
        `This puzzle requires at least ${puzzle.minTeamSize} team members. Your team has ${team.members}. Add ${puzzle.minTeamSize - team.members} more member(s).`
      );
    }
  }

  // Can attempt if no errors
  validation.canAttempt = validation.errors.length === 0;

  return validation;
}
