# Team Puzzle Constraints & Rules

## Overview

The team puzzle system enforces specific rules to ensure fair gameplay and prevent exploits.

---

## 📋 Puzzle Type Rules

### Solo Puzzles (Single-Step Only)
**Constraint**: `parts.length === 1 AND isTeamPuzzle === false`

```
✅ ALLOWED:
- puzzleParts.count = 1
- isTeamPuzzle = false
- Can be played solo
- Can be played by teams (each member solves independently)

❌ NOT ALLOWED:
- puzzleParts.count = 1 AND isTeamPuzzle = true
- System will reject with: "Single-step puzzles are solo only"
```

**Use Case**: Basic puzzles, single riddles, quick challenges

---

### Team Puzzles (Multi-Step)
**Constraint**: `parts.length > 1 AND isTeamPuzzle === true`

```
✅ REQUIRED FOR TEAM MODE:
- puzzleParts.count >= 2
- isTeamPuzzle = true
- Each part assigned to exactly one team member
- All parts must be solved for completion

❌ NOT ALLOWED:
- puzzleParts.count = 1 AND isTeamPuzzle = true
- System will reject with: "Single-step puzzles are solo only"
- puzzleParts.count > 1 AND isTeamPuzzle = false
- (These CAN be solo but lose team interaction)
```

**Use Case**: ARG puzzles, collaborative challenges, multi-step dungeons

---

## 👥 Team Size Rules

### Maximum Team Size
**Constraint**: `teamMembers.count <= puzzleParts.length`

```
REASON: One member per part

EXAMPLE 1:
- Puzzle: "5-Step ARG Challenge" (5 parts)
- Max team size: 5 members
- Valid teams: 1, 2, 3, 4, or 5 members
- Invalid team: 6+ members → REJECTED

EXAMPLE 2:
- Puzzle: "2-Step Mystery" (2 parts)
- Max team size: 2 members
- Valid teams: 1 or 2 members
- Invalid team: 3+ members → REJECTED

ERROR MESSAGE:
"This puzzle has 5 parts. Maximum 5 unique team members allowed
(one per part). You tried to assign 7 members."
```

### Minimum Team Size
**Constraint**: `teamMembers.count >= puzzle.minTeamSize`

```
CONFIGURABLE: puzzle.minTeamSize (default 1)

TYPICAL VALUES:
- minTeamSize = 1: Can be played solo or with team
- minTeamSize = 2: Requires at least 2 members
- minTeamSize = 5: Requires exactly 5 members (for ARGs with 5 parts)

FUTURE PUZZLES:
Some puzzles may require:
minTeamSize = puzzle.parts.length
(All parts must have assigned members before puzzle becomes available)

ERROR MESSAGE:
"This puzzle requires at least 5 team members.
Your team has 3. Add 2 more members."
```

---

## 🔄 Assignment Rules

### Part Assignment
**Constraint**: Each part assigned to exactly one member

```
VALID ASSIGNMENTS (3 parts, 3 members):
├─ Part 1 → Alice
├─ Part 2 → Bob
└─ Part 3 → Charlie

VALID ASSIGNMENTS (3 parts, 2 members):
├─ Part 1 → Alice
├─ Part 2 → Bob
└─ Part 3 → Bob (Bob does 2 parts - allowed!)

INVALID ASSIGNMENTS (3 parts, 4 members):
├─ Part 1 → Alice
├─ Part 2 → Bob
├─ Part 3 → Charlie
└─ Part 4 → David (4 members, only 3 parts) → REJECTED

INVALID ASSIGNMENTS (3 parts, 2 assignments):
├─ Part 1 → Alice
└─ Part 2 → Bob
(Part 3 not assigned) → REJECTED on submission attempt
```

### Part Reuse
**Allowed**: Same member can be assigned multiple parts

```
SCENARIO: 3-part puzzle, 2-member team
- Part 1 → Alice (50 pts)
- Part 2 → Bob (50 pts)
- Part 3 → Alice (50 pts) ✓ ALLOWED

When complete:
- Alice gets: 50 + 50 = 100 points (from parts 1 & 3)
- Bob gets: 50 points (from part 2)
- Wait... no! Team puzzles give FULL points to ALL members!

CORRECTION:
- Alice gets: 150 points (all parts value)
- Bob gets: 150 points (all parts value)
(Everyone gets full team total)
```

---

## 📊 Puzzle Examples

### Example 1: Solo Riddle
```
Puzzle: "Daily Riddle"
Parts: 1
isTeamPuzzle: false
minTeamSize: 1

VALIDATION:
✓ 1 part = solo only
✓ Not marked as team
✓ Can be played individually
✓ No team constraints

TEAM ATTEMPT:
✓ Teams CAN attempt, each member solves independently
✓ Each team member gets individual credit
✓ NOT a true team puzzle
```

### Example 2: 5-Step ARG
```
Puzzle: "Corporate Conspiracy"
Parts: 5 (Step 1-5)
isTeamPuzzle: true
minTeamSize: 1

VALIDATION:
✓ 5 parts > 1
✓ Marked as team puzzle
✓ Can have 1-5 members
✓ Each member solves one part

TEAM SIZES ALLOWED:
- 1 member: Solves all 5 steps solo (no team benefit)
- 2 members: 2 parts each, 1 part left (invalid!)
- 3 members: 1, 1, 3 parts (valid)
- 5 members: 1 part each (ideal)
- 6+ members: REJECTED
```

