# Team Puzzle Integration Architecture

## System Overview

The team puzzle collaboration system extends the existing puzzle and achievement systems with fair, transparent team-based problem solving.

### **Integration Points**

```
┌─────────────────────────────────────────────────────────┐
│                  Kryptyk Labs Platform                   │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────┐  ┌──────────────────┐            │
│  │  Achievement      │  │  Puzzle System   │            │
│  │  System           │  │  - Individual    │            │
│  │  - Points Earn    │  │  - Team (NEW)    │            │
│  │  - Streak Track   │  │    - Part-based  │            │
│  │  - Unlocking      │  │    - Assignment  │            │
│  │  - Social Butter  │  │    - Submission  │            │
│  └──────────────────┘  └──────────────────┘            │
│         ▲                        ▲                       │
│         │                        │                       │
│         └────────────┬───────────┘                       │
│                      │                                   │
│         ┌────────────▼────────────┐                     │
│         │  User Puzzle Progress   │                     │
│         │  (marked solved + pts)  │                     │
│         └────────────┬────────────┘                     │
│                      │                                   │
│         ┌────────────▼──────────────────────┐           │
│         │  Team Puzzle Models (NEW)         │           │
│         │  - Assignments                    │           │
│         │  - Submissions                    │           │
│         │  - Completions                    │           │
│         └───────────────────────────────────┘           │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## Database Layer Integration

### **New Models**
```
TeamPuzzlePartAssignment
  ├── teamId → Team
  ├── puzzleId → Puzzle
  ├── partId → PuzzlePart
  └── assignedToUserId → User

TeamPuzzlePartSubmission
  ├── teamId → Team
  ├── puzzleId → Puzzle
  ├── partId → PuzzlePart
  ├── submittedByUserId → User
  └── stores: answer, isCorrect, attempts, solvedAt

TeamPuzzleCompletion
  ├── teamId → Team
  ├── puzzleId → Puzzle
  └── totalPointsEarned
```

### **Modified Models**
```
Puzzle
  ├── isTeamPuzzle (Boolean) - NEW
  ├── minTeamSize (Int) - NEW
  ├── partAssignments → TeamPuzzlePartAssignment[] - NEW
  ├── partSubmissions → TeamPuzzlePartSubmission[] - NEW
  └── completions → TeamPuzzleCompletion[] - NEW

Team
  ├── puzzleAssignments → TeamPuzzlePartAssignment[] - NEW
  ├── puzzleSubmissions → TeamPuzzlePartSubmission[] - NEW
  └── puzzleCompletions → TeamPuzzleCompletion[] - NEW

User
  ├── puzzlePartAssignments → TeamPuzzlePartAssignment[] - NEW
  └── puzzlePartSubmissions → TeamPuzzlePartSubmission[] - NEW

PuzzlePart
  ├── assignments → TeamPuzzlePartAssignment[] - NEW
  └── submissions → TeamPuzzlePartSubmission[] - NEW
```

---

## API Layer Integration

### **Submission Flow**

```
POST /api/team/puzzles/submit-part
  ↓
  ├─ Validate user is team member
  ├─ Verify part assigned to user
  ├─ Extract answer
  ├─ Check against PuzzlePartSolution
  ├─ Create TeamPuzzlePartSubmission
  │
  └─ If correct:
     ├─ Check if ALL parts solved
     │
     └─ If complete:
        ├─ Create TeamPuzzleCompletion
        ├─ For each team member:
        │  ├─ Create/update UserPuzzleProgress
        │  ├─ Set solved=true, pointsEarned=totalPts
        │  └─ Trigger achievement checks
        └─ Return: teamPuzzleComplete: true
```

### **Achievement Integration**

When a team completes a puzzle:
```
TeamPuzzleCompletion.create()
  ↓
For each team member:
  ├─ UserPuzzleProgress.update(solved=true)
  ├─ Increment puzzlesSolved count
  ├─ Add totalPointsEarned to cumulative
  └─ GET /api/user/achievements
     ├─ Check puzzles_solved condition
     ├─ Check points_earned condition
     ├─ Unlock matching achievements
     └─ Return progress for each achievement
```

---

## Component Architecture

### **Component Hierarchy**

```
TeamPuzzlePageLayout
  ├─ Header with puzzle info
  └─ AdminSection
     └─ AssignPuzzleParts (if admin)
        ├─ Renders part-to-member dropdowns
        ├─ Shows assignment summary
        └─ OnSave → fetch /api/team/puzzles/assign-parts POST
  
  └─ MemberSection
     └─ TeamPuzzleParts
        ├─ Displays all parts with assignment info
        ├─ Part selector buttons
        ├─ Part content viewer
        ├─ Answer submission form
        ├─ Team progress tracker
        └─ OnSubmit → fetch /api/team/puzzles/submit-part POST
