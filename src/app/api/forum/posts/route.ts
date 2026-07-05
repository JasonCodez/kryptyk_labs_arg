import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { validateSameOrigin, enforceRateLimit, getClientAddress, containsLinks } from "@/lib/requestSecurity";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const puzzleId = searchParams.get("puzzleId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    const where: any = { isClosed: false };
    if (puzzleId) {
      where.puzzleId = puzzleId;
    }

    const [posts, total] = await Promise.all([
      prisma.forumPost.findMany({
        where,
        include: {
          author: { select: { id: true, name: true, image: true } },
          puzzle: { select: { id: true, title: true } },
          _count: { select: { comments: true } },
        },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.forumPost.count({ where }),
    ]);

    return NextResponse.json({
      posts,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching forum posts:", error);
    return NextResponse.json(
      { error: "Failed to fetch posts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const sameOriginError = validateSameOrigin(request);
    if (sameOriginError) {
      return sameOriginError;
    }

    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, forumRulesAcceptedAt: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (!user.forumRulesAcceptedAt) {
      return NextResponse.json(
        { error: "You must accept the forum rules before posting.", code: "FORUM_RULES_NOT_ACCEPTED" },
        { status: 403 }
      );
    }

    // Rate limit: 10 posts per hour per user + 30 per IP per hour
    const [userLimit, ipLimit] = await Promise.all([
      enforceRateLimit({ key: `forum:post:user:${user.id}`, limit: 10, windowMs: 60 * 60 * 1000, message: "You're posting too frequently. Please wait before creating another post." }),
      enforceRateLimit({ key: `forum:post:ip:${getClientAddress(request)}`, limit: 30, windowMs: 60 * 60 * 1000, message: "Too many posts from this location." }),
    ]);
    if (userLimit) return userLimit;
    if (ipLimit) return ipLimit;

    const body = await request.json();
    const { title, content, puzzleId } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 }
      );
    }

    if (typeof title !== "string" || title.trim().length > 200) {
      return NextResponse.json({ error: "Title must be 200 characters or fewer" }, { status: 400 });
    }
    if (typeof content !== "string" || content.trim().length > 10000) {
      return NextResponse.json({ error: "Post content must be 10,000 characters or fewer" }, { status: 400 });
    }
    if (containsLinks(title) || containsLinks(content)) {
      return NextResponse.json({ error: "Links are not allowed in forum posts." }, { status: 400 });
    }

    // Validate puzzle exists if provided
    if (puzzleId) {
      const puzzle = await prisma.puzzle.findUnique({
        where: { id: puzzleId },
      });
      if (!puzzle) {
        return NextResponse.json(
          { error: "Puzzle not found" },
          { status: 404 }
        );
      }
    }

    const post = await prisma.forumPost.create({
      data: {
        title,
        content,
        authorId: user.id,
        puzzleId: puzzleId || null,
      },
      include: {
        author: { select: { id: true, name: true, image: true } },
        puzzle: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error("Error creating forum post:", error);
    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500 }
    );
  }
}
