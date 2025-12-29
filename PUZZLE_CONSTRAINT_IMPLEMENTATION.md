# Puzzle Constraint Implementation Guide

## Overview

The puzzle constraint system enforces three critical business rules to ensure fair and balanced team gameplay:

1. **Solo Puzzles Only**: Single-step puzzles (1 part) cannot be team puzzles
2. **Fair Team Distribution**: Multi-step puzzles have maximum team size = number of parts
3. **Minimum Team Requirements**: Puzzles can specify minimum team members required

---

## 📊 Implementation Status

### ✅ Complete (Enforced at All Levels)

#### 1. **Database Schema**
- `Puzzle.isTeamPuzzle`: Boolean flag marking team vs solo puzzles
- `Puzzle.minTeamSize`: Configurable minimum team size (default: 1)
- `Puzzle.parts`: Array of parts (used to calculate max team size)

#### 2. **API Validation Endpoints**

**GET `/api/team/puzzles/validate`**
- Returns comprehensive validation object
- Checks all constraints and returns specific errors
- Called on component mount for real-time validation

Request:
```
GET /api/team/puzzles/validate?teamId=TEAM_ID&puzzleId=PUZZLE_ID
```

Response:
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

Error Response:
```json
{
  "isSoloPuzzle": false,
  "isTeamPuzzle": true,
  "partCount": 5,
  "teamSize": 7,
  "minTeamSize": 1,
  "canAttempt": false,
  "errors": [
    "Team has 7 members but puzzle only has 5 parts. Maximum team size for this puzzle is 5 (one member per part). Remove 2 members."
  ]
}
```

#### 3. **Constraint Enforcement Points**

**Route: `POST /api/team/puzzles/assign-parts`**
```typescript
// Validates:
- Single-step puzzle check: puzzle.parts.length <= 1
- Max team size: assignments.length <= puzzle.parts.length
- Returns descriptive error if violated
```

**Route: `POST /api/team/puzzles/submit-part`**
```typescript
// Validates:
- Puzzle must be team puzzle: puzzle.isTeamPuzzle === true
- Puzzle must have multiple parts: puzzle.parts.length > 1
- Rejects single-step puzzles entirely
```

---

## 🎯 Constraint Rules

### Rule 1: Solo Puzzles Are Solo Only

**Definition**: Any puzzle with 1 part must have `isTeamPuzzle = false`

**Validation**:
```
If puzzle.parts.length <= 1:
  ✅ VALID: isTeamPuzzle = false
  ❌ INVALID: isTeamPuzzle = true → Error
```

**Error Message**:
```
"Single-step puzzles are solo only and cannot be team puzzles"
```

**Use Cases**:
- Daily riddles (1 puzzle = 1 solution)
- Quick challenges (single standalone puzzle)
- Tutorial puzzles

### Rule 2: Team Size = Number of Parts

**Definition**: Multi-step puzzles limit team members to the number of puzzle parts

**Validation**:
```
If puzzle.parts.length > 1 AND isTeamPuzzle = true:
  Max team members = puzzle.parts.length
  If team.members.count > puzzle.parts.length:
    ❌ INVALID → Error
```

**Error Message**:
```
"Team has X members but puzzle only has Y parts. Maximum Y unique team members allowed (one per part). You tried to assign X members."
```

**Rationale**: Prevents unfair scenarios where multiple members solve the same part

**Examples**:
```
5-part puzzle → Max 5 team members allowed
3-part puzzle → Max 3 team members allowed
2-part puzzle → Max 2 team members allowed
```

### Rule 3: Minimum Team Requirements (Future)

**Definition**: Puzzles can require minimum team members via `puzzle.minTeamSize`

**Validation**:
```
If team.members.count < puzzle.minTeamSize:
  ❌ INVALID → Error
```

**Error Message**:
```
"This puzzle requires at least X team members. Your team has Y. Add Z more member(s)."
```

**Use Cases**:
- Epic puzzles requiring coordinated team effort
- Raid-style puzzles (e.g., "minimum 10 members for this boss puzzle")
- Campaign content requiring group participation

---

## 🔧 Component Integration

### TeamPuzzleParts Component

**New State**:
```typescript
const [validationError, setValidationError] = useState<string | null>(null);
const [isValidating, setIsValidating] = useState(true);
```

**Validation on Mount**:
```typescript
useEffect(() => {
  const validatePuzzle = async () => {
    setIsValidating(true);
    try {
      const response = await fetch(
        `/api/team/puzzles/validate?teamId=${teamId}&puzzleId=${puzzleId}`
      );
      const data = await response.json();

      if (!data.canAttempt && data.errors.length > 0) {
        setValidationError(data.errors[0]);
      }
    } finally {
      setIsValidating(false);
    }
  };

  validatePuzzle();
}, [teamId, puzzleId]);
```

**Error Display**:
```tsx
if (validationError) {
  return (
    <div className="p-6 bg-red-50 border-2 border-red-500 rounded-lg">
      <h2 className="text-2xl font-bold text-red-700 mb-2">
        ⚠️ Cannot Attempt This Puzzle
      </h2>
      <p className="text-red-600 mb-4">{validationError}</p>
    </div>
  );
}
```

