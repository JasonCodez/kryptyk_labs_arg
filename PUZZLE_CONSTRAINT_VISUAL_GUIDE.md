# Puzzle Constraint System - Visual Guide

## 🎯 The Three Rules at a Glance

### Rule 1: Solo Puzzles Only
```
Single-Part Puzzle
│
├─ isTeamPuzzle = false ✅ VALID
│
└─ isTeamPuzzle = true ❌ INVALID
   Error: "Single-step puzzles are solo only"
```

### Rule 2: Team Size = Parts Count
```
5-Part Team Puzzle
│
├─ 1 member ✅ Valid (solves all parts)
├─ 2 members ✅ Valid (split among 5)
├─ 3 members ✅ Valid (split among 5)
├─ 4 members ✅ Valid (split among 5)
├─ 5 members ✅ Valid (one per part)
│
└─ 6 members ❌ INVALID
   Error: "Maximum 5 members allowed. Remove 1."
```

### Rule 3: Minimum Team Size
```
10-Part Puzzle (minTeamSize: 8)
│
├─ 5 members ❌ INVALID
│  Error: "Requires at least 8 members. Add 3."
├─ 6 members ❌ INVALID
│  Error: "Requires at least 8 members. Add 2."
├─ 7 members ❌ INVALID
│  Error: "Requires at least 8 members. Add 1."
│
├─ 8 members ✅ Valid
├─ 9 members ✅ Valid
├─ 10 members ✅ Valid
│
└─ 11 members ❌ INVALID
   Error: "Maximum 10 members allowed. Remove 1."
```

---

## 🔄 Validation Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│      User Attempts to Play Puzzle                   │
└──────────────────────┬────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  Component Mounts            │
        │  (TeamPuzzleParts /          │
        │   AssignPuzzleParts)         │
        └────────────┬─────────────────┘
                     │
                     ▼
        ┌──────────────────────────────┐
        │  Call Validation Endpoint    │
        │  GET /api/.../validate       │
        └────────────┬─────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
    ┌─────────────┐      ┌──────────────┐
    │  Errors?    │      │  No Errors   │
    │     YES     │      │     OK       │
    └──────┬──────┘      └──────┬───────┘
           │                    │
           ▼                    ▼
    ┌──────────────┐     ┌─────────────┐
    │ Show Error   │     │ Enable      │
    │ Message      │     │ Puzzle      │
    │ Block Access │     │ Interaction │
    └──────────────┘     └──────┬──────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │ User Plays Puzzle      │
                    │ - Assigns parts        │
                    │ - Submits answers      │
                    └────────────────────────┘
```

---

## 📊 Puzzle Type Decision Tree

```
Do you have multiple steps/parts?
│
├─ NO (1 part only)
│  │
│  └─ Set isTeamPuzzle = false
│     └─ Solo Puzzle ✅
│        (Team members can play independently)
│
└─ YES (2+ parts)
   │
   ├─ Want team collaboration?
   │  │
   │  ├─ NO
   │  │  └─ Set isTeamPuzzle = false
   │  │     └─ Multi-part Solo ✅
   │  │        (Each member solves independently)
   │  │
   │  └─ YES
   │     │
   │     ├─ Set isTeamPuzzle = true ✅
   │     │
   │     ├─ Set maxTeamSize = number of parts
   │     │
   │     └─ Optional: Set minTeamSize > 1
   │        └─ Team Puzzle ✅
   │           (Members split the parts)
```

---

## 🎮 Example Puzzle Scenarios

### Scenario 1: Daily Riddle
```
PUZZLE CONFIG:
  Title: "Daily Riddle"
  Parts: 1
  isTeamPuzzle: false
  minTeamSize: 1

TEAM COMPOSITIONS:
  ✅ 1 member
  ✅ 2 members
  ✅ 5 members
  ✅ Any size

REASON: Solo puzzles work with any team size
        (Each member solves independently)
```

### Scenario 2: 5-Step Quest
```
PUZZLE CONFIG:
  Title: "5-Step Quest"
  Parts: 5
  isTeamPuzzle: true
  minTeamSize: 1

TEAM COMPOSITIONS:
  ✅ 1 member (solves all 5)
  ✅ 2 members (split 5 parts)
  ✅ 3 members (split 5 parts)
  ✅ 4 members (split 5 parts)
  ✅ 5 members (one per part)
  ❌ 6 members (too many!)

ERROR FOR 6+: "Maximum 5 members allowed"
```

### Scenario 3: Epic Raid
```
PUZZLE CONFIG:
  Title: "Epic Boss Raid"
  Parts: 10
  isTeamPuzzle: true
  minTeamSize: 8

