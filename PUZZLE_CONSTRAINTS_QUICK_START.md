# Puzzle Constraints - Quick Start Guide

## 🎯 For Developers

### Understanding the Three Rules

#### Rule 1: Single-Part = Solo Only
```javascript
// ✅ VALID
const puzzle = {
  parts: 1,
  isTeamPuzzle: false
};

// ❌ INVALID
const puzzle = {
  parts: 1,
  isTeamPuzzle: true  // ERROR: Single-step puzzles must be solo only
};
```

#### Rule 2: Team Size ≤ Number of Parts
```javascript
// ✅ VALID - 3 team members, 5 parts
const puzzle = { parts: 5, isTeamPuzzle: true };
const team = { members: 3 };

// ❌ INVALID - 7 team members, 3 parts
const puzzle = { parts: 3, isTeamPuzzle: true };
const team = { members: 7 };  // ERROR: Too many members
```

#### Rule 3: Respect Minimum Team Size
```javascript
// ✅ VALID - 5 members, minimum is 3
const puzzle = { parts: 5, isTeamPuzzle: true, minTeamSize: 3 };
const team = { members: 5 };

// ❌ INVALID - 2 members, minimum is 3
const puzzle = { parts: 5, isTeamPuzzle: true, minTeamSize: 3 };
const team = { members: 2 };  // ERROR: Not enough members
```

---

## 🔍 How to Validate

### Method 1: Via API Endpoint
```typescript
// Call before attempting puzzle
const response = await fetch(
  `/api/team/puzzles/validate?teamId=TEAM_ID&puzzleId=PUZZLE_ID`
);

const validation = await response.json();

if (!validation.canAttempt) {
  console.log("Validation errors:", validation.errors);
  // Show error to user
}
```

### Method 2: Via React Hook
```typescript
import { useTeamPuzzle } from "@/lib/useTeamPuzzle";

function MyComponent() {
  const { validatePuzzle } = useTeamPuzzle();
  
  const handleValidate = async () => {
    try {
      const validation = await validatePuzzle(teamId, puzzleId);
      console.log("Can attempt:", validation.canAttempt);
      console.log("Errors:", validation.errors);
    } catch (error) {
      console.error("Validation failed:", error);
    }
  };
  
  return <button onClick={handleValidate}>Validate</button>;
}
```

### Method 3: In Components (Automatic)
```typescript
// TeamPuzzleParts and AssignPuzzleParts already validate on mount
// Just use them and they'll handle errors automatically

function MyPuzzle() {
  return (
    <>
      {/* This validates automatically and shows errors */}
      <TeamPuzzleParts {...props} />
      
      {/* This also validates and shows errors */}
      <AssignPuzzleParts {...props} />
    </>
  );
}
```

---

## 🛠️ Creating Puzzles

### Correct: Solo Puzzle
```javascript
await prisma.puzzle.create({
  data: {
    title: "Daily Riddle",
    parts: 1,
    isTeamPuzzle: false,  // ✅ Must be false for single-part
    minTeamSize: 1,
    parts: {
      create: [
        { title: "Solve the riddle", order: 0 }
      ]
    }
  }
});
```

### Correct: Team Puzzle
```javascript
await prisma.puzzle.create({
  data: {
    title: "5-Step Quest",
    parts: 5,
    isTeamPuzzle: true,   // ✅ Must be true for multi-part
    minTeamSize: 1,       // Can be 1-5
    parts: {
      create: [
        { title: "Step 1", order: 0 },
        { title: "Step 2", order: 1 },
        { title: "Step 3", order: 2 },
        { title: "Step 4", order: 3 },
        { title: "Step 5", order: 4 }
      ]
    }
  }
});
```

### Correct: Epic Raid (Minimum Team)
```javascript
await prisma.puzzle.create({
  data: {
    title: "Epic Boss Raid",
    parts: 10,
    isTeamPuzzle: true,
    minTeamSize: 8,       // ✅ Requires at least 8 members
    parts: {
      create: [
        { title: "Phase 1", order: 0 },
        // ... 8 more phases
      ]
    }
  }
});
```

---

## 📋 Validation Response

