import prisma from "@/lib/prisma";

export type ActivityType =
  | "success"
  | "error"
  | "info"
  | "security"
  | "subscription"
  | "view"
  | "analytics"
  | "document";

export interface LogActivityParams {
  userId: string;
  type: ActivityType;
  title: string;
  description?: string;
  icon?: string;
  relatedId?: string;
  relatedType?: string;
  metadata?: Record<string, any>;
}

/**
 * Log an activity for a user
 * Used throughout the app to track user actions and important events
 */
export async function logActivity({
  userId,
  type,
  title,
  description,
  icon,
  relatedId,
  relatedType,
  metadata,
}: LogActivityParams) {
  try {
    const activity = await prisma.activity.create({
      data: {
        userId,
        type,
        title,
        description: description || "",
        icon,
        relatedId,
        relatedType,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
    return activity;
  } catch (error) {
    console.error("Failed to log activity:", error);
    // Don't throw - activity logging shouldn't break main functionality
    return null;
  }
}

/**
 * Log common activities
 */

export async function logSignIn(userId: string) {
  return logActivity({
    userId,
    type: "security",
    title: "Signed in",
    description: "You signed in to your account",
    icon: "Lock",
  });
}

export async function logSignOut(userId: string) {
  return logActivity({
    userId,
    type: "security",
    title: "Signed out",
    description: "You signed out of your account",
    icon: "Lock",
  });
}

export async function logPasswordChanged(userId: string) {
  return logActivity({
    userId,
    type: "security",
    title: "Password changed",
    description: "Your password was successfully changed",
    icon: "Lock",
  });
}

export async function logSubscriptionUpgrade(userId: string, plan: string) {
  return logActivity({
    userId,
    type: "subscription",
    title: "Plan upgraded",
    description: `You upgraded to the ${plan} plan`,
    icon: "Zap",
    metadata: { plan },
  });
}

export async function logSubscriptionDowngrade(userId: string, plan: string) {
  return logActivity({
    userId,
    type: "subscription",
    title: "Plan downgraded",
    description: `You downgraded to the ${plan} plan`,
    icon: "Zap",
    metadata: { plan },
  });
}

export async function logFileUploaded(userId: string, fileName: string) {
  return logActivity({
    userId,
    type: "document",
    title: "File uploaded",
    description: `${fileName} was uploaded successfully`,
    icon: "FileText",
    metadata: { fileName },
  });
}

export async function logAnalyticsViewed(userId: string) {
  return logActivity({
    userId,
    type: "analytics",
    title: "Analytics viewed",
    description: "You viewed your analytics dashboard",
    icon: "BarChart3",
  });
}

export async function logApiKeyGenerated(userId: string, keyName: string) {
  return logActivity({
    userId,
    type: "security",
    title: "API key generated",
    description: `New API key "${keyName}" was created`,
    icon: "Lock",
    metadata: { keyName },
  });
}

export async function logApiKeyRevoked(userId: string, keyName: string) {
  return logActivity({
    userId,
    type: "security",
    title: "API key revoked",
    description: `API key "${keyName}" was revoked`,
    icon: "Lock",
    metadata: { keyName },
  });
}

export async function logSettingsUpdated(
  userId: string,
  setting: string,
  oldValue: any,
  newValue: any
) {
  return logActivity({
    userId,
    type: "info",
    title: "Settings updated",
    description: `${setting} was changed`,
    metadata: { setting, oldValue, newValue },
  });
}
