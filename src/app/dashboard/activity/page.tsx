import React, { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import ActivityFeedClient from "@/components/activity-feed/ActivityFeedClient";

interface UserInfo {
  image?: string | null;
  name?: string | null;
  email?: string | null;
}

async function getActivities() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/auth/signin");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    redirect("/auth/signin");
  }

  const [activities, total] = await Promise.all([
    prisma.activity.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.activity.count({ where: { userId: user.id } }),
  ]);

  return { activities, total, user };
}

export default async function ActivityFeedPage() {
  const { activities, total, user } = await getActivities();
  const session = await getServerSession(authOptions);
  const userInfo: UserInfo = {
    image: user.image,
    name: user.name,
    email: user.email,
  };

  return (
    <div style={{ backgroundColor: '#020202', backgroundImage: 'linear-gradient(135deg, #020202 0%, #0a0a0a 50%, #020202 100%)' }} className="min-h-screen">
      {/* Navigation */}
      <nav className="backdrop-blur-md" style={{ borderBottomColor: '#3891A6', borderBottomWidth: '1px', backgroundColor: 'rgba(76, 91, 92, 0.7)' }}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition">
            <img src="/images/logo.png" alt="Kryptyk Labs Logo" className="h-10 w-auto" />
            <div className="text-2xl font-bold" style={{ color: '#3891A6' }}>
              Kryptyk Labs
            </div>
          </Link>
          <div className="flex items-center gap-6">
            {userInfo.image && (
              <img src={userInfo.image} alt="Avatar" className="h-10 w-10 rounded-full object-cover" />
            )}
            <div className="text-right">
              <p className="text-white font-semibold">{userInfo.name || userInfo.email}</p>
              <p style={{ color: '#3891A6' }} className="text-sm">Player</p>
            </div>
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-lg text-white transition hover:opacity-90"
              style={{ backgroundColor: '#3891A6' }}
            >
              Dashboard
            </Link>
            <Link
              href="/settings"
              className="px-4 py-2 rounded-lg text-white transition hover:opacity-90"
              style={{ backgroundColor: '#3891A6' }}
            >
              Settings
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Activity Feed</h1>
          <p className="text-gray-400">
            Track your recent activities and account changes
          </p>
        </div>

        <Suspense fallback={<ActivityFeedSkeleton />}>
          <ActivityFeedClient activities={activities} total={total} />
        </Suspense>
      </div>
    </div>
  );
}

function ActivityFeedSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="h-20 bg-slate-800 rounded-lg animate-pulse"
        />
      ))}
    </div>
  );
}
