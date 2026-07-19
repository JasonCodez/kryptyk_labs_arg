import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import crypto from "crypto";
import { sendEmail, generateEmailVerificationEmail } from "@/lib/mail";
import { enforceRateLimit, getClientAddress } from "@/lib/requestSecurity";
import { isAllowedDisplayName } from "@/lib/display-name-validator";
import { calcLevel } from "@/lib/levels";
import { BETA_ONLY_MODE, BETA_REGISTER_ERROR, isBetaAllowlistedEmail } from "@/lib/betaAccess";

const RegisterSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  referralCode: z.string().optional(),
  anonId: z.string().max(128).optional(),
});

type RegisterInput = z.infer<typeof RegisterSchema>;

export async function POST(request: NextRequest) {
  try {
    const ipRateLimit = await enforceRateLimit({
      key: `auth:register:ip:${getClientAddress(request)}`,
      limit: 5,
      windowMs: 15 * 60 * 1000,
      message: "Too many registration attempts. Please try again later.",
    });
    if (ipRateLimit) {
      return ipRateLimit;
    }

    const body = await request.json();

    // Honeypot: bots fill this field, humans don't
    if (body.website && String(body.website).trim().length > 0) {
      // Silently return success to fool bots
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const parsed = RegisterSchema.parse(body);
    const name = parsed.name.trim();
    const email = parsed.email.trim().toLowerCase();
    const { password, referralCode, anonId } = parsed;
    const betaAllowlisted = isBetaAllowlistedEmail(email);

    if (BETA_ONLY_MODE && !betaAllowlisted) {
      return NextResponse.json(
        { error: BETA_REGISTER_ERROR },
        { status: 403 }
      );
    }

    // Validate display name against profanity + reserved words
    const nameCheck = isAllowedDisplayName(name);
    if (!nameCheck.ok) {
      return NextResponse.json(
        { error: nameCheck.reason },
        { status: 400 }
      );
    }

    const emailRateLimit = await enforceRateLimit({
      key: `auth:register:email:${email}`,
      limit: 3,
      windowMs: 60 * 60 * 1000,
      message: "Too many registration attempts for this email. Please try again later.",
    });
    if (emailRateLimit) {
      return emailRateLimit;
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 400 }
      );
    }

    // Check if display name is already taken (case-insensitive)
    const nameTaken = await prisma.user.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    if (nameTaken) {
      return NextResponse.json(
        { error: "Display name is already taken" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const requireVerification =
      process.env.NODE_ENV === "production" ||
      process.env.REQUIRE_EMAIL_VERIFICATION === "true";

    // In dev (no email verification), grant founder badge immediately since the user
    // is considered verified at registration. In production, this is handled in
    // /api/auth/verify-email after the user confirms their email.
    let isFounder = false;
    if (!requireVerification) {
      const verifiedCount = await prisma.user.count({
        where: { isBot: false, emailVerified: { not: null } },
      });
      isFounder = verifiedCount < 1000;
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        marketingOptIn: body.marketingOptIn === true,
        isFounder,
        betaApproved: betaAllowlisted,
        // Starting level is 1 by default; mark it pre-claimed so the level-up
        // slot machine doesn't fire for a level the user never "leveled up" into.
        levelRewardClaimed: 1,
        // In non-production, keep dev flow simple if SMTP isn't configured.
        ...(requireVerification ? {} : { emailVerified: new Date() }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
      },
    });

    // Send verification email in production (token stored in verification_tokens)
    let verificationSent = false;
    if (requireVerification) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Replace any old tokens for this email
      await prisma.verificationToken.deleteMany({ where: { identifier: email } });
      await prisma.verificationToken.create({
        data: { identifier: email, token, expires },
      });

      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      const verifyUrl = `${baseUrl}/auth/verify?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
      const html = generateEmailVerificationEmail(name || email, verifyUrl);
      verificationSent = await sendEmail({
        to: email,
        subject: 'Verify your email for Puzzle Warz',
        html,
        text: `Verify your email: ${verifyUrl}`,
      });

      // If email couldn't be sent in production, roll back user creation so they aren't stuck.
      if (!verificationSent) {
        await prisma.verificationToken.deleteMany({ where: { identifier: email } });
        await prisma.user.delete({ where: { id: user.id } });

        const registrationError = BETA_ONLY_MODE
          ? BETA_REGISTER_ERROR
          : 'Email verification is temporarily unavailable. Please try again later.';

        return NextResponse.json(
          { error: registrationError },
          { status: 503 }
        );
      }
    }

    // Credit any XP/points earned as a guest — look up actual DB records by anonId
    if (anonId) {
      try {
        const [guestSolves, guestDailyWordSolves] = await Promise.all([
          prisma.gridlockSolve.findMany({
            where: { anonId, userId: null },
            include: { puzzle: { select: { xpReward: true } } },
          }),
          prisma.guestDailyWordSolve.findMany({
            where: { anonId, userId: null },
            select: { dayNumber: true, guesses: true, rewardXp: true, rewardPoints: true },
          }),
        ]);

        const totalXp = guestSolves.reduce((sum, solve) => sum + (solve.puzzle.xpReward ?? 100), 0)
          + guestDailyWordSolves.reduce((sum, solve) => sum + solve.rewardXp, 0);
        const totalPoints = guestSolves.length * 100
          + guestDailyWordSolves.reduce((sum, solve) => sum + solve.rewardPoints, 0);

        if (totalXp > 0 || totalPoints > 0) {
          if (requireVerification) {
            // Rewards are held until email is confirmed — store for later crediting
            await prisma.user.update({
              where: { id: user.id },
              data: {
                prelaunchAnonId: anonId,
                prelaunchRewardXp: totalXp,
                prelaunchRewardPoints: totalPoints,
              },
            });
          } else {
            // Dev / non-production: credit immediately since email is auto-verified
            const { level, title } = calcLevel(totalXp);
            await prisma.$transaction(async (tx) => {
              await tx.user.update({
                where: { id: user.id },
                data: { xp: totalXp, level, xpTitle: title, totalPoints },
              });

              await tx.gridlockSolve.updateMany({
                where: { anonId, userId: null },
                data: { userId: user.id },
              });

              await tx.guestDailyWordSolve.updateMany({
                where: { anonId, userId: null },
                data: { userId: user.id },
              });

              if (guestDailyWordSolves.length > 0) {
                await tx.dailyWordRecord.createMany({
                  data: guestDailyWordSolves.map((solve) => ({
                    userId: user.id,
                    dayNumber: solve.dayNumber,
                    won: true,
                    guesses: solve.guesses,
                    skipped: false,
                    shieldUsed: false,
                  })),
                  skipDuplicates: true,
                });
              }
            });
          }
        }
      } catch (err) {
        console.error('[register] Failed to credit guest solves:', err);
        // Non-fatal — don't fail registration
      }
    }

    // Handle referral if code provided
    if (referralCode) {
      try {
        // Find the referral by code
        const referral = await prisma.userReferral.findUnique({
          where: { inviteCode: referralCode },
        });

        if (referral && !referral.refereeId) {
          // Link the new user to the referral
          await prisma.userReferral.update({
            where: { id: referral.id },
            data: {
              refereeId: user.id,
              refereeJoinedAt: new Date(),
            },
          });
        }
      } catch (err) {
        console.error("Error processing referral code:", err);
        // Don't fail registration if referral processing fails
      }
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      verificationSent,
      requireVerification,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
