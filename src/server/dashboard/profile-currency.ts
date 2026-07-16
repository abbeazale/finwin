import { eq } from "drizzle-orm";
import { userProfiles } from "@/db/schema";
import { db } from "@/index";

export async function getProfileCurrency(userId: string) {
  const [profile] = await db
    .select({ currency: userProfiles.currency })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  return profile?.currency ?? "CAD";
}
