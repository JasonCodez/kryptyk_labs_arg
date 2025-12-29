# Team Puzzle Implementation Quick Start

## 🚀 Quick Summary

Option 2: Split Puzzles has been fully implemented! Here's what's ready to use:

### **What Works**
✅ Database models and migrations applied  
✅ API endpoints for part assignment and submission  
✅ React components for UI display  
✅ Real-time status tracking  
✅ Automatic point distribution to all team members  
✅ Achievement triggers on completion  

### **How It Works**
1. **Create**: Mark a puzzle as `isTeamPuzzle: true` and add `PuzzlePart` records
2. **Assign**: Team admin assigns each part to a team member using `AssignPuzzleParts` component
3. **Solve**: Each member solves their part using `TeamPuzzleParts` component
4. **Complete**: When all parts solved, team earns points and achievements

---

## 📋 Database Setup

The migration has already been applied. Verify with:
```bash
npx prisma migrate status
```

If needed, reset and reapply:
```bash
npx prisma migrate reset --force
```

---

## 🛠️ To Use in Your Pages

### **Option A: Show Team Puzzle (Member View)**

In your puzzle page component:

```tsx
"use client";
import { TeamPuzzleParts } from "@/components/puzzle/TeamPuzzleParts";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

export default function TeamPuzzlePage({ params }) {
  const { data: session } = useSession();
  const [puzzle, setPuzzle] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [isTeamAdmin, setIsTeamAdmin] = useState(false);

  useEffect(() => {
    // Fetch puzzle with parts
    // Fetch team members
    // Check if current user is admin
  }, [params.puzzleId, params.teamId]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1>{puzzle?.title}</h1>
      
      {puzzle?.isTeamPuzzle ? (
        <TeamPuzzleParts
          teamId={params.teamId}
          puzzleId={params.puzzleId}
          puzzleParts={puzzle.parts}
          teamMembers={teamMembers}
          currentUserId={session?.user?.id}
          isTeamAdmin={isTeamAdmin}
        />
      ) : (
        <div>Individual puzzle view...</div>
      )}
    </div>
  );
}
```

### **Option B: Admin Assignment Setup**

In your team settings page:

```tsx
"use client";
import { AssignPuzzleParts } from "@/components/puzzle/AssignPuzzleParts";
import { useState, useEffect } from "react";

export default function PuzzleAssignmentPage({ params }) {
  const [puzzle, setPuzzle] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2>Assign Team Members to Puzzle Parts</h2>
      
      <AssignPuzzleParts
        teamId={params.teamId}
        puzzleId={params.puzzleId}
        puzzleParts={puzzle?.parts}
        teamMembers={teamMembers}
        onAssignmentsChanged={() => {
          // Refetch assignments or show success message
        }}
      />
    </div>
  );
}
```

---

## 📚 API Usage Examples

### **Programmatically Assign Parts**

```typescript
const response = await fetch("/api/team/puzzles/assign-parts", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    teamId: "team_123",
    puzzleId: "puzzle_456",
    assignments: [
      { partId: "part_1", assignedToUserId: "user_alice" },
      { partId: "part_2", assignedToUserId: "user_bob" },
      { partId: "part_3", assignedToUserId: "user_charlie" },
    ],
  }),
});

const result = await response.json();
console.log("Assignments:", result.assignments);
```

### **Get Current Assignments**

```typescript
const response = await fetch(
  `/api/team/puzzles/assign-parts?teamId=team_123&puzzleId=puzzle_456`
);
const { assignments } = await response.json();
console.log("Current assignments:", assignments);
```

### **Submit a Part Answer**

```typescript
const response = await fetch("/api/team/puzzles/submit-part", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    teamId: "team_123",
    puzzleId: "puzzle_456",
    partId: "part_1",
    answer: "user_answer",
  }),
});

const result = await response.json();
if (result.teamPuzzleComplete) {
  console.log("🎉 Team puzzle completed!");
} else {
  console.log("✓ Part solved, waiting for others...");
}
```

### **Check Team Puzzle Status**

```typescript
const response = await fetch(
  `/api/team/puzzles/submit-part?teamId=team_123&puzzleId=puzzle_456`
);
const { submissions, assignments, completed, totalPoints } = 
  await response.json();

submissions.forEach((sub) => {
  console.log(`${sub.submittedByUser.name}: Part ${sub.part.title} - 
    ${sub.isCorrect ? "✓ Solved" : "❌ Incorrect"} (${sub.attempts} attempts)`);
});
```

---

## 🧪 Example Puzzle Creation

