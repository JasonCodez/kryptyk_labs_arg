# Email Notification Integration Guide

This guide provides step-by-step instructions for integrating the email notification system into existing Kryptyk Labs features.

## Quick Reference

| Feature | Function | Trigger | File Location |
|---------|----------|---------|---|
| 🧩 Puzzle Release | `notifyPuzzleRelease()` | After setting `isActive = true` | `/src/app/api/puzzles` |
| 🏆 Achievement Unlock | `notifyAchievementUnlock()` | When user earns achievement | Achievement grant logic |
| 👥 Team Update | `notifyTeamUpdate()` | Team milestone/announcement | Team management logic |
| 📊 Leaderboard Change | `notifyLeaderboardChange()` | When user rank changes | Leaderboard calculation |

---

## 1. Puzzle Release Notifications

### Where to Add
**File:** `/src/app/api/admin/puzzles` (POST route - when creating/publishing puzzle)

### Integration Code

```typescript
import {
  notifyPuzzleRelease,
} from "@/lib/notification-service";

// After successfully creating/publishing puzzle
const puzzle = await prisma.puzzle.create({
  data: {
    title: body.title,
    description: body.description,
    // ... other fields
    isActive: true, // ← Key: Only notify when publishing
  },
});

// If puzzle is being published (isActive = true)
if (puzzle.isActive) {
  // Get all users to notify
  const allUsers = await prisma.user.findMany({
    select: { id: true },
  });

  // Send notifications
  await notifyPuzzleRelease(allUsers.map(u => u.id), {
    puzzleId: puzzle.id,
    puzzleTitle: puzzle.title,
    difficulty: puzzle.difficulty, // "EASY", "MEDIUM", "HARD", "EXPERT"
    points: puzzle.points,
  });
}

return NextResponse.json({ puzzle, message: "Puzzle published and notifications sent" });
```

### Handling Updates
Only notify on **initial publication**, not every update:

```typescript
// Get the current state BEFORE update
const currentPuzzle = await prisma.puzzle.findUnique({
  where: { id: puzzleId },
  select: { isActive: true },
});

// Apply update
const updatedPuzzle = await prisma.puzzle.update({
  where: { id: puzzleId },
  data: { ...updateData },
});

// Only notify if transitioning from inactive to active
if (!currentPuzzle.isActive && updatedPuzzle.isActive) {
  const allUsers = await prisma.user.findMany({ select: { id: true } });
  await notifyPuzzleRelease(allUsers.map(u => u.id), {
    puzzleId: updatedPuzzle.id,
    puzzleTitle: updatedPuzzle.title,
    difficulty: updatedPuzzle.difficulty,
    points: updatedPuzzle.points,
  });
}
```

### Testing via Admin Endpoint
```bash
POST /api/admin/send-notification
{
  "type": "puzzle_release",
  "data": {
    "puzzleId": "test-id",
    "puzzleTitle": "The Enigma Code",
    "difficulty": "HARD",
    "points": 250
  }
}
```

---

## 2. Achievement Unlock Notifications

### Where to Add
**Location:** Wherever achievements are granted to users (typically achievement checking logic)

### Common Locations:
- `/src/app/api/puzzles/submit` - Check for achievements after puzzle completion
- Achievement unlock service/utility
- User progression calculation

### Integration Code

```typescript
import {
  notifyAchievementUnlock,
} from "@/lib/notification-service";

// After awarding achievement to user
const userAchievement = await prisma.userAchievement.create({
  data: {
    userId: userId,
    achievementId: achievementId,
  },
  include: {
    achievement: true,
  },
});

// Send notification to user
await notifyAchievementUnlock(userId, {
  achievementId: userAchievement.achievementId,
  achievementName: userAchievement.achievement.name,
  achievementDescription: userAchievement.achievement.description,
  badgeUrl: userAchievement.achievement.badgeUrl, // Optional: if you have badge images
});
```

### Example: Check Achievements After Puzzle Completion

