import prisma from "@/lib/prisma";
import {
  sendEmail,
  generatePuzzleReleaseEmail,
  generateAchievementEmail,
  generateTeamUpdateEmail,
  generateLeaderboardEmail,
} from "@/lib/mail";

interface CreateNotificationOptions {
  userId: string;
  type: "puzzle_released" | "achievement_unlocked" | "team_update" | "leaderboard_change" | "system";
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

      // Send email
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

      if (!preference.emailNotificationsEnabled || !preference.emailOnTeamUpdate) {
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
        type: "team_update",
        title: `Team Update: ${data.updateTitle}`,
        message: data.updateMessage,
        icon: "👥",
        relatedId: data.teamId,
      });

      if (!notification) continue;

      // Send email
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
    } catch (error) {
      console.error(`Failed to notify team update for user ${userId}:`, error);
    }
  }
}

export async function notifyLeaderboardChange(userId: string, data: LeaderboardChangeData) {
  try {
    const preference = await getUserNotificationPreference(userId);

    if (!preference.emailNotificationsEnabled || !preference.emailOnLeaderboard) {
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
