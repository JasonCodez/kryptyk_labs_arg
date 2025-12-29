import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const RegisterSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  referralCode: z.string().optional(), // Referral code from invite link
});

type RegisterInput = z.infer<typeof RegisterSchema>;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, referralCode } = RegisterSchema.parse(body);

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

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

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

    return NextResponse.json(user, { status: 201 });
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