```typescript
// In /src/app/api/puzzles/submit
const { puzzleId, userId, solution } = body;

// Validate solution
const isCorrect = await validateSolution(puzzleId, solution);

if (!isCorrect) {
  return NextResponse.json({ correct: false });
}

// Mark puzzle as completed
await prisma.userPuzzleProgress.update({
  where: { userId_puzzleId: { userId, puzzleId } },
  data: { completed: true, completedAt: new Date() },
});

// Check all achievements
const achievements = await prisma.achievement.findMany();

for (const achievement of achievements) {
  const hasAchievement = await prisma.userAchievement.findUnique({
    where: { userId_achievementId: { userId, achievementId: achievement.id } },
  });

  if (!hasAchievement) {
    const isEarned = await checkAchievementCondition(
      achievement.id,
      userId
    );

    if (isEarned) {
      // Award the achievement
      await prisma.userAchievement.create({
        data: { userId, achievementId: achievement.id },
      });

      // Send notification ← ADD THIS
      await notifyAchievementUnlock(userId, {
        achievementId: achievement.id,
        achievementName: achievement.name,
        achievementDescription: achievement.description,
        badgeUrl: achievement.badgeUrl,
      });
    }
  }
}

return NextResponse.json({ correct: true, message: "Puzzle solved!" });
```

### Testing via Admin Endpoint
```bash
POST /api/admin/send-notification
{
  "type": "achievement",
  "data": {
    "achievementId": "first-puzzle",
    "achievementName": "First Step",
    "achievementDescription": "Complete your first puzzle",
    "badgeUrl": "https://..."
  }
}
```

---

## 3. Team Update Notifications

### Where to Add
**Locations:**
- Team creation
- Team member joins
- Team milestone achieved
- Important team announcements

### Integration Code - Team Creation

```typescript
import {
  notifyTeamUpdate,
} from "@/lib/notification-service";

// After creating team
const team = await prisma.team.create({
  data: {
    name: teamName,
    description: teamDescription,
    createdById: userId,
  },
});

// Add creator as member
await prisma.teamMember.create({
  data: {
    teamId: team.id,
    userId: userId,
    role: "leader",
  },
});

// Get all members
const members = await prisma.teamMember.findMany({
  where: { teamId: team.id },
  select: { userId: true },
});

// Notify team members
await notifyTeamUpdate(members.map(m => m.userId), {
  teamId: team.id,
  teamName: team.name,
  updateTitle: "Team Created",
  updateMessage: `${creatorName} created team "${team.name}". Join to collaborate!`,
});

return NextResponse.json({ team });
```

### Integration Code - Member Joins

```typescript
// After adding member to team
const membership = await prisma.teamMember.create({
  data: {
    teamId: teamId,
    userId: newUserId,
    role: "member",
  },
});

// Get all team members
const members = await prisma.teamMember.findMany({
  where: { teamId: teamId },
  select: { userId: true },
});

// Notify all members of new addition
await notifyTeamUpdate(members.map(m => m.userId), {
  teamId: teamId,
  teamName: team.name,
  updateTitle: "New Team Member",
  updateMessage: `${newMemberName} has joined the team!`,
});
```

### Integration Code - Milestone Achieved

```typescript
// Example: Team wins a challenge
const { teamId, challengeId } = body;

const challengeVictory = await prisma.teamChallenge.create({
  data: {
    teamId,
    challengeId,
    completedAt: new Date(),
  },
  include: {
    challenge: true,
  },
});

// Get team members
const members = await prisma.teamMember.findMany({
  where: { teamId },
  select: { userId: true },
});

// Notify all members
await notifyTeamUpdate(members.map(m => m.userId), {
  teamId,
  teamName: team.name,
  updateTitle: `Challenge Complete: ${challengeVictory.challenge.name}`,
  updateMessage: `Your team earned ${challengeVictory.challenge.points} points!`,
});
```

### Testing via Admin Endpoint
```bash
POST /api/admin/send-notification
{
  "type": "team_update",
  "data": {
    "teamId": "team-123",
    "teamName": "The Cryptographers",
    "updateTitle": "New Member Joined",
    "updateMessage": "Alice has joined the team!"
  }
}
```

---

## 4. Leaderboard Change Notifications

### Where to Add
**Location:** Leaderboard recalculation logic (typically a scheduled job or cron task)

### Setup: Leaderboard Service

