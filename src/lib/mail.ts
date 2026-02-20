import nodemailer from "nodemailer";
import sgMail from "@sendgrid/mail";

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
  // Email sending is disabled during development. To re-enable, uncomment the code below.
  console.info("[mail] Email sending is currently DISABLED. No email sent.");
  return false;

  try {
    // Preferred: SendGrid Web API
    if (process.env.SENDGRID_API_KEY) {
      const fromEmail = process.env.SENDGRID_FROM || process.env.SMTP_FROM || "";
      if (!fromEmail) {
        console.warn("SENDGRID_FROM is not set; cannot send email.");
        return false;
      }

      sgMail.setApiKey(process.env.SENDGRID_API_KEY as string);
      const [resp] = await sgMail.send({
        to: options.to,
        from: { email: fromEmail as string, name: "Puzzle Warz" },
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      const headers = (resp as unknown as { headers?: Record<string, string> })?.headers;
      const messageId = headers?.["x-message-id"] || headers?.["X-Message-Id"];
      console.info("SendGrid email sent", {
        to: options.to,
        subject: options.subject,
        messageId,
      });

      return true;
    }

    // Fallback: SMTP (Nodemailer)
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      console.warn("Email service not configured. Skipping email send.");
      return false;
    }

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || `Puzzle Warz <${process.env.SMTP_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    console.info("SMTP email sent", {
      to: options.to,
      subject: options.subject,
      messageId: (info as unknown as { messageId?: string })?.messageId,
    });

    return true;
  } catch (error) {
    const sendgridError = error as {
      code?: number | string;
      message?: string;
      response?: { statusCode?: number; body?: unknown };
    };
    if (sendgridError?.response?.body) {
      console.error("Failed to send email (SendGrid):", {
        statusCode: sendgridError.response?.statusCode,
        body: sendgridError.response?.body,
      });
    } else {
      console.error("Failed to send email:", error);
    }
    return false;
  }
}

export function generateEmailVerificationEmail(userName: string, verifyUrl: string): string {
  let logoUrl = "";
  try {
    const u = new URL(verifyUrl);
    logoUrl = `${u.origin}/images/puzzle_warz_logo.png`;
  } catch {
    // ignore
  }

  const safeName = userName || "there";

  return `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="x-apple-disable-message-reformatting" />
      <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
      <title>Verify your email</title>
    </head>
    <body style="margin:0; padding:0; background-color:#020202;">
      <!-- Preheader (hidden) -->
      <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent; mso-hide:all;">
        Verify your email to activate your Puzzle Warz account.
      </div>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#020202;">
        <tr>
          <td align="center" style="padding: 28px 16px;">
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px; max-width:600px;">
              <tr>
                <td style="padding: 0 0 14px 0; text-align:center;">
                  ${logoUrl ? `<img src="${logoUrl}" width="220" alt="Puzzle Warz" style="display:block; margin:0 auto; border:0; outline:none; text-decoration:none;" />` : ``}
                </td>
              </tr>

              <tr>
                <td style="background: linear-gradient(135deg, #020202 0%, #0a0a0a 100%); border: 1px solid #3891A6; border-radius: 14px; overflow:hidden;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td style="padding: 26px 26px 14px 26px; text-align:left;">
                        <div style="font-family: Arial, sans-serif; font-size: 20px; font-weight: 700; color: #FDE74C; line-height: 1.25;">
                          Verify your email
                        </div>
                        <div style="font-family: Arial, sans-serif; font-size: 14px; color: #DDDBF1; line-height: 1.6; margin-top: 10px;">
                          Hi <strong style="color:#DDDBF1;">${safeName}</strong>,<br />
                          Thanks for signing up for Puzzle Warz. Click the button below to verify your email and activate your account.
                        </div>
                      </td>
                    </tr>

                    <tr>
                      <td align="center" style="padding: 10px 26px 18px 26px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                          <tr>
                            <td align="center" bgcolor="#3891A6" style="border-radius: 10px;">
                              <a href="${verifyUrl}" style="display:inline-block; padding: 12px 18px; font-family: Arial, sans-serif; font-size: 14px; font-weight: 700; color:#020202; text-decoration:none; border-radius:10px;">
                                Verify Email
                              </a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding: 0 26px 22px 26px;">
                        <div style="font-family: Arial, sans-serif; font-size: 12px; color: #AB9F9D; line-height: 1.6;">
                          If the button doesn’t work, copy and paste this link into your browser:
                          <div style="word-break: break-all; margin-top: 8px;">
                            <a href="${verifyUrl}" style="color:#DDDBF1; text-decoration: underline;">${verifyUrl}</a>
                          </div>
                        </div>

                        <div style="font-family: Arial, sans-serif; font-size: 12px; color: #AB9F9D; line-height: 1.6; margin-top: 14px;">
                          If you didn’t create this account, you can safely ignore this email.
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding: 14px 6px 0 6px; text-align:center;">
                  <div style="font-family: Arial, sans-serif; font-size: 11px; color: #AB9F9D; line-height: 1.6;">
                    © ${new Date().getFullYear()} Puzzle Warz
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
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

        <p>A new puzzle has been released on Puzzle Warz!</p>

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

export function generateTeamLobbyInviteEmail(
  userName: string,
  inviterName: string,
  teamName: string,
  puzzleTitle: string,
  joinUrl: string
): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #020202 0%, #0a0a0a 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #FDE74C; margin: 0;">🔔 Lobby Invitation</h1>
      </div>
      <div style="background: #1a1a1a; padding: 30px; border-radius: 0 0 8px 8px; color: #DDDBF1;">
        <p>Hi <strong>${userName}</strong>,</p>
        <p><strong>${inviterName}</strong> has invited you to join a team lobby for <strong>${teamName}</strong>.</p>
        <div style="background: rgba(56, 145, 166, 0.05); padding: 16px; border-left: 4px solid #3891A6; margin: 16px 0; border-radius: 4px;">
          <h3 style="color: #FDE74C; margin-top: 0;">${puzzleTitle}</h3>
          <p style="margin: 0; color: #AB9F9D;">Click the button below to open the lobby and join the game.</p>
        </div>
        <p style="text-align:center; margin: 20px 0;">
          <a href="${joinUrl}" style="display: inline-block; background: #3891A6; color: #020202; padding: 12px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">Join Lobby →</a>
        </p>
        <p style="color: #AB9F9D; font-size: 12px; margin-top: 10px;">You received this because you have notifications enabled in your preferences.</p>
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