### Example 3: 2-Step Partner Puzzle
```
Puzzle: "Detective Duo"
Parts: 2
isTeamPuzzle: true
minTeamSize: 2

VALIDATION:
✓ 2 parts > 1
✓ Marked as team puzzle
✓ Requires minimum 2 members
✓ Maximum 2 members

TEAM SIZES ALLOWED:
- 1 member: REJECTED (needs 2)
- 2 members: ✓ ALLOWED (perfect)
- 3+ members: REJECTED (too many)
```

### Example 4: Future Tiered Puzzle
```
Puzzle: "Epic Dungeon" (Future feature)
Parts: 10 (difficulty levels 1-10)
isTeamPuzzle: true
minTeamSize: 10

VALIDATION:
✓ 10 parts > 1
✓ Marked as team puzzle
✓ Requires exactly 10 members (one per difficulty)
✓ Only available when team reaches 10 members

TEAM GROWTH SCENARIO:
- Team of 5: "Puzzle locked - needs 10 members"
- Team adds 5 more
- Team of 10: "🔓 Epic Dungeon now available!"
- Team puzzle becomes playable when minTeamSize met
```

---

## 🔐 Validation Endpoints

### Validate Team Puzzle Eligibility
```
GET /api/team/puzzles/validate?teamId=X&puzzleId=Y

RESPONSE:
{
  "isSoloPuzzle": false,
  "isTeamPuzzle": true,
  "partCount": 5,
  "teamSize": 3,
  "minTeamSize": 1,
  "canAttempt": false,
  "errors": [
    "Team has 3 members but puzzle only has 2 parts.
     Maximum team size for this puzzle is 2.
     Remove 1 member."
  ]
}
```

### Validate Part Assignment
```
POST /api/team/puzzles/assign-parts
{
  "teamId": "team_123",
  "puzzleId": "puzzle_456",
  "assignments": [...]
}

VALIDATION CHECKS:
✓ Puzzle has multiple parts (> 1)
✓ Puzzle is marked as team puzzle
✓ Each part has assignment
✓ Team size <= part count
✓ All team members exist
✓ No duplicate part assignments
```

### Validate Part Submission
```
POST /api/team/puzzles/submit-part
{
  "teamId": "team_123",
  "puzzleId": "puzzle_456",
  "partId": "part_1",
  "answer": "solution"
}

VALIDATION CHECKS:
✓ Puzzle has multiple parts (> 1)
✓ Puzzle is marked as team puzzle
✓ User is team member
✓ Part is assigned to user
✓ Answer is provided
```

---

## 🚫 Common Errors

### "Single-step puzzles are solo only"
```
Cause: Trying to create team puzzle with 1 part
Fix: Either add more parts, or mark as solo puzzle
```

### "Maximum 5 unique team members allowed"
```
Cause: More team members than puzzle parts
Fix: Remove extra team members or add more puzzle parts
```

### "This puzzle requires at least X team members"
```
Cause: Team too small for puzzle minTeamSize
Fix: Add more members to team
```

### "You are not assigned to this puzzle part"
```
Cause: Trying to submit for part not assigned to you
Fix: Admin must assign you to a part
```

---

## 📈 Constraints Summary

| Constraint | Rule | Enforced |
|-----------|------|----------|
| Solo puzzles | 1 part + isTeamPuzzle=false | ✅ API |
| Team puzzles | >1 part + isTeamPuzzle=true | ✅ API |
| Max team size | Members ≤ Parts | ✅ API + Assignment |
| Min team size | Members ≥ minTeamSize | ✅ Validation |
| Part assignment | 1-to-1 or 1-to-many | ✅ Assignment |
| Solo submission | Must be solo puzzle | ✅ API |
| Team submission | Must be team puzzle | ✅ API |

---

## 🎯 Design Rationale

### Why Max Team Size = Part Count?
- **Fairness**: Each member contributes to exactly one part
- **No free-riding**: Can't have extra members not solving anything
- **Clear accountability**: Visible who did what
- **Scalability**: Prevents "zergling" strategies

### Why Min Team Size Exists?
- **Future content**: Can require full team for epic puzzles
- **Difficulty scaling**: Future puzzles might need X people minimum
- **Progression**: Teams can grow to unlock harder puzzles

### Why Single-Step Solo Only?
- **No ambiguity**: Clear intent and mechanics
- **Solo satisfaction**: Players can experience content alone
- **Future-proofing**: Leaves room for team expansions

---

## 🔄 Future Enhancements

Planned features that leverage these constraints:

1. **Progressive Unlock**: As team grows → harder puzzles available
2. **Role-Based Parts**: Different difficulty parts require specific roles
3. **Dynamic Scaling**: Puzzle difficulty adjusts based on team size
4. **Leaderboards**: Solo vs Team rankings separate
5. **Tournaments**: Tournament mode with fixed team sizes

---

## 📝 For Developers

When creating puzzles:

```typescript
// CORRECT: Solo puzzle
const puzzle = await prisma.puzzle.create({
  data: {
    title: "Daily Riddle",
    isTeamPuzzle: false,
    minTeamSize: 1,
    // ... Add 1 part
  }
});

// CORRECT: Team puzzle
const puzzle = await prisma.puzzle.create({
  data: {
    title: "Team ARG",
    isTeamPuzzle: true,
    minTeamSize: 1,
    // ... Add 5+ parts
  }
});

// CORRECT: Strict team puzzle
const puzzle = await prisma.puzzle.create({
  data: {
    title: "Epic Dungeon (Future)",
    isTeamPuzzle: true,
    minTeamSize: 10, // Future feature
    // ... Add 10 parts
  }
});
```

---

**These constraints ensure fair, balanced, and engaging team gameplay!**