```typescript
// /src/lib/leaderboard-service.ts (or similar)

import {
  notifyLeaderboardChange,
} from "@/lib/notification-service";

export async function updateLeaderboards() {
  // Get current leaderboard standings
  const leaderboard = await prisma.userStats.findMany({
    orderBy: { totalPoints: "desc" },
    select: { userId: true, totalPoints: true, _rank: true }, // if you track rank
  });

  // Store current standings
  const previousRanks = new Map(
    leaderboard.map((entry, idx) => [entry.userId, idx + 1])
  );

  // Recalculate based on new puzzle completions
  const updatedLeaderboard = await recalculateLeaderboard();

  // Check for rank changes and notify users
  for (let newRank = 0; newRank < updatedLeaderboard.length; newRank++) {
    const userId = updatedLeaderboard[newRank].userId;
    const previousRank = previousRanks.get(userId);
    const currentRank = newRank + 1;

    // Only notify if rank actually changed
    if (previousRank && previousRank !== currentRank) {
      await notifyLeaderboardChange(userId, {
        leaderboardType: "global",
        currentRank: currentRank,
        previousRank: previousRank,
        points: updatedLeaderboard[newRank].totalPoints,
      });
    }
  }
}

// Call this in a scheduled job (every day/week)
// or manually trigger after significant events
```

### Integration: After Puzzle Completion

```typescript
// In /src/app/api/puzzles/submit (optional - after major events)

// ... existing puzzle completion code ...

// Recalculate affected leaderboards
await updateGlobalLeaderboard(); // Your existing function

// Then check for rank changes
const newRank = await getCurrentRank(userId, "global");
const previousRank = await getPreviousRank(userId);

if (newRank !== previousRank) {
  const stats = await prisma.userStats.findUnique({
    where: { userId },
    select: { totalPoints: true },
  });

  await notifyLeaderboardChange(userId, {
    leaderboardType: "global",
    currentRank: newRank,
    previousRank: previousRank,
    points: stats.totalPoints,
  });
}
```

### Testing via Admin Endpoint
```bash
POST /api/admin/send-notification
{
  "type": "leaderboard",
  "data": {
    "leaderboardType": "global",
    "currentRank": 5,
    "previousRank": 8,
    "points": 4250
  }
}
```

---

## 5. Integration Checklist

Use this checklist to track integration progress:

### Puzzle Release
- [ ] Identify puzzle creation/activation endpoint
- [ ] Import `notifyPuzzleRelease` function
- [ ] Get all user IDs after puzzle is published
- [ ] Call `notifyPuzzleRelease(userIds, data)`
- [ ] Test with admin endpoint
- [ ] Verify emails are being sent to users

### Achievement Unlock
- [ ] Identify where achievements are granted
- [ ] Import `notifyAchievementUnlock` function
- [ ] Add notification call after `UserAchievement` creation
- [ ] Include achievement name, description, badge URL
- [ ] Test with admin endpoint
- [ ] Verify user preference is respected

### Team Update
- [ ] Identify team update locations (create, join, milestone)
- [ ] Import `notifyTeamUpdate` function
- [ ] Get all team member IDs
- [ ] Call `notifyTeamUpdate(memberIds, data)` for each event
- [ ] Test multiple scenarios (create, join, achievement)
- [ ] Verify all team members receive notifications

### Leaderboard Change
- [ ] Identify leaderboard calculation logic
- [ ] Import `notifyLeaderboardChange` function
- [ ] Track previous rank before recalculation
- [ ] Compare previous vs. current rank
- [ ] Notify only if rank changed
- [ ] Test with admin endpoint
- [ ] Consider performance impact (only notify on significant changes?)

---

## 6. Environment Variables Required

Add these to your `.env.local` file:

```env
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-specific-password
SMTP_FROM="Kryptyk Labs <noreply@kryptyk-labs.com>"

# App Configuration
NEXTAUTH_URL=http://localhost:3000  # or your production URL
```