### When Valid
```json
{
  "isSoloPuzzle": false,
  "isTeamPuzzle": true,
  "partCount": 5,
  "teamSize": 3,
  "minTeamSize": 1,
  "canAttempt": true,
  "errors": []
}
```

### When Invalid (Too Many Members)
```json
{
  "isSoloPuzzle": false,
  "isTeamPuzzle": true,
  "partCount": 5,
  "teamSize": 7,
  "minTeamSize": 1,
  "canAttempt": false,
  "errors": [
    "Team has 7 members but puzzle only has 5 parts. Maximum 5 unique team members allowed (one member per part). Remove 2 members."
  ]
}
```

### When Invalid (Too Few Members)
```json
{
  "isSoloPuzzle": false,
  "isTeamPuzzle": true,
  "partCount": 10,
  "teamSize": 5,
  "minTeamSize": 8,
  "canAttempt": false,
  "errors": [
    "This puzzle requires at least 8 team members. Your team has 5. Add 3 more member(s)."
  ]
}
```

---

## 🚨 Common Errors

### Error: "Single-step puzzles are solo only"
```
When: You try to create or submit to a 1-part puzzle with isTeamPuzzle=true
Fix:  Set isTeamPuzzle: false
```

### Error: "Too many unique team members"
```
When: Team has more members than puzzle parts
Fix:  Remove excess team members (max = number of parts)
Example:
  - 3-part puzzle → max 3 members
  - 5-part puzzle → max 5 members
```

### Error: "Not enough team members"
```
When: Team has fewer than minTeamSize required
Fix:  Add more team members
Example:
  - minTeamSize: 3 → need at least 3 members
  - minTeamSize: 8 → need at least 8 members
```

---

## ✅ Testing Your Puzzles

```typescript
// Create test data
const puzzle = await prisma.puzzle.create({
  data: { /* ... */ }
});

const team = await prisma.team.create({
  data: { /* ... */ }
});

// Add team members
await prisma.teamMember.createMany({
  data: [
    { teamId: team.id, userId: user1.id },
    { teamId: team.id, userId: user2.id },
    // ...
  ]
});

// Validate
const response = await fetch(
  `/api/team/puzzles/validate?teamId=${team.id}&puzzleId=${puzzle.id}`
);
const validation = await response.json();

console.log(validation);
// Check: validation.canAttempt should be true
// Check: validation.errors should be empty []
```

---

## 🎓 Examples

### Example 1: 3-Part Treasure Hunt
```javascript
{
  title: "Treasure Hunt",
  parts: 3,
  isTeamPuzzle: true,
  minTeamSize: 1,
  partCount: 3,
}

// Valid team sizes: 1, 2, or 3 members
// Invalid: 4+ members (too many)
```

### Example 2: 5-Step ARG Campaign
```javascript
{
  title: "ARG Campaign",
  parts: 5,
  isTeamPuzzle: true,
  minTeamSize: 2,
  partCount: 5,
}

// Valid team sizes: 2, 3, 4, or 5 members
// Invalid: 1 member (too few, needs minimum 2)
// Invalid: 6+ members (too many)
```

### Example 3: Daily Solo Riddle
```javascript
{
  title: "Daily Riddle",
  parts: 1,
  isTeamPuzzle: false,
  minTeamSize: 1,
}

// Any team size works (team members solve independently)
// Each member attempts solo
// Cannot be marked as team puzzle
```

---

## 🔗 API Endpoints

### Validate Puzzle
```
GET /api/team/puzzles/validate
Query: teamId={id}&puzzleId={id}
Returns: ValidationResult
```

### Assign Parts
```
POST /api/team/puzzles/assign-parts
Body: { teamId, puzzleId, assignments[] }
Validates: Team size ≤ parts count
```

### Submit Part
```
POST /api/team/puzzles/submit-part
Body: { teamId, puzzleId, partId, answer }
Validates: Puzzle is team puzzle with multiple parts
```

---

## 📚 More Info

- See `PUZZLE_CONSTRAINT_IMPLEMENTATION.md` for technical details
- See `TEAM_PUZZLE_CONSTRAINTS.md` for complete rules
- See `test-puzzle-constraints.js` for test examples

---

**Status**: ✅ Ready to Use
**Last Updated**: Current Session
