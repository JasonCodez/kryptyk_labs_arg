# Email Notification System

A comprehensive email notification system for Kryptyk Labs that sends notifications for:
- 🎯 Puzzle release alerts
- 🏆 Achievement unlocks
- 👥 Team updates
- 📊 Leaderboard position changes

## Architecture

### Database Models

#### Notification Model
Stores all in-app notifications with email tracking:
```prisma
model Notification {
  id                String       @id @default(cuid())
  userId           String
  type             String       // "puzzle_released", "achievement_unlocked", "team_update", "leaderboard_change", "system"
  title            String
  message          String
  icon             String?
  relatedId        String?      // Related object ID (puzzle, team, achievement, etc.)
  
  // Email tracking
  emailSent        Boolean      @default(false)
  emailSentAt      DateTime?
  emailRead        Boolean      @default(false)
  emailReadAt      DateTime?
  
  // In-app tracking
  isRead           Boolean      @default(false)
  readAt           DateTime?
  
  createdAt        DateTime     @default(now())
  expiresAt        DateTime?
  
  user             User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([emailSent])
  @@index([createdAt])
}
```

#### NotificationPreference Model
User preferences for email notifications:
```prisma
model NotificationPreference {
  id                        String       @id @default(cuid())
  userId                    String       @unique
  
  // Individual notification settings
  emailOnPuzzleRelease      Boolean      @default(true)
  emailOnAchievement        Boolean      @default(true)
  emailOnTeamUpdate         Boolean      @default(true)
  emailOnLeaderboard        Boolean      @default(true)
  emailOnSystem             Boolean      @default(false)
  
  // Digest settings
  enableDigest              Boolean      @default(false)
  digestFrequency           String       @default("weekly") // daily, weekly, monthly
  
  // Master control
  emailNotificationsEnabled Boolean      @default(true)
  
  updatedAt                 DateTime     @updatedAt
  user                      User         @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

## Usage

### 1. Sending Puzzle Release Notifications

When a new puzzle is published, notify all users:

```typescript
import { notifyPuzzleRelease } from "@/lib/notification-service";

// Notify specific users or all users
const userIds = ["user1", "user2", "user3"];

await notifyPuzzleRelease(userIds, {
  puzzleId: "puzzle-id",
  puzzleTitle: "The Enigma Code",
  difficulty: "HARD",
  points: 250,
});
```

**Email Template Features:**
- Gradient header with emoji
- Puzzle title and difficulty badge
- Point reward display
- Styled call-to-action button
- Preference footer

### 2. Achievement Unlock Notifications

When a user earns an achievement:

```typescript
import { notifyAchievementUnlock } from "@/lib/notification-service";

await notifyAchievementUnlock(userId, {
  achievementId: "achievement-id",
  achievementName: "Cryptography Master",
  achievementDescription: "Solved 50 cryptography puzzles",
  badgeUrl: "https://example.com/badges/crypto-master.png", // Optional
});
```

**Email Template Features:**
- Trophy emoji header
- Achievement name and description
- Optional badge image
- Achievement unlocked styling
- Celebration message

### 3. Team Update Notifications

Notify team members of team activities:

```typescript
import { notifyTeamUpdate } from "@/lib/notification-service";

const teamMemberIds = ["user1", "user2", "user3"];

await notifyTeamUpdate(teamMemberIds, {
  teamId: "team-id",
  teamName: "Code Breakers",
  updateTitle: "Team Milestone Reached",
  updateMessage: "Your team has solved 100 puzzles together!",
});
```

**Email Template Features:**
- Team update header
- Update title and message
- Team-specific styling
- Link to team dashboard
- Engagement-focused messaging

### 4. Leaderboard Position Changes

Notify users when their rank changes:

```typescript
import { notifyLeaderboardChange } from "@/lib/notification-service";

await notifyLeaderboardChange(userId, {
  leaderboardType: "global", // "global", "category", "team"
  currentRank: 42,
  previousRank: 85,
  points: 5250,
});
```

**Email Template Features:**
- Current rank display (large, prominent)
- Rank change indicator (climbed/dropped)
- Total points
- Leaderboard type indicator
- Motivational messaging

## Environment Variables

Configure your SMTP settings in `.env.local`:

```env
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM="Kryptyk Labs <noreply@kryptyk-labs.com>"