```

### **State Management**

Each component uses local React state + fetch hooks:
```
TeamPuzzleParts
  ├─ assignments (Map<partId, assignment>)
  ├─ submissions (Map<partId, result>)
  ├─ completed (Boolean)
  ├─ selectedPartId (String)
  ├─ answer (String)
  └─ submitting (Boolean)
```

Hooks:
```
useTeamPuzzle()
  ├─ loading, error state
  ├─ assignParts(teamId, puzzleId, assignments)
  ├─ submitPart(teamId, puzzleId, partId, answer)
  ├─ getStatus(teamId, puzzleId)
  └─ getAssignments(teamId, puzzleId)
```

---

## Authorization & Security

### **Authentication**
- All endpoints require valid NextAuth session
- Session extracted via `getServerSession(authOptions)`
- User ID verified from session

### **Authorization**

| Action | Required Permission | Checked Via |
|--------|-------------------|------------|
| Assign parts | Team admin role | TeamMember.role in ["admin", "moderator"] |
| Submit part | Part assigned to user | TeamPuzzlePartAssignment lookup |
| View puzzle | Team membership | TeamMember exists for user+team |
| View assignments | Team membership | Same as above |
| View status | Team membership | Same as above |

### **Data Validation**

**Input Validation:**
- Check required fields present
- Verify IDs exist and belong to correct resources
- Validate answer format (string)

**Business Logic Validation:**
- Ensure team exists and user is member
- Ensure puzzle exists and is marked as team puzzle
- Ensure part belongs to puzzle
- Ensure assignment exists before submission
- Verify puzzle part solution exists

---

## Answer Validation System

Reuses existing `PuzzlePartSolution` model for validation:

```
Answer Checking Algorithm:
  ├─ Get all PuzzlePartSolution records for part
  ├─ For each solution:
  │  ├─ If ignoreCase: convert both to lowercase
  │  ├─ If ignoreWhitespace: remove all whitespace
  │  ├─ If isRegex:
  │  │  ├─ Compile as RegExp
  │  │  ├─ Test against user answer
  │  │  └─ If match: return { isCorrect: true, points }
  │  │
  │  └─ Else:
  │     ├─ Direct string comparison
  │     └─ If equal: return { isCorrect: true, points }
  │
  └─ If no match: return { isCorrect: false, points: 0 }
```

This means all existing answer validation rules apply to team puzzle parts automatically.

---

## Points Distribution Logic

### **When Team Completes Puzzle**

```
1. Get all PuzzlePart records for puzzle
2. Calculate totalPoints = sum(part.pointsValue for all parts)
3. Create TeamPuzzleCompletion(totalPoints)
4. For each team member:
   - Create UserPuzzleProgress:
     └─ pointsEarned = totalPoints
        (This is the key: each member gets FULL points, not split)
5. Achievement checks trigger for each member
   - They all have same pointsEarned increment
   - They all unlock point-based achievements together
```

**Why Full Points Per Member?**
- Encourages team collaboration
- Prevents point fragmentation
- Fair distribution (each member contributed their part)
- Aligns with Social Butterfly philosophy (team benefits together)

---

## Real-Time Status Tracking

### **Polling Strategy**

The `TeamPuzzleParts` component polls status via:
```typescript
useEffect(() => {
  const loadData = async () => {
    const status = await getStatus(teamId, puzzleId);
    setSubmissions(buildMap(status.submissions));
    setCompleted(status.completed);
  };
  loadData();
}, [teamId, puzzleId]);
```

On submit:
```typescript
const result = await submitPart(...);
if (result.success) {
  // Update local state immediately
  // Component re-renders showing new status
  // No need for additional fetch
}
```

---

## Error Handling Strategy

### **Client Side**
```
Try/catch blocks around all fetch calls
├─ Network errors → generic "Failed to..." message
├─ API errors → specific error from response
├─ Validation errors → field-specific messages
└─ Success → show success message or redirect
```

### **Server Side**
```
try {
  // Validate inputs
  // Check permissions
  // Perform operations
  return NextResponse.json(data, {status: 201})
} catch (error) {
  console.error("Error context:", error)
  return NextResponse.json(
    {error: "User-friendly message"},
    {status: 500}
  )
}
```

---

## Performance Considerations

### **Database Queries**

**Part Assignment Fetch:**
```
Single query: findMany with includes
Time: O(assignments) ≈ 10-100 assignments max
```

**Status Check:**
```
3 queries:
  - findMany submissions
  - findMany assignments
  - findFirst completion
Time: O(submissions + assignments) ≈ fast
```

**Submission:**
```
2-6 queries:
  - findFirst assignment
  - findMany solutions
  - create submission
  - optionally: findMany/delete/create for all parts
