# 🔍 Detective Agency Mystery - Interactive Witness Setup

## Quick Summary

The escape room system now supports **interactive dialogue** where players ask questions instead of just reading static text.

### New Interaction Types Available:

1. **`dialogue`** - Static dialogue (read-only, progressive)
2. **`interactive_dialogue`** - Q&A with witness (ask questions, extract info)
3. **`text_input`** - Player types answer to puzzle
4. **`multiple_choice`** - Select from options

---

## Setting Up Detective Agency with Interactive Witness

### Stage 0: Room 1 - Witness Interview (Interactive)

**In Admin Panel:**

1. **Title:** `Room 1: Witness Interview`
2. **Description:** `You're a detective. A witness has crucial information. Ask them questions about what they saw.`
3. **Puzzle Type:** `dialogue` (or leave blank)
4. **Interaction Type:** `interactive_dialogue` ← **KEY SETTING**
5. **Correct Answer:** `witness_heard`
6. **Reward Item:** `Witness Statement`
7. **Puzzle Data (in stage editor):**

```json
{
  "interactionType": "interactive_dialogue"
}
```

**What Happens:**
- Player sees `InteractiveWitness` component instead of static dialogue
- Player can ask questions like:
  - "Where did you see the suspect?"
  - "What time?"
  - "What did they look like?"
- Witness responds based on Q&A knowledge base
- System tracks extracted information
- **Location must be discovered** before "Proceed" button appears
- Player auto-advances to Room 2 when location is confirmed

---

### Stage 1: Room 2 - Evidence Analysis (Text Input)

**In Admin Panel:**

1. **Title:** `Room 2: Evidence Analysis`
2. **Description:** `Detective Martinez needs you to confirm the suspect's location from the witness testimony.`
3. **Puzzle Type:** `text_input`
4. **Interaction Type:** `text_input` (or omit)
5. **Correct Answer:** `warehouse`
6. **Puzzle Data:**

```json
{
  "dialogue": [
    {
      "speaker": "Detective",
      "text": "Based on the witness testimony, where was the suspect spotted?"
    }
  ]
}
```

**Why This Works:**
- Opens with dialogue asking about witness testimony
- Player must recall learning about the warehouse
- Connects Room 1 → Room 2 narrative

---

### Stage 2: Room 3 - Interrogation (Multiple Choice)

**In Admin Panel:**

1. **Title:** `Room 3: Suspect Interrogation`
2. **Description:** `You've found the suspect. Time to interrogate them about their motive.`
3. **Puzzle Type:** `multiple_choice`
4. **Correct Answer:** `revenge`
5. **Puzzle Data:**

```json
{
  "dialogue": [
    {
      "speaker": "Suspect",
      "text": "I don't know what you're talking about."
    },
    {
      "speaker": "Detective",
      "text": "We have a witness who places you at the warehouse on 5th Street."
    },
    {
      "speaker": "Suspect",
      "text": "Fine, I was there. But what's your motive?"
    }
  ],
  "choices": [
    { "text": "Revenge against someone", "isCorrect": true },
    { "text": "Just passing by", "isCorrect": false },
    { "text": "Meeting a friend", "isCorrect": false }
  ]
}
```

---

### Stage 3: Room 4 - Case Closed (Static Dialogue)

**In Admin Panel:**

1. **Title:** `Room 4: Case Closed`
2. **Description:** `You've solved the case. The evidence is overwhelming.`
3. **Puzzle Type:** `general`
4. **Interaction Type:** `dialogue`
5. **Correct Answer:** `case_solved`
6. **Puzzle Data:**

```json
{
  "interactionType": "dialogue",
  "dialogue": [
    {
      "speaker": "Detective",
      "text": "Excellent work! You've solved the case."
    },
    {
      "speaker": "Detective",
      "text": "The witness testimony was crucial, and the suspect confessed."
    },
    {
      "speaker": "Detective",
      "text": "Another case closed. Well done."
    }
  ]
}
```

---

## Narrative Flow with Interactive Q&A

```
┌──────────────────────────────────────────┐
│ ROOM 1: Witness Interview (Interactive) │
│ Player asks: "Where was suspect?"       │
│ Witness: "Warehouse on 5th Street"      │
│ ✓ Location extracted → Proceed           │
└────────────┬─────────────────────────────┘
             ↓
┌──────────────────────────────────────────┐
│ ROOM 2: Evidence Analysis (Text Input)  │
│ Q: "Where was suspect spotted?"         │
│ A: warehouse [exact match from Room 1]  │
└────────────┬─────────────────────────────┘
             ↓
┌──────────────────────────────────────────┐
│ ROOM 3: Interrogation (Multiple Choice) │
│ "What's your motive?"                   │
│ ✓ Revenge against someone               │
└────────────┬─────────────────────────────┘
             ↓
┌──────────────────────────────────────────┐
│ ROOM 4: Case Closed (Static Dialogue)   │
│ Investigation complete!                 │
└──────────────────────────────────────────┘
```

---

## How Interactive Witness Q&A Works

### Questions the Witness Can Answer:

**Location & Geography:**
- "Where did you see the suspect?"
- "What location?"
- "Where was this?"

**Timing:**
- "When did this happen?"
- "What time?"
- "What time did you see them?"

**Description:**
- "What did they look like?"
- "Can you describe the suspect?"
- "What were they wearing?"

**Behavior:**
- "What were they doing?"
- "What was suspicious about them?"
- "Were they alone?"

**Credibility:**
- "Are you sure about what you saw?"
- "How certain are you?"
- "Why should I believe you?"

**Evidence & Details:**
- "Did you see any weapons?"
- "Did they say anything?"
- "Did you see their face?"

**Investigation:**
- "Why are you telling me this?"
- "How long were they there?"
- "Did anyone else see them?"

### Witness Responses:

✅ **Related to investigation:** Full detailed answer
❌ **Off-topic questions:** "I'm sorry, detective. I can't help with that."

### Progression:

- Player needs to ask about **location** to proceed
- Optional: Ask about timing and description for richer experience
- After extraction, "Proceed to Evidence Analysis" button appears

---

## Implementation Checklist

- [x] Interactive Witness Q&A component created
- [x] API endpoint for witness questions built
- [x] EscapeRoomPuzzle updated with `interactive_dialogue` type
- [x] Static and interactive dialogue coexist
- [ ] Create Detective Agency puzzle in admin panel
- [ ] Test Room 1 → Room 2 flow
- [ ] Add more witness questions (optional)

---

## Testing the Flow

1. **Start puzzle** → See Room 1 with text input
2. **Ask witness questions** → Get responses
3. **Discover warehouse location** → "Proceed" button appears
4. **Move to Room 2** → Text input "warehouse"
5. **Move to Room 3** → Multiple choice interrogation
6. **Move to Room 4** → Victory dialogue

---

## Customizing Witness Responses

All witness Q&A is in: `src/lib/witness-qa.ts`

To add more questions:
```typescript
// In WITNESS_QA_DATABASE:
"your question here?": {
  answer: "Witness response here.",
  category: "location", // or timing, description, etc.
  keyInfo: "warehouse", // what info is being extracted
}
```

---

## Next Steps

1. Go to `/admin/puzzles`
2. Create new puzzle with 4 stages using above config
3. Set Stage 0 interaction type to `interactive_dialogue`
4. Test the complete flow!