### Getting Gmail App Password:
1. Enable 2-Factor Authentication on your Google account
2. Go to [Security Settings](https://myaccount.google.com/security)
3. Find "App passwords" (bottom of list)
4. Select "Mail" and "Windows Computer"
5. Google generates a 16-character password
6. Use this password in `SMTP_PASSWORD`

---

## 7. Testing & Validation

### Test Admin Endpoint

```bash
# Test puzzle release notification
curl -X POST http://localhost:3000/api/admin/send-notification \
  -H "Content-Type: application/json" \
  -d '{
    "type": "puzzle_release",
    "data": {
      "puzzleId": "test-123",
      "puzzleTitle": "The Secret Code",
      "difficulty": "HARD",
      "points": 150
    }
  }'

# Test achievement unlock
curl -X POST http://localhost:3000/api/admin/send-notification \
  -H "Content-Type: application/json" \
  -d '{
    "type": "achievement",
    "data": {
      "achievementId": "speedster",
      "achievementName": "Speed Demon",
      "achievementDescription": "Solve 10 puzzles in one day",
      "badgeUrl": "https://..."
    }
  }'

# Test team update
curl -X POST http://localhost:3000/api/admin/send-notification \
  -H "Content-Type: application/json" \
  -d '{
    "type": "team_update",
    "data": {
      "teamId": "team-abc",
      "teamName": "Code Breakers",
      "updateTitle": "New Member Joined",
      "updateMessage": "Welcome to the team!"
    }
  }'

# Test leaderboard change
curl -X POST http://localhost:3000/api/admin/send-notification \
  -H "Content-Type: application/json" \
  -d '{
    "type": "leaderboard",
    "data": {
      "leaderboardType": "global",
      "currentRank": 3,
      "previousRank": 5,
      "points": 5000
    }
  }'
```

### Check User Preferences

```bash
# Get user notification preferences
curl http://localhost:3000/api/user/notification-preferences

# Update user preferences
curl -X PUT http://localhost:3000/api/user/notification-preferences \
  -H "Content-Type: application/json" \
  -d '{
    "emailOnPuzzleRelease": true,
    "emailOnAchievement": false,
    "emailOnTeamUpdate": true,
    "enableDigest": true,
    "digestFrequency": "weekly"
  }'
```

### Database Verification

```sql
-- Check notification preferences exist
SELECT user_id, email_on_puzzle_release, email_on_achievement 
FROM notification_preferences;

-- Check email tracking
SELECT id, user_id, type, email_sent, email_sent_at 
FROM notifications 
WHERE email_sent = true 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## 8. Troubleshooting

### Emails Not Sending

**Check SMTP Configuration:**
```typescript
// In /src/lib/mail.ts, add logging:
if (!transporter) {
  console.error("SMTP not configured:", {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER,
  });
}
```

**Common Issues:**
- SMTP credentials are incorrect
- Environment variables not loaded
- Firewall blocking SMTP port (usually 587)
- Gmail requires "App Passwords" (not regular password)

### User Not Receiving Emails

**Check notification preferences:**
```sql
SELECT email_notifications_enabled, email_on_puzzle_release 
FROM notification_preferences 
WHERE user_id = 'specific-user-id';
```

**Check if email was marked as sent:**
```sql
SELECT * FROM notifications 
WHERE user_id = 'specific-user-id' 
AND type = 'puzzle_released'
ORDER BY created_at DESC;
```

### Type Errors During Build

- Ensure `id: true` is in user query select
- Use `user.id` instead of `session.user.id`
- Check function signatures match interfaces

---

## 9. Performance Considerations

### Batch Notifications
For large notification sends (e.g., puzzle release to 1000+ users):

```typescript
async function notifyPuzzleReleaseInBatches(
  userIds: string[],
  data: PuzzleReleaseData,
  batchSize = 50
) {
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    await notifyPuzzleRelease(batch, data);
    // Optional: Add delay between batches
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
```

### Only Notify on Significant Changes
For leaderboard notifications, only notify if:
- Rank changed
- Rank change is > X positions
- User is in top 100

---

## 10. Next Steps

1. ✅ **System is built and tested**
2. ⏳ **Add integration to puzzle creation endpoint**
3. ⏳ **Add integration to achievement unlock logic**
4. ⏳ **Add integration to team management**
5. ⏳ **Add integration to leaderboard calculation**
6. ⏳ **Add NotificationSettings UI to user settings page**
7. ⏳ **Set up SMTP credentials in production**
8. ⏳ **Test full end-to-end email delivery**
9. ⏳ **Monitor email delivery metrics**

---

## Support & Questions

For issues or questions:
1. Check [NOTIFICATION_SYSTEM_README.md](./NOTIFICATION_SYSTEM_README.md) for architecture details
2. Review [mail.ts](./mail.ts) for email template examples
3. Check [notification-service.ts](./notification-service.ts) for function signatures
4. Test with admin endpoint: `/api/admin/send-notification`