# App URL (for email links)
NEXTAUTH_URL=https://kryptyk-labs.com
```

### Gmail Configuration
For Gmail with 2FA enabled:
1. Enable 2-Step Verification
2. Create an App Password
3. Use the 16-character password in `SMTP_PASSWORD`

## API Endpoints

### Get Notification Preferences
```
GET /api/user/notification-preferences
```

**Response:**
```json
{
  "id": "pref-id",
  "userId": "user-id",
  "emailOnPuzzleRelease": true,
  "emailOnAchievement": true,
  "emailOnTeamUpdate": true,
  "emailOnLeaderboard": true,
  "emailOnSystem": false,
  "enableDigest": false,
  "digestFrequency": "weekly",
  "emailNotificationsEnabled": true
}
```

### Update Notification Preferences
```
PUT /api/user/notification-preferences
Content-Type: application/json

{
  "emailOnPuzzleRelease": false,
  "enableDigest": true,
  "digestFrequency": "daily"
}
```

### Test Notification (Admin Only)
```
POST /api/admin/send-notification
Content-Type: application/json

{
  "type": "puzzle_release",
  "data": {
    "puzzleId": "puzzle-123",
    "puzzleTitle": "The Lost Code",
    "difficulty": "HARD",
    "points": 250
  }
}
```

## UI Components

### NotificationSettings Component

Display notification preferences to users:

```typescript
import NotificationSettings from "@/components/NotificationSettings";

export default function SettingsPage() {
  return (
    <div>
      <h1>Notification Settings</h1>
      <NotificationSettings />
    </div>
  );
}
```

**Features:**
- Master on/off toggle
- Individual notification type toggles
- Digest configuration (frequency selection)
- Real-time save feedback
- Success/error messaging
- Visual status indicators

## Integration Checklist

To integrate email notifications into your puzzle system:

- [ ] **Puzzle Creation/Release**
  ```typescript
  // In puzzle creation endpoint
  const userIds = await prisma.user.findMany({ select: { id: true } });
  await notifyPuzzleRelease(userIds.map(u => u.id), {
    puzzleId: puzzle.id,
    puzzleTitle: puzzle.title,
    difficulty: puzzle.difficulty,
    points: puzzle.solutions[0].points,
  });
  ```

- [ ] **Achievement Unlock**
  ```typescript
  // In achievement unlock logic
  await notifyAchievementUnlock(userId, {
    achievementId: achievement.id,
    achievementName: achievement.name,
    achievementDescription: achievement.description,
    badgeUrl: achievement.badgeUrl,
  });
  ```

- [ ] **Team Updates**
  ```typescript
  // In team action endpoints
  const members = await prisma.teamMember.findMany({
    where: { teamId },
    select: { userId: true }
  });
  await notifyTeamUpdate(members.map(m => m.userId), {
    teamId,
    teamName: team.name,
    updateTitle: "New member joined",
    updateMessage: `${newMember.name} has joined the team!`,
  });
  ```

- [ ] **Leaderboard Changes**
  ```typescript
  // When recalculating leaderboard
  const previousRank = previousLeaderboard.entries.find(e => e.userId === userId)?.rank;
  const currentRank = newLeaderboard.entries.find(e => e.userId === userId)?.rank;
  
  if (previousRank !== currentRank) {
    await notifyLeaderboardChange(userId, {
      leaderboardType: "global",
      currentRank,
      previousRank,
      points: userStats.totalPoints,
    });
  }
  ```

## Email Template Styling

All email templates use:
- **Font Family:** Arial, sans-serif
- **Max Width:** 600px
- **Background:** Dark theme (#020202, #1a1a1a)
- **Text Colors:**
  - Headings: #FDE74C (Golden)
  - Body: #DDDBF1 (Light text)
  - Secondary: #AB9F9D (Muted)
- **Accent Colors:**
  - Primary: #3891A6 (Teal)
  - Success: #38D399 (Green)
  - Warning: #FDE74C (Yellow)
  - Error: #FA7E59 (Orange)

## Troubleshooting

### Emails not sending
1. Check SMTP credentials in `.env.local`
2. Verify email account has app password enabled (for Gmail)
3. Check firewall/network for port 587 or 465
4. Review server logs for error messages

### Notifications not creating
1. Verify user exists in database
2. Check NotificationPreference record exists (auto-created if missing)
3. Ensure emailNotificationsEnabled is true
4. Check specific notification type preference is enabled

### Email formatting issues
1. Verify SMTP client supports HTML emails
2. Test with different email clients
3. Check image URLs are publicly accessible
4. Ensure CSS is inline (no external stylesheets)

## Future Enhancements

- [ ] Digest email batching and scheduling
- [ ] Email template customization
- [ ] Webhook support for custom integrations
- [ ] Email analytics tracking (opens, clicks)
- [ ] SMS notifications as fallback
- [ ] Push notifications to mobile apps
- [ ] Notification frequency caps (prevent email flooding)
- [ ] Unsubscribe link in email footers
- [ ] User preference profiles (quick toggles)
