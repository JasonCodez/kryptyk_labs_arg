import prisma from "@/lib/prisma";
import {
  sendEmail,
  generatePuzzleReleaseEmail,
  generateAchievementEmail,
  generateTeamUpdateEmail,
  generateLeaderboardEmail,
} from "@/lib/mail";

// Disable bulk notification emails to conserve Resend quota (100/day).
// Essential emails (verification, password reset) are sent directly from their
// API routes and are NOT affected by this flag.
// Set to true when you upgrade to a higher Resend plan.
const NOTIFICATION_EMAILS_ENABLED = false;

interface CreateNotificationOptions {
  userId: string;
  type: "puzzle_released" | "achievement_unlocked" | "team_update" | "leaderboard_change" | "slot_win" | "system";
  title: string;
  message: string;
  icon?: string;
  relatedId?: string;
}

interface PuzzleReleaseData {
  puzzleId: string;
  puzzleTitle: string;
  difficulty: string;
  points: number;
}

interface AchievementData {
  achievementId: string;
  achievementName: string;
  achievementDescription: string;
  badgeUrl?: string;
}

interface TeamUpdateData {
  teamId: string;
  teamName: string;
  updateTitle: string;
  updateMessage: string;
}

interface LeaderboardChangeData {
  leaderboardType: "global" | "category" | "team";
  currentRank: number;
  previousRank: number | null;
  points: number;
}

async function getUserNotificationPreference(userId: string) {
  let preference = await prisma.notificationPreference.findUnique({
    where: { userId },
  });

  // Create default preference if it doesn't exist
  if (!preference) {
    preference = await prisma.notificationPreference.create({
      data: { userId },
    });
  }

  return preference;
}

async function getBaseUrl(): Promise<string> {
  return process.env.NEXTAUTH_URL || "http://localhost:3000";
}

export async function createNotification(options: CreateNotificationOptions) {
  try {
    // Create the notification in database
    const notification = await prisma.notification.create({
      data: {
        userId: options.userId,
        type: options.type,
        title: options.title,
        message: options.message,
        icon: options.icon,
        relatedId: options.relatedId,
      },
    });

    // Log creation for debugging lobby invite flows
    try {
      console.log(`Created notification: id=${notification.id} user=${notification.userId} type=${notification.type} relatedId=${notification.relatedId}`);
    } catch (e) {
      // ignore logging failures
    }

    // Try to push the notification to the user's open sockets via the socket server
    (async () => {
      try {
        const { postToSocket } = await import('@/lib/socket-client');
        const resp = await postToSocket('/notify', { userId: notification.userId, notification });
        if (!resp || !resp.ok) {
          // not fatal — socket server may not be running
        }
      } catch (e) {
        // ignore push failures
      }
    })();

    return notification;
  } catch (error) {
    console.error("Failed to create notification:", error);
    return null;
  }
}

export async function notifyPuzzleRelease(userIds: string[], data: PuzzleReleaseData) {
  const baseUrl = await getBaseUrl();

  for (const userId of userIds) {
    try {
      const preference = await getUserNotificationPreference(userId);

      if (!preference.emailNotificationsEnabled || !preference.emailOnPuzzleRelease) {
        continue;
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });

      if (!user?.email) continue;

      // Create in-app notification
      const notification = await createNotification({
        userId,
        type: "puzzle_released",
        title: `New Puzzle: ${data.puzzleTitle}`,
        message: `A new ${data.difficulty.toLowerCase()} puzzle has been released! Earn ${data.points} points.`,
        icon: "🎯",
        relatedId: data.puzzleId,
      });

      if (!notification) continue;

      // Send email (skipped when NOTIFICATION_EMAILS_ENABLED is false)
      if (NOTIFICATION_EMAILS_ENABLED) {
        const puzzleUrl = `${baseUrl}/puzzles/${data.puzzleId}`;
        const html = generatePuzzleReleaseEmail(
          user.name || user.email,
          data.puzzleTitle,
          puzzleUrl,
          data.difficulty,
          data.points
        );

        const emailSent = await sendEmail({
          to: user.email,
          subject: `🎯 New Puzzle Released: ${data.puzzleTitle}`,
          html,
        });

        if (emailSent) {
          await prisma.notification.update({
            where: { id: notification.id },
            data: {
              emailSent: true,
              emailSentAt: new Date(),
            },
          });
        }
      }
    } catch (error) {
      console.error(`Failed to notify puzzle release for user ${userId}:`, error);
    }
  }
}

