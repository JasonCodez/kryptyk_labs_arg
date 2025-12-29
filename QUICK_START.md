# Quick Integration Checklist

Copy-paste ready code snippets for integrating email notifications into Kryptyk Labs.

---

## 1️⃣ Puzzle Release Notifications

### File: `/src/app/api/admin/puzzles` (or wherever puzzles are created)

**Add these imports at the top:**
```typescript
import { notifyPuzzleRelease } from "@/lib/notification-service";
```

**Add this code after puzzle is published (isActive = true):**
```typescript
// After creating/updating puzzle with isActive = true
if (puzzle.isActive) {
  const allUsers = await prisma.user.findMany({
    select: { id: true },
  });

  await notifyPuzzleRelease(allUsers.map(u => u.id), {
    puzzleId: puzzle.id,
    puzzleTitle: puzzle.title,
    difficulty: puzzle.difficulty,
    points: puzzle.points,
  });
}
```

**Test:**
```bash
curl -X POST http://localhost:3000/api/admin/send-notification \
  -H "Content-Type: application/json" \
  -d '{"type":"puzzle_release","data":{"puzzleId":"test-123","puzzleTitle":"Test Puzzle","difficulty":"MEDIUM","points":100}}'
```

---

## 2️⃣ Achievement Unlock Notifications

### File: Achievement unlock logic (find where achievements are granted)

**Add these imports:**
```typescript
import { notifyAchievementUnlock } from "@/lib/notification-service";
```

**Add this code when achievement is earned:**
```typescript
// After UserAchievement is created
const achievement = await prisma.achievement.findUnique({
  where: { id: achievementId },
});

await notifyAchievementUnlock(userId, {
  achievementId: achievement.id,
  achievementName: achievement.name,
  achievementDescription: achievement.description,
  badgeUrl: achievement.badgeUrl,
});
```

**Or in context (puzzle completion):**
```typescript
// In /src/app/api/puzzles/submit
if (isCorrect) {
  // ... existing completion code ...

  // Check for achievements
  const achievement = await checkAndAwardAchievement(userId, puzzleId);
  
  if (achievement) {
    // Send notification
    await notifyAchievementUnlock(userId, {
      achievementId: achievement.id,
      achievementName: achievement.name,
      achievementDescription: achievement.description,
      badgeUrl: achievement.badgeUrl,
    });
  }
}
```

**Test:**
```bash
curl -X POST http://localhost:3000/api/admin/send-notification \
  -H "Content-Type: application/json" \
  -d '{"type":"achievement","data":{"achievementId":"test-ach","achievementName":"First Solve","achievementDescription":"Complete your first puzzle","badgeUrl":"https://..."}}'
```

---

## 3️⃣ Team Update Notifications

### File: Team management endpoints

#### A) Team Creation

**Add import:**
```typescript
import { notifyTeamUpdate } from "@/lib/notification-service";
```

**Add after team is created:**
```typescript
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

// Notify creator
await notifyTeamUpdate([userId], {
  teamId: team.id,
  teamName: team.name,
  updateTitle: "Team Created",
  updateMessage: `Your team "${team.name}" has been created!`,
});
```

#### B) Member Joins Team

**Add when member joins:**
```typescript
// After team member is added
const newMember = await prisma.teamMember.create({
  data: {
    teamId: teamId,
    userId: newUserId,
    role: "member",
  },
  include: {
    user: { select: { name: true } },
  },
});

// Get all team members
const teamMembers = await prisma.teamMember.findMany({
  where: { teamId: teamId },
  select: { userId: true },
});

// Notify all members
await notifyTeamUpdate(
  teamMembers.map(m => m.userId),
  {
    teamId: teamId,
    teamName: team.name,
    updateTitle: "New Team Member",
    updateMessage: `${newMember.user.name} has joined the team!`,
  }
);
```

#### C) Team Achievement/Milestone

**Add when team wins/achieves something:**
```typescript
// After team achievement
const members = await prisma.teamMember.findMany({
  where: { teamId: teamId },
  select: { userId: true },
});

await notifyTeamUpdate(
  members.map(m => m.userId),
  {
    teamId: teamId,
    teamName: team.name,
    updateTitle: `Challenge Complete: ${challengeName}`,
    updateMessage: `Your team earned ${points} points!`,
  }
);
```

**Test:**
```bash
curl -X POST http://localhost:3000/api/admin/send-notification \
  -H "Content-Type: application/json" \
  -d '{"type":"team_update","data":{"teamId":"team-123","teamName":"Code Breakers","updateTitle":"New Member","updateMessage":"Alice joined the team!"}}'
```

---

## 4️⃣ Leaderboard Change Notifications

### File: Leaderboard calculation logic

**Add import:**
```typescript
import { notifyLeaderboardChange } from "@/lib/notification-service";
```

