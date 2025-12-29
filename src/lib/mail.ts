import nodemailer from "nodemailer";

// Initialize email transporter (configure with your SMTP settings)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      console.warn("Email service not configured. Skipping email send.");
      return false;
    }

    await transporter.sendMail({
      from: process.env.SMTP_FROM || `Kryptyk Labs <${process.env.SMTP_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

// Email template functions
export function generatePuzzleReleaseEmail(
  userName: string,
  puzzleTitle: string,
  puzzleUrl: string,
  difficulty: string,
  points: number
): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #020202 0%, #0a0a0a 100%); padding: 40px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #FDE74C; margin: 0;">🎉 New Puzzle Released!</h1>
      </div>
      
      <div style="background: #1a1a1a; padding: 40px; border-radius: 0 0 8px 8px; color: #DDDBF1;">
        <p>Hi <strong>${userName}</strong>,</p>
        
        <p>A new puzzle has been released on Kryptyk Labs!</p>
        
        <div style="background: rgba(56, 145, 166, 0.1); padding: 20px; border-left: 4px solid #3891A6; margin: 20px 0; border-radius: 4px;">
          <h3 style="color: #FDE74C; margin-top: 0;">📋 ${puzzleTitle}</h3>
          <p style="margin: 10px 0;">
            <strong>Difficulty:</strong> <span style="color: ${getDifficultyColor(difficulty)};">${difficulty}</span>
          </p>
          <p style="margin: 10px 0;">
            <strong>Reward:</strong> ⭐ ${points} points
          </p>
        </div>
        
        <p>
          <a href="${puzzleUrl}" style="display: inline-block; background: #3891A6; color: #020202; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 20px 0;">
            Solve the Puzzle →
          </a>
        </p>
        
        <p style="color: #AB9F9D; font-size: 12px; margin-top: 30px;">
          You received this email because you have notifications enabled in your preferences.
        </p>
      </div>
    </div>
  `;
}

export function generateAchievementEmail(
  userName: string,
  achievementName: string,
  achievementDescription: string,
  badgeUrl?: string
): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #020202 0%, #0a0a0a 100%); padding: 40px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #FDE74C; margin: 0;">🏆 Achievement Unlocked!</h1>
      </div>
      
      <div style="background: #1a1a1a; padding: 40px; border-radius: 0 0 8px 8px; color: #DDDBF1;">
        <p>Hi <strong>${userName}</strong>,</p>
        
        <p>Congratulations! You've just unlocked an achievement!</p>
        
        <div style="background: rgba(56, 211, 153, 0.1); padding: 20px; border-left: 4px solid #38D399; margin: 20px 0; border-radius: 4px; text-align: center;">
          ${badgeUrl ? `<img src="${badgeUrl}" alt="${achievementName}" style="width: 80px; height: 80px; margin-bottom: 15px; border-radius: 4px;">` : ""}
          <h3 style="color: #38D399; margin: 10px 0 5px;">✨ ${achievementName}</h3>
          <p style="margin: 10px 0; color: #AB9F9D;">${achievementDescription}</p>
        </div>
        
        <p style="color: #AB9F9D; font-size: 12px; margin-top: 30px;">
          You received this email because you have notifications enabled in your preferences.
        </p>
      </div>
    </div>
  `;
}

export function generateTeamUpdateEmail(
  userName: string,
  teamName: string,
  updateTitle: string,
  updateMessage: string,
  teamUrl: string
): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #020202 0%, #0a0a0a 100%); padding: 40px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #FDE74C; margin: 0;">👥 Team Update</h1>
      </div>
      
      <div style="background: #1a1a1a; padding: 40px; border-radius: 0 0 8px 8px; color: #DDDBF1;">
        <p>Hi <strong>${userName}</strong>,</p>
        
        <p>There's a new update from your team <strong>${teamName}</strong>:</p>
        
        <div style="background: rgba(253, 231, 76, 0.1); padding: 20px; border-left: 4px solid #FDE74C; margin: 20px 0; border-radius: 4px;">
          <h3 style="color: #FDE74C; margin-top: 0;">${updateTitle}</h3>
          <p style="margin: 10px 0;">${updateMessage}</p>
        </div>
        
        <p>
          <a href="${teamUrl}" style="display: inline-block; background: #3891A6; color: #020202; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 20px 0;">
            View Team →
          </a>
        </p>
        
        <p style="color: #AB9F9D; font-size: 12px; margin-top: 30px;">
          You received this email because you have notifications enabled in your preferences.
        </p>
      </div>
    </div>
  `;
}

export function generateLeaderboardEmail(
  userName: string,
  leaderboardType: "global" | "category" | "team",
  currentRank: number,
  previousRank: number | null,
  points: number,
  leaderboardUrl: string
): string {
  const rankChange = previousRank ? previousRank - currentRank : null;
  const rankChangeText = rankChange === null 
    ? "You've entered the leaderboard!" 
    : rankChange > 0 
    ? `🔥 You climbed ${rankChange} position${rankChange > 1 ? "s" : ""}!`
    : `📉 You dropped ${Math.abs(rankChange)} position${Math.abs(rankChange) > 1 ? "s" : ""}`;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #020202 0%, #0a0a0a 100%); padding: 40px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #FDE74C; margin: 0;">📊 Leaderboard Update</h1>
      </div>
      
      <div style="background: #1a1a1a; padding: 40px; border-radius: 0 0 8px 8px; color: #DDDBF1;">
        <p>Hi <strong>${userName}</strong>,</p>
        
        <p>Your leaderboard ranking has changed!</p>
        
        <div style="background: rgba(253, 231, 76, 0.1); padding: 20px; border-left: 4px solid #FDE74C; margin: 20px 0; border-radius: 4px;">
          <h3 style="color: #FDE74C; margin-top: 0;">${rankChangeText}</h3>
          <p style="margin: 10px 0;">
            <strong>Current Rank:</strong> <span style="color: #FDE74C; font-size: 24px; font-weight: bold;">#${currentRank}</span>
          </p>
          <p style="margin: 10px 0;">
            <strong>Total Points:</strong> ${points}
          </p>
          <p style="margin: 10px 0;">
            <strong>Leaderboard:</strong> ${leaderboardType.charAt(0).toUpperCase() + leaderboardType.slice(1)}
          </p>
        </div>
        
        <p>
          <a href="${leaderboardUrl}" style="display: inline-block; background: #3891A6; color: #020202; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 20px 0;">
            View Leaderboard →
          </a>
        </p>
        
        <p style="color: #AB9F9D; font-size: 12px; margin-top: 30px;">
          You received this email because you have notifications enabled in your preferences.
        </p>
      </div>
    </div>
  `;
}

function getDifficultyColor(difficulty: string): string {
  const colors: Record<string, string> = {
    EASY: "#10B981",
    MEDIUM: "#F59E0B",
    HARD: "#EF4444",
    EXPERT: "#3891A6",
  };
  return colors[difficulty] || "#3891A6";
}