export async function notifyAchievementUnlock(userId: string, data: AchievementData) {
  try {
    const preference = await getUserNotificationPreference(userId);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    // Always create an in-app notification (respecting user's existence)
    const notification = await createNotification({
      userId,
      type: "achievement_unlocked",
      title: `Achievement Unlocked: ${data.achievementName}`,
      message: data.achievementDescription,
      icon: "🏆",
      relatedId: data.achievementId,
    });

    if (!notification) return;

    // Send email only if user has email and preferences allow it
    if (
      NOTIFICATION_EMAILS_ENABLED &&
      preference.emailNotificationsEnabled &&
      preference.emailOnAchievement &&
      user?.email
    ) {
      const html = generateAchievementEmail(
        user.name || user.email,
        data.achievementName,
        data.achievementDescription,
        data.badgeUrl
      );

      const emailSent = await sendEmail({
        to: user.email,
        subject: `🏆 Achievement Unlocked: ${data.achievementName}`,
        html,
      });

      if (emailSent) {
        await prisma.notification.update({
          where: { id: notification.id },
          data: {
            emailSent: true,
            emailSentAt: new Date(),
          },
        });
      }
    }
  } catch (error) {
    console.error(`Failed to notify achievement unlock for user ${userId}:`, error);
  }
}

export async function notifyTeamUpdate(
  userIds: string[],
  data: TeamUpdateData
) {
  const baseUrl = await getBaseUrl();

  for (const userId of userIds) {
    try {
      const preference = await getUserNotificationPreference(userId);
      // Always create an in-app notification (it powers the notification bell)
      const notification = await createNotification({
        userId,
        type: "team_update",
        title: `Team Update: ${data.updateTitle}`,
        message: data.updateMessage,
        icon: "👥",
        relatedId: data.teamId,
      });

      // Also create an Activity entry so the activity-based notification bell
      // and activity feed surface this update. Activity is lightweight and
      // intended for immediate UI consumption.
      try {
        await prisma.activity.create({
          data: {
            userId,
            type: "team_update",
            title: `Team: ${data.teamName} — ${data.updateTitle}`,
            description: data.updateMessage,
            icon: "👥",
            relatedId: data.teamId,
            relatedType: "team",
          },
        });
      } catch (actErr) {
        console.error(`Failed to create activity for user ${userId}:`, actErr);
      }

      if (!notification) continue;

      // Send email only if user has email and preferences allow it
      try {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
        if (NOTIFICATION_EMAILS_ENABLED && user?.email && preference.emailNotificationsEnabled && preference.emailOnTeamUpdate) {
          const teamUrl = `${baseUrl}/teams/${data.teamId}`;
          const html = generateTeamUpdateEmail(
            user.name || user.email,
            data.teamName,
            data.updateTitle,
            data.updateMessage,
            teamUrl
          );

          const emailSent = await sendEmail({
            to: user.email,
            subject: `👥 Team Update: ${data.updateTitle}`,
            html,
          });

          if (emailSent) {
            await prisma.notification.update({
              where: { id: notification.id },
              data: {
                emailSent: true,
                emailSentAt: new Date(),
              },
            });
          }
        }
      } catch (emailErr) {
        console.error(`Failed to send team update email to ${userId}:`, emailErr);
      }
    } catch (error) {
      console.error(`Failed to notify team update for user ${userId}:`, error);
    }
  }
}

export async function notifyLeaderboardChange(userId: string, data: LeaderboardChangeData) {
  try {
    const preference = await getUserNotificationPreference(userId);

    if (!NOTIFICATION_EMAILS_ENABLED || !preference.emailNotificationsEnabled || !preference.emailOnLeaderboard) {
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    if (!user?.email) return;

    const baseUrl = await getBaseUrl();

    // Create in-app notification
    const rankChange = data.previousRank ? data.previousRank - data.currentRank : null;
    const changeText = rankChange === null 
      ? "You've entered the leaderboard!"
      : rankChange > 0 
      ? `You climbed ${rankChange} position${rankChange > 1 ? "s" : ""}!`
      : `You dropped ${Math.abs(rankChange)} position${Math.abs(rankChange) > 1 ? "s" : ""}`;

    const notification = await createNotification({
      userId,
      type: "leaderboard_change",
      title: "Leaderboard Position Changed",
      message: `${changeText} You're now ranked #${data.currentRank}.`,
      icon: "📊",
    });

    if (!notification) return;

    // Send email
    const leaderboardUrl = `${baseUrl}/leaderboards`;
    const html = generateLeaderboardEmail(
      user.name || user.email,
      data.leaderboardType,
      data.currentRank,
      data.previousRank,
      data.points,
      leaderboardUrl
    );

    const emailSent = await sendEmail({
      to: user.email,
      subject: `📊 Your Leaderboard Position Changed - Rank #${data.currentRank}`,
      html,
    });

    if (emailSent) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          emailSent: true,
          emailSentAt: new Date(),
        },
      });
    }
  } catch (error) {
    console.error(`Failed to notify leaderboard change for user ${userId}:`, error);
  }
}