**Add after leaderboard is recalculated:**
```typescript
// Get leaderboard before recalculation
const previousLeaderboard = new Map();
const oldStandings = await prisma.userStats.findMany({
  orderBy: { totalPoints: "desc" },
  select: { userId: true },
});
oldStandings.forEach((entry, index) => {
  previousLeaderboard.set(entry.userId, index + 1);
});

// Recalculate leaderboard
const newLeaderboard = await recalculateLeaderboard();

// Notify users of rank changes
newLeaderboard.forEach((entry, index) => {
  const currentRank = index + 1;
  const previousRank = previousLeaderboard.get(entry.userId);

  // Only notify if rank changed
  if (previousRank && previousRank !== currentRank) {
    await notifyLeaderboardChange(entry.userId, {
      leaderboardType: "global",
      currentRank: currentRank,
      previousRank: previousRank,
      points: entry.totalPoints,
    });
  }
});
```

**Or simpler (after user earns points):**
```typescript
// After user completes puzzle and earns points
const previousRank = await getUserRank(userId);

// Update stats
await updateUserStats(userId, pointsEarned);

// Get new rank
const newRank = await getUserRank(userId);

// Notify if rank changed
if (newRank !== previousRank && newRank < previousRank) { // Rank improved
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

**Test:**
```bash
curl -X POST http://localhost:3000/api/admin/send-notification \
  -H "Content-Type: application/json" \
  -d '{"type":"leaderboard","data":{"leaderboardType":"global","currentRank":3,"previousRank":5,"points":5000}}'
```

---

## 5️⃣ Add UI to Settings Page

### File: User settings page (e.g., `/src/app/settings/page.tsx`)

**Add import:**
```typescript
import NotificationSettings from "@/components/NotificationSettings";
```

**Add component to page:**
```tsx
export default function SettingsPage() {
  return (
    <div>
      {/* Other settings... */}
      
      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Notification Preferences</h2>
        <NotificationSettings />
      </section>
      
      {/* More settings... */}
    </div>
  );
}
```

---

## Environment Variables

Add to `.env.local`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-specific-password
SMTP_FROM="Kryptyk Labs <noreply@kryptyk-labs.com>"
NEXTAUTH_URL=http://localhost:3000
```

---

## Verification Checklist

After each integration:

- [ ] **Build succeeds**: `npm run build` shows 0 errors
- [ ] **Test endpoint works**: POST to `/api/admin/send-notification`
- [ ] **Email sent**: Check database for `emailSent = true`
- [ ] **User preference respected**: Disable in NotificationSettings, no email sent
- [ ] **Content is correct**: Check email template rendering
- [ ] **In-app notification created**: Check `notifications` table

### Quick Database Queries

```sql
-- Check if email was sent
SELECT * FROM notifications 
WHERE type = 'puzzle_released' 
AND email_sent = true 
ORDER BY created_at DESC LIMIT 1;

-- Check user preferences
SELECT email_on_puzzle_release, email_notifications_enabled 
FROM notification_preferences 
WHERE user_id = 'user-id';

-- Count notifications by type
SELECT type, COUNT(*) FROM notifications GROUP BY type;
```

---

## Implementation Order (Recommended)

1. **Start with Puzzle Release** (easiest, touches 1 place)
2. **Add Achievement Unlock** (moderate, touches achievement logic)
3. **Add Team Updates** (moderate, touches 2-3 places)
4. **Add Leaderboard Changes** (slightly harder, requires rank tracking)
5. **Add UI** (10 minutes, just import component)

---

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| "Cannot find module 'nodemailer'" | Run `npm install nodemailer @types/nodemailer` |
| Emails not sending | Check SMTP_HOST, SMTP_USER, SMTP_PASSWORD in .env.local |
| Gmail auth fails | Use App Password, not regular password (Gmail requires 2FA) |
| Build fails with type errors | Ensure `id: true` in user Prisma query |
| User not receiving emails | Check `notification_preferences.emailNotificationsEnabled` |

---

## API Response Examples

### Puzzle Release Success
```json
{
  "success": true,
  "message": "Puzzle release notification sent to 42 users"
}
```

### Achievement Success
```json
{
  "success": true,
  "message": "Achievement notification sent"
}
```

### Team Update Success
```json
{
  "success": true,
  "message": "Team update notification sent to 5 members"
}
```

### Leaderboard Success
```json
{
  "success": true,
  "message": "Leaderboard change notification sent"
}
```

---

## Need Help?

1. Check `EMAIL_INTEGRATION_GUIDE.md` for detailed instructions
2. Check `NOTIFICATION_SYSTEM_README.md` for architecture
3. Test with `/api/admin/send-notification` endpoint
4. Review database with sample SQL queries above

**All files are ready to use - just follow this guide!**