Time: Depends on puzzle size, generally <100ms
```

### **Optimization Tips**

1. **Don't refetch after every submit** - return status in response
2. **Cache assignments** - they rarely change mid-puzzle
3. **Batch status checks** - combine pagination if needed
4. **Use indexes** - all major queries have indexes defined

---

## Testing Strategy

### **Unit Tests**
- Answer validation logic
- Points calculation
- Part completion detection

### **Integration Tests**
- Full submission flow
- Multi-member completions
- Achievement triggering

### **E2E Tests**
- Create team
- Create puzzle with parts
- Assign members
- Submit answers
- Verify all members get points/achievements

---

## Future Enhancements

1. **Timed Challenges** - Race against the clock
2. **Hints for Teams** - Shared hints that affect all members
3. **Difficulty Scaling** - Parts worth different points
4. **Communication** - In-puzzle chat
5. **Replay System** - Watch past solutions
6. **Analytics** - Team statistics and patterns
7. **Tournaments** - Multiple teams competing

---

## Migration & Deployment

### **Step 1: Apply Migration**
```bash
npx prisma migrate deploy
```

### **Step 2: Generate Types**
```bash
npx prisma generate
```

### **Step 3: Create Team Puzzles**
```typescript
// Mark existing puzzles or create new ones
await prisma.puzzle.update({
  where: { id: puzzleId },
  data: { isTeamPuzzle: true, minTeamSize: 2 }
})
```

### **Step 4: Add Components to Pages**
```tsx
import { TeamPuzzleParts } from "@/components/puzzle/TeamPuzzleParts"
import { AssignPuzzleParts } from "@/components/puzzle/AssignPuzzleParts"
```

### **Step 5: Test End-to-End**
- Create test team and puzzle
- Verify assignments work
- Verify submissions work
- Verify completions trigger achievements

---

## Backwards Compatibility

✅ **Existing puzzles unaffected** - `isTeamPuzzle` defaults to false  
✅ **Individual puzzles still work** - No breaking changes  
✅ **Achievements still work** - New completion type added, existing logic unchanged  
✅ **Points system intact** - Team puzzles just use existing system  

---

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Team Puzzle System                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Frontend Components:                                            │
│  ┌─────────────────────────┐  ┌──────────────────────────────┐  │
│  │ AssignPuzzleParts       │  │ TeamPuzzleParts             │  │
│  │ (Admin View)            │  │ (Member View)               │  │
│  │ - Select members        │  │ - Display parts             │  │
│  │ - Assign parts          │  │ - Show assignments          │  │
│  │ - Save to DB            │  │ - Submit answers            │  │
│  └────────┬────────────────┘  │ - Track progress            │  │
│           │                    └──────────┬───────────────────┘  │
│           │ POST               │           │ POST                │
│           │ /assign-parts      │           │ /submit-part       │
│  ┌────────▼────────────────────▼──────────────┐                 │
│  │        API Routes (Route Handlers)         │                 │
│  │ ┌────────────────────────────────────────┐ │                 │
│  │ │ /api/team/puzzles/assign-parts        │ │                 │
│  │ │ ├─ POST: Save assignments             │ │                 │
│  │ │ └─ GET: Fetch current assignments     │ │                 │
│  │ └────────────────────────────────────────┘ │                 │
│  │ ┌────────────────────────────────────────┐ │                 │
│  │ │ /api/team/puzzles/submit-part         │ │                 │
│  │ │ ├─ POST: Submit and validate answer   │ │                 │
│  │ │ └─ GET: Get puzzle completion status  │ │                 │
│  │ └────────────────────────────────────────┘ │                 │
│  └──────────────────┬──────────────────────────┘                 │
│                     │                                             │
│  ┌──────────────────▼──────────────────────────┐                 │
│  │    Database Operations (Prisma)            │                 │
│  │ ┌──────────────────────────────────────┐   │                 │
│  │ │ Create/Update/Find Assignments      │   │                 │
│  │ └──────────────────────────────────────┘   │                 │
│  │ ┌──────────────────────────────────────┐   │                 │
│  │ │ Create Submissions (with validation)│   │                 │
│  │ └──────────────────────────────────────┘   │                 │
│  │ ┌──────────────────────────────────────┐   │                 │
│  │ │ Create Completions (all parts done) │   │                 │
│  │ │ + Update UserPuzzleProgress         │   │                 │
│  │ │ + Trigger Achievement Checks       │   │                 │
│  │ └──────────────────────────────────────┘   │                 │
│  └──────────────────┬──────────────────────────┘                 │
│                     │                                             │
│  ┌──────────────────▼──────────────────────────┐                 │
│  │       PostgreSQL Database Tables           │                 │
│  │ ┌──────────────────────────────────────┐   │                 │
│  │ │ team_puzzle_part_assignments        │   │                 │
│  │ │ team_puzzle_part_submissions        │   │                 │
│  │ │ team_puzzle_completions             │   │                 │
│  │ └──────────────────────────────────────┘   │                 │
│  └──────────────────────────────────────────────┘                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Summary

The team puzzle system is fully integrated with:
- ✅ Existing puzzle infrastructure
- ✅ Existing achievement system
- ✅ User progress tracking
- ✅ Points distribution
- ✅ Authentication & authorization

All components work seamlessly together to provide a complete team collaboration experience!
