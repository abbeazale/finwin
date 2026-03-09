import type { GetServerSidePropsContext } from "next";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/index";
import { userProfiles } from "@/db/schema";
import { toRequestHeaders } from "@/lib/request-headers";

export async function getPageSession(context: GetServerSidePropsContext) {
  return auth.api.getSession({
    headers: toRequestHeaders(context.req.headers),
  });
}

export async function getUserProfile(userId: string) {
  const [profile] = await db.select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  return profile ?? null;
}

export function hasCompletedOnboarding(
  profile:
    | {
        firstName?: string | null;
        lastName?: string | null;
        age?: number | null;
      }
    | null
    | undefined,
) {
  return Boolean(
    profile?.firstName?.trim() &&
      profile?.lastName?.trim() &&
      typeof profile?.age === "number" &&
      profile.age >= 13,
  );
}
