# Team Puzzle System - Visual Flow & Examples

## 🎯 User Journey

### Team Member Solving a Puzzle

```
1. BROWSE TEAM PUZZLES
   ├─ See available team puzzles
   ├─ Check team requirements (min 2 members)
   └─ View puzzle description

2. ENTER PUZZLE
   ├─ See assigned puzzle parts
   ├─ See which member assigned to each part
   └─ See your part highlighted

3. SOLVE YOUR PART
   ├─ Read part content
   ├─ Understand requirements
   ├─ Enter your answer
   └─ Click "Submit Answer"

4. WAIT FOR OTHERS
   ├─ See "✓ Part Solved!" message
   ├─ View team progress
   ├─ See other members' parts (solved/pending)
   └─ Waiting for remaining members...

5. CELEBRATION
   ├─ All parts solved!
   ├─ "🎉 Team puzzle completed!"
   ├─ Points awarded to all members
   ├─ Achievements unlocked
   └─ Success notification sent
```

### Team Admin Setup

```
1. CREATE PUZZLE
   └─ New puzzle with isTeamPuzzle: true

2. ADD PARTS
   ├─ Part 1: "Analyze the first clue"
   ├─ Part 2: "Decode the second clue"
   └─ Part 3: "Combine for final answer"

3. NAVIGATE TO ASSIGNMENT PAGE
   └─ See "Assign Team Members to Parts"

4. ASSIGN MEMBERS
   ├─ Part 1 → Alice
   ├─ Part 2 → Bob
   └─ Part 3 → Charlie

5. SAVE ASSIGNMENTS
   ├─ Assignments saved
   └─ Team ready to solve!
```

---

## 📊 Data Flow Diagrams

### Submission Flow

```
┌──────────────────────────────────────────────────────────┐
│               TEAM MEMBER SUBMITS ANSWER                 │
└─────────────────────┬──────────────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────┐
        │ POST /submit-part           │
        │ {teamId, puzzleId, partId,  │
        │  answer}                    │
        └────────────┬────────────────┘
                     │
        ┌────────────▼────────────────┐
        │ 1. Verify team membership   │
        │ 2. Check part assignment    │
        │ 3. Get answer solutions     │
        │ 4. Validate answer          │
        └────────────┬────────────────┘
                     │
         ┌───────────┴────────────┐
         │                        │
    ❌ WRONG              ✅ CORRECT
         │                        │
         ▼                        ▼
    ┌─────────────────┐   ┌────────────────────┐
    │ Increment       │   │ Mark part solved   │
    │ attempts        │   │ Create submission  │
    │ Return error    │   │ Check all parts    │
    │ message         │   │ solved?            │
    └─────────────────┘   └──────────┬─────────┘
                                     │
                         ┌───────────┴──────────────┐
                         │                          │
                    ❌ NO                      ✅ YES
                         │                          │
                         ▼                          ▼
                  ┌──────────────┐    ┌────────────────────────┐
                  │ Return:      │    │ 1. Create completion   │
                  │ "Waiting for │    │ 2. Award all members   │
                  │ others..."   │    │ 3. Award achievements  │
                  └──────────────┘    │ 4. Send notifications  │
                                      │ 5. Return success      │
                                      └────────────────────────┘
```

### Points Distribution

```
PUZZLE WITH 3 PARTS
├─ Part 1: 50 points
├─ Part 2: 50 points
└─ Part 3: 50 points
   TOTAL: 150 points

TEAM WITH 3 MEMBERS
├─ Alice assigned Part 1
├─ Bob assigned Part 2
└─ Charlie assigned Part 3

WHEN ALL PARTS SOLVED:
├─ Alice gets 150 points
├─ Bob gets 150 points
└─ Charlie gets 150 points
   (Each member gets FULL amount!)

ACHIEVEMENTS TRIGGERED:
├─ Each member's "puzzles_solved" +1
├─ Each member's "points_earned" +150
├─ Check for achievement unlocks
└─ All members notified
```

---

## 🎮 Interactive Example

### Scenario: "Decode Ancient Ruins"

**Setup:**
```
Team: "The Decoders"
Members: Alice, Bob, Charlie

Puzzle: "Decode Ancient Ruins" (Team Puzzle)
├─ Part 1: "Latin Inscription" (50 pts) → Alice
├─ Part 2: "Greek Symbols" (50 pts) → Bob
└─ Part 3: "Combined Message" (50 pts) → Charlie
```

**Timeline:**