### AssignPuzzleParts Component

**New State**:
```typescript
const [validationError, setValidationError] = useState<string | null>(null);
const [isValidating, setIsValidating] = useState(true);
```

**Validation Logic**: Same as TeamPuzzleParts - calls validate endpoint on mount

**Error Display**:
```tsx
{validationError && (
  <div className="mb-4 p-4 bg-red-50 border-2 border-red-500 rounded-lg">
    <p className="text-red-700 font-semibold">⚠️ Cannot Assign Parts</p>
    <p className="text-red-600 text-sm mt-1">{validationError}</p>
  </div>
)}
```

### useTeamPuzzle Hook

**New Method**:
```typescript
const validatePuzzle = useCallback(
  async (teamId: string, puzzleId: string) => {
    // Calls GET /api/team/puzzles/validate
    // Returns validation object
    // Throws error if validation fails
  },
  []
);
```

---

## 🧪 Testing Scenarios

### Scenario 1: Invalid Single-Step Team Puzzle
```
Puzzle: 1 part, isTeamPuzzle = true
Result: ❌ Rejected at validation
Error: "Single-step puzzles are solo only"
```

### Scenario 2: Team Too Large
```
Puzzle: 5 parts, isTeamPuzzle = true
Team: 7 members
Result: ❌ Rejected at assignment
Error: "Maximum 5 members allowed. Remove 2."
```

### Scenario 3: Valid Team Puzzle Assignment
```
Puzzle: 5 parts, isTeamPuzzle = true
Team: 5 members
Result: ✅ Accepted
Action: Proceed with part assignment
```

### Scenario 4: Minimum Team Size Not Met
```
Puzzle: 3 parts, isTeamPuzzle = true, minTeamSize = 3
Team: 2 members
Result: ❌ Rejected at validation
Error: "Requires at least 3 members. Add 1 more."
```

---

## 📋 Validation Flow

```
User Opens Puzzle
    ↓
Component Mounts
    ↓
Call GET /api/team/puzzles/validate
    ↓
    ├─→ If errors exist:
    │   ├─→ Set validationError state
    │   └─→ Display blocking error message
    │
    └─→ If no errors:
        └─→ Allow puzzle interaction
```

---

## 🎨 Error Messages

All error messages guide users to fix the issue:

| Error | Action Required |
|-------|-----------------|
| "Single-step puzzles are solo only" | Remove puzzle from team mode or use multi-part puzzle |
| "Team has X members but puzzle has Y parts. Remove Z members." | Remove excess team members |
| "Requires at least X members. Add Y more." | Add team members to meet minimum |
| "Puzzle not found or is not a team puzzle" | Check puzzle ID or change puzzle type |

---

## 🔐 Security Considerations

1. **Server-Side Enforcement**: All constraints validated on server
2. **Permission Checks**: Only team admins can assign parts
3. **User Membership Verification**: Confirms user is team member before processing
4. **Puzzle Ownership**: Validates puzzle exists and belongs to game

---

## 📚 Related Files

- `src/app/api/team/puzzles/validate/route.ts` - Validation endpoint
- `src/app/api/team/puzzles/assign-parts/route.ts` - Assignment with constraints
- `src/app/api/team/puzzles/submit-part/route.ts` - Submission with validation
- `src/components/puzzle/TeamPuzzleParts.tsx` - Team puzzle UI
- `src/components/puzzle/AssignPuzzleParts.tsx` - Part assignment UI
- `src/lib/useTeamPuzzle.ts` - Hook with validatePuzzle method
- `TEAM_PUZZLE_CONSTRAINTS.md` - Detailed constraint documentation

---

## 🚀 Future Enhancements

1. **Database Constraints**: Add triggers for max_team_size validation
2. **Dynamic Minimum Teams**: Allow per-puzzle role requirements (e.g., "needs 1 solver, 1 researcher")
3. **Team Composition Templates**: Pre-configured teams for specific puzzle types
4. **Audit Logging**: Track constraint violations for moderation
5. **Puzzle Difficulty Scaling**: Adjust constraints based on difficulty tier

---

## 📖 API Reference

### Validation Endpoint

**Endpoint**: `GET /api/team/puzzles/validate`

**Query Parameters**:
- `teamId` (required): Team identifier
- `puzzleId` (required): Puzzle identifier

**Response Structure**:
```typescript
{
  isSoloPuzzle: boolean;           // True if puzzle is single-step
  isTeamPuzzle: boolean;           // True if marked as team puzzle
  partCount: number;               // Number of parts in puzzle
  teamSize: number;                // Current team member count
  minTeamSize: number;             // Minimum required team members
  canAttempt: boolean;             // Can team attempt this puzzle?
  errors: string[];                // Array of error messages
}
```

**HTTP Status Codes**:
- `200`: Validation complete (check `canAttempt` field)
- `400`: Missing required parameters
- `401`: Not authenticated
- `403`: Not team member
- `404`: Puzzle or user not found
- `500`: Server error

---

**Last Updated**: Current Session  
**Status**: ✅ Implementation Complete