TEAM COMPOSITIONS:
  ❌ 1-7 members (too few!)
  ✅ 8 members (minimum met)
  ✅ 9 members (split 10 parts)
  ✅ 10 members (one per part)
  ❌ 11+ members (too many!)

ERROR FOR <8: "Requires at least 8 members"
ERROR FOR >10: "Maximum 10 members allowed"
```

---

## 🔍 Validation Endpoint Response Examples

### ✅ Valid Response
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

### ❌ Error Response: Too Many Members
```json
{
  "isSoloPuzzle": false,
  "isTeamPuzzle": true,
  "partCount": 3,
  "teamSize": 7,
  "minTeamSize": 1,
  "canAttempt": false,
  "errors": [
    "Team has 7 members but puzzle only has 3 parts. 
     Maximum 3 unique team members allowed (one per part). 
     Remove 4 members."
  ]
}
```

### ❌ Error Response: Solo Puzzle as Team
```json
{
  "isSoloPuzzle": true,
  "isTeamPuzzle": false,
  "partCount": 1,
  "teamSize": 3,
  "minTeamSize": 1,
  "canAttempt": true,
  "errors": []
}
```

---

## 📱 Component Integration

### TeamPuzzleParts Component
```
┌────────────────────────────────┐
│  Mount Component               │
└────────────┬───────────────────┘
             │
             ▼
┌────────────────────────────────┐
│  Call: validatePuzzle()        │
│  GET /api/.../validate         │
└────────────┬───────────────────┘
             │
   ┌─────────┴──────────┐
   │                    │
   ▼                    ▼
Error?              No Error?
   │                    │
   ▼                    ▼
Show:              Show:
"❌ Cannot        "✅ Puzzle
Attempt"          Available"
   │                    │
   ▼                    ▼
Block             Allow
Access            Interaction
```

### AssignPuzzleParts Component
```
┌────────────────────────────────┐
│  Mount Component               │
└────────────┬───────────────────┘
             │
             ▼
┌────────────────────────────────┐
│  Call: validatePuzzle()        │
└────────────┬───────────────────┘
             │
   ┌─────────┴──────────┐
   │                    │
   ▼                    ▼
Error?              No Error?
   │                    │
   ▼                    ▼
Show Error          Show:
Banner              "Assign
              Members to Parts"
   │                    │
   ▼                    ▼
Show Why            Allow
Can't Assign        Assignment
```

---

## 🎯 Decision Flowchart

```
START
  │
  ├─ 1 Part?
  │  │
  │  ├─ YES → Solo Puzzle
  │  │        isTeamPuzzle = false ✅
  │  │
  │  └─ NO → Multi-Part Puzzle
  │
  ├─ Want Team Collaboration?
  │  │
  │  ├─ NO → Solo Mode
  │  │        isTeamPuzzle = false ✅
  │  │
  │  └─ YES → Team Mode
  │
  ├─ Set isTeamPuzzle = true ✅
  │
  ├─ Set maxTeamSize = partCount ✅
  │
  ├─ Need Minimum Members?
  │  │
  │  ├─ NO → minTeamSize = 1 ✅
  │  │
  │  └─ YES → minTeamSize = X ✅
  │
  └─ Puzzle Ready! ✅
```

---

## 🔒 Security Layers

```
┌─────────────────────────────────┐
│  Layer 1: Component Level       │
│  - Real-time feedback           │
│  - User-friendly errors         │
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│  Layer 2: API Level             │
│  - Server-side validation       │
│  - Cannot be bypassed           │
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│  Layer 3: Database Level        │
│  - Constraints on schema        │
│  - Final safety net             │
└─────────────────────────────────┘
```

---

## 📋 Error Message Translation

| Error | Meaning | Action |
|-------|---------|--------|
| "Single-step puzzles are solo only" | 1-part puzzle can't be team | Change `isTeamPuzzle` to false |
| "Maximum X members allowed" | Too many team members | Remove `X - partCount` members |
| "Requires at least X members" | Too few team members | Add `X - teamSize` members |
| "Puzzle not found" | Invalid puzzle ID | Check puzzle exists |
| "Not a team member" | User not in team | Verify team membership |

---

## ✨ Key Concepts

### Max Team Size Formula
```
Max Team Size = Number of Puzzle Parts

Examples:
- 1-part puzzle → max 1 member (solo)
- 3-part puzzle → max 3 members
- 5-part puzzle → max 5 members
- 10-part puzzle → max 10 members
```

### Min Team Size Flexibility
```
Min Team Size = Configurable per puzzle

Examples:
- Daily Riddle → minTeamSize: 1 (any size ok)
- Normal Quest → minTeamSize: 1 (any size ok)
- Epic Raid → minTeamSize: 8 (need 8+ members)
```

---

**Visual Guide Complete ✅**  
For detailed info, see implementation guides in documentation folder.