```
T=0min  Alice enters puzzle
        ├─ Reads "Latin Inscription"
        ├─ Sees: "Encode: VENI"
        └─ Types answer: "came" → SUBMIT

T=1min  System validates "came"
        ├─ Checks PuzzlePartSolution
        ├─ Matches! ✓
        └─ Alice sees: "✓ Part Solved! Waiting for Bob and Charlie..."

T=3min  Bob enters puzzle
        ├─ Sees Alice's part is complete
        ├─ Reads "Greek Symbols"
        ├─ Sees: "Σ=200, Ω=800"
        └─ Types answer: "sum" → SUBMIT

T=4min  System validates "sum"
        ├─ Checks PuzzlePartSolution
        ├─ Matches! ✓
        └─ Bob sees: "✓ Part Solved! Waiting for Charlie..."

T=10min Charlie enters puzzle
        ├─ Sees Alice and Bob's parts complete
        ├─ Reads "Combined Message"
        ├─ Sees: "I CAME AND SUMMED"
        ├─ Realizes all parts must combine
        └─ Types answer: "came_sum" → SUBMIT

T=11min System validates "came_sum"
        ├─ Checks PuzzlePartSolution
        ├─ Matches! ✓
        ├─ ALL PARTS COMPLETE!
        │
        ├─ For Alice:
        │  ├─ UserPuzzleProgress.solved = true
        │  ├─ UserPuzzleProgress.pointsEarned = 150
        │  └─ Check achievements
        │
        ├─ For Bob:
        │  ├─ UserPuzzleProgress.solved = true
        │  ├─ UserPuzzleProgress.pointsEarned = 150
        │  └─ Check achievements
        │
        └─ For Charlie:
           ├─ UserPuzzleProgress.solved = true
           ├─ UserPuzzleProgress.pointsEarned = 150
           └─ Check achievements

T=11sec ALL TEAM MEMBERS SEE:
        🎉 "TEAM PUZZLE COMPLETED!"
        "The Decoders solved 'Decode Ancient Ruins'"
        "All members earned 150 points"
        "New achievements unlocked!"

RESULTS:
├─ Alice: +1 puzzle, +150 points
├─ Bob: +1 puzzle, +150 points
├─ Charlie: +1 puzzle, +150 points
├─ Team: Ranked on leaderboards
└─ Notifications: Sent to all members
```

---

## 🖥️ UI Mockups

### Member View

```
┌──────────────────────────────────────────────────┐
│ Decode Ancient Ruins                    TEAM    │
├──────────────────────────────────────────────────┤
│                                                  │
│ PUZZLE PARTS                                     │
│ ┌────────────────────────────────────────────┐  │
│ │ [●] Part 1: Latin Inscription        50pts│  │
│ │     Assigned to: You (Alice)               │  │
│ │     Status: ✓ Solved                      │  │
│ └────────────────────────────────────────────┘  │
│ ┌────────────────────────────────────────────┐  │
│ │ [ ] Part 2: Greek Symbols            50pts│  │
│ │     Assigned to: Bob                      │  │
│ │     Status: ✓ Solved                      │  │
│ └────────────────────────────────────────────┘  │
│ ┌────────────────────────────────────────────┐  │
│ │ [ ] Part 3: Combined Message         50pts│  │
│ │     Assigned to: Charlie                  │  │
│ │     Status: ⏳ Pending...                  │  │
│ └────────────────────────────────────────────┘  │
│                                                  │
│ TEAM PROGRESS                                    │
│ Alice: ✓ | Bob: ✓ | Charlie: ⏳                  │
│                                                  │
│ Your part is solved! Waiting for Charlie...     │
└──────────────────────────────────────────────────┘
```

### Admin View (Assignment)

```
┌──────────────────────────────────────────────────┐
│ Assign Team Members to Puzzle Parts              │
├──────────────────────────────────────────────────┤
│                                                  │
│ Part 1: Latin Inscription                        │
│ [Dropdown ▼] Select member...                    │
│   Alice                    ✓                     │
│                                                  │
│ Part 2: Greek Symbols                            │
│ [Dropdown ▼] Select member...                    │
│   Bob                      ✓                     │
│                                                  │
│ Part 3: Combined Message                         │
│ [Dropdown ▼] Select member...                    │
│   Charlie                  ✓                     │
│                                                  │
│ ┌────────────────────────────────────────────┐  │
│ │ Save Part Assignments                   [→]│  │
│ └────────────────────────────────────────────┘  │
│                                                  │
│ ASSIGNMENT SUMMARY                               │
│ Part 1 → Alice                                   │
│ Part 2 → Bob                                     │
│ Part 3 → Charlie                                 │
└──────────────────────────────────────────────────┘
```

---

## 🔄 State Transitions

### Puzzle Part States