```typescript
// Create a team puzzle
const puzzle = await prisma.puzzle.create({
  data: {
    title: "Ancient Cipher Collaboration",
    description: "Work together to decode this ancient message",
    content: "<p>Your team receives an encrypted message...</p>",
    isTeamPuzzle: true,
    minTeamSize: 2,
    categoryId: category.id,
    difficulty: "medium",
    rarity: "rare",
  },
});

// Add parts
await prisma.puzzlePart.create({
  data: {
    puzzleId: puzzle.id,
    title: "Decode the First Section",
    content: "<p>Analyze these symbols: ⚬ ⬟ ◆ ⬢</p>",
    order: 0,
    pointsValue: 50,
  },
});

await prisma.puzzlePart.create({
  data: {
    puzzleId: puzzle.id,
    title: "Decode the Second Section",
    content: "<p>Now work on these: ◈ ⬥ ◇ ⬤</p>",
    order: 1,
    pointsValue: 50,
  },
});

// Assign to team members
await fetch("/api/team/puzzles/assign-parts", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    teamId: "my_team",
    puzzleId: puzzle.id,
    assignments: [
      { partId: part1.id, assignedToUserId: userId1 },
      { partId: part2.id, assignedToUserId: userId2 },
    ],
  }),
});
```

---

## 🎯 User Flow

### **For Team Members**
1. Navigate to team puzzle page
2. See their assigned part(s) highlighted
3. Read the puzzle content
4. Enter their answer
5. Click "Submit Answer"
6. If correct → see "✓ Part solved! Waiting for others..."
7. When all parts solved → "🎉 Team puzzle completed!"
8. All members get points and achievement credit

### **For Team Admins**
1. Create a puzzle with `isTeamPuzzle: true`
2. Add multiple `PuzzlePart` records
3. Navigate to puzzle assignment page
4. Use assignment UI to assign each part
5. Save assignments
6. Team can now work on the puzzle

---

## ✅ Verification Checklist

- [ ] Puzzle created with `isTeamPuzzle: true`
- [ ] PuzzlePart records created for each section
- [ ] `AssignPuzzleParts` component used to assign members
- [ ] `TeamPuzzleParts` component displayed to team
- [ ] Team members can see their assigned part
- [ ] Team members can submit answers
- [ ] System validates answers correctly
- [ ] Team progress updates in real-time
- [ ] When all parts solved, team gets completion message
- [ ] All team members receive points in UserPuzzleProgress
- [ ] Achievements trigger for all members

---

## 🐛 Troubleshooting

### **"Property 'isTeamPuzzle' does not exist"**
→ Run `npx prisma generate` to update types

### **"You are not assigned to this puzzle part"**
→ Make sure assignment was created via `/api/team/puzzles/assign-parts`

### **Puzzle shows but no assignments**
→ Check if assignments exist: `GET /api/team/puzzles/assign-parts?teamId=X&puzzleId=Y`

### **Answer marked incorrect when it should be correct**
→ Verify PuzzlePartSolution has correct answer and matching rules set

### **Points not awarded to team**
→ Check TeamPuzzleCompletion record created
→ Check UserPuzzleProgress updated for all members

---

## 📊 Data Model Reference

```
Team
├── TeamPuzzlePartAssignment (one assignment per part)
│   ├── PuzzlePart
│   ├── User (assignedToUser)
│   └── Puzzle
├── TeamPuzzlePartSubmission (many per part)
│   ├── PuzzlePart
│   ├── User (submittedByUser)
│   ├── answer (String)
│   ├── isCorrect (Boolean)
│   └── attempts (Int)
└── TeamPuzzleCompletion (one per completed puzzle)
    ├── Puzzle
    └── totalPointsEarned (Int)

User
├── UserPuzzleProgress (marked solved when team completes)
└── UserAchievement (triggered when team completes)
```

---

## 🎓 Key Design Decisions

1. **Part Assignment**: Fixed assignment (not changeable mid-puzzle) prevents chaos
2. **All Members Get Credit**: Encourages real teamwork, prevents free-riding
3. **Independent Submissions**: Each member submits their own answer (can't be done for them)
4. **Flexible Distribution**: Can assign 1:1 or multiple parts to same member
5. **Order Independent**: Parts can be solved in any order
6. **Immediate Feedback**: Results shown immediately, no delay

---

## 🚀 You're All Set!

The team puzzle system is fully implemented and ready to use. All files are in place, the database is migrated, and the components are ready to drop into your pages.

**Questions? Check TEAM_PUZZLE_COLLABORATION.md for full documentation.**