```
                   ┌─────────────────────┐
                   │   NOT STARTED       │
                   │                     │
                   │ Member assigned     │
                   │ but no submission   │
                   └──────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │ Submit wrong answer │
                    └──────────┬──────────┘
                               │
                   ┌───────────▼────────────┐
                   │  ATTEMPTS IN PROGRESS  │
                   │                        │
                   │ Wrong answers logged   │
                   │ Member can retry       │
                   └────────────┬───────────┘
                                │
                    ┌───────────▼──────────┐
                    │ Submit correct answer│
                    └───────────┬──────────┘
                                │
                      ┌─────────▼────────┐
                      │    SOLVED! ✓    │
                      │                 │
                      │ Can't resubmit   │
                      │ Status locked    │
                      └─────────────────┘
```

### Team Puzzle States

```
    ┌────────────────────────┐
    │  NOT STARTED           │
    │                        │
    │ Parts assigned but     │
    │ none solved yet        │
    └──────────┬─────────────┘
               │
    ┌──────────▼──────────┐
    │ IN PROGRESS        │
    │                    │
    │ Some parts solved  │
    │ Some still pending │
    └──────────┬─────────┘
               │
    ┌──────────▼──────────────┐
    │ ALL COMPLETE! ✓        │
    │                        │
    │ All parts solved       │
    │ Points awarded         │
    │ Achievements unlocked  │
    │ Locked (no resubmit)   │
    └───────────────────────┘
```

---

## 💾 Database Record Examples

### TeamPuzzlePartAssignment

```
{
  id: "assign_12345",
  teamId: "team_decoders",
  puzzleId: "puzzle_ancient_ruins",
  partId: "part_latin",
  assignedToUserId: "user_alice",
  createdAt: "2024-12-29T10:00:00Z",
  updatedAt: "2024-12-29T10:00:00Z"
}
```

### TeamPuzzlePartSubmission

```
{
  id: "sub_67890",
  teamId: "team_decoders",
  puzzleId: "puzzle_ancient_ruins",
  partId: "part_latin",
  submittedByUserId: "user_alice",
  answer: "came",
  isCorrect: true,
  attempts: 1,
  solvedAt: "2024-12-29T10:05:00Z",
  createdAt: "2024-12-29T10:05:00Z"
}
```

### TeamPuzzleCompletion

```
{
  id: "comp_11111",
  teamId: "team_decoders",
  puzzleId: "puzzle_ancient_ruins",
  totalPointsEarned: 150,
  completedAt: "2024-12-29T10:11:00Z"
}
```

---

## 📈 Achievement Unlock Example

When team completes puzzle:

```
FOR ALICE:
├─ puzzles_solved: 1 → 2 ✓
├─ points_earned: 100 → 250
└─ Check achievements:
   ├─ "Puzzle Master" (10 puzzles) - progress: 2/10
   ├─ "Point Collector" (500 points) - progress: 250/500
   ├─ "Team Player" (2 team puzzles) - UNLOCKED! ✓
   └─ "Social Butterfly" (5 referrals) - progress: 3/5

FOR BOB:
├─ puzzles_solved: 3 → 4 ✓
├─ points_earned: 200 → 350
└─ Check achievements:
   ├─ "Puzzle Master" (10 puzzles) - progress: 4/10
   ├─ "Point Collector" (500 points) - progress: 350/500
   ├─ "Team Player" (2 team puzzles) - UNLOCKED! ✓
   └─ etc...

FOR CHARLIE:
├─ puzzles_solved: 1 → 2 ✓
├─ points_earned: 75 → 225
└─ Check achievements:
   ├─ "Puzzle Master" (10 puzzles) - progress: 2/10
   ├─ "Point Collector" (500 points) - progress: 225/500
   ├─ "Team Player" (2 team puzzles) - UNLOCKED! ✓
   └─ etc...

NOTIFICATIONS SENT:
├─ Alice: "🎉 You unlocked Team Player!"
├─ Bob: "🎉 You unlocked Team Player!"
└─ Charlie: "🎉 You unlocked Team Player!"
```

---

## 🎓 Key Takeaways

### What Makes It Fair
✅ **No free-riding** - each member must solve their part  
✅ **Transparent** - everyone sees who did what  
✅ **Equal reward** - all members get full points  
✅ **Individual accountability** - can't submit for others  
✅ **Team benefit** - puzzle is only complete when everyone contributes  

### How It Works
1. Admin creates puzzle with parts
2. Admin assigns each part to a team member
3. Members independently solve their part
4. When all solved → team gets full credit
5. All members receive points and achievements

### Why It's Better
- Prevents lazy members from benefiting
- Encourages genuine collaboration
- Fair credit distribution
- Motivates team participation
- Fun and engaging gameplay

---

**This visual guide should help everyone understand how team puzzles work!**
