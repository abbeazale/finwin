import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { user, userProfiles } from "@/db/schema";
import { db } from "@/index";
import { capitalizeNameWords } from "@/lib/name";
import { protectedProcedure, router } from "../trpc";

const completeOnboardingInput = z.object({
  firstName: z.string().transform(capitalizeNameWords),
  lastName: z.string().transform(capitalizeNameWords),
  age: z.coerce.number().int().min(13).max(120),
  currency: z.string().trim().toUpperCase().min(1),
  timezone: z.string().trim().min(1),
});

export const onboardingRouter = router({
  complete: protectedProcedure
    .input(completeOnboardingInput)
    .mutation(async ({ ctx, input }) => {
      if (!input.firstName || !input.lastName) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "First name and last name are required.",
        });
      }

      const now = new Date();
      const [currentUser] = await db
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, ctx.userId))
        .limit(1);

      if (!currentUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found.",
        });
      }

      const resolvedDisplayName =
        currentUser.name.trim() || `${input.firstName} ${input.lastName}`.trim();

      await db
        .update(user)
        .set({
          name: resolvedDisplayName,
          updatedAt: now,
        })
        .where(eq(user.id, ctx.userId));

      const existingProfile = await db
        .select({ id: userProfiles.id })
        .from(userProfiles)
        .where(eq(userProfiles.userId, ctx.userId))
        .limit(1);

      const profileValues = {
        firstName: input.firstName,
        lastName: input.lastName,
        age: input.age,
        currency: input.currency,
        timezone: input.timezone,
        updatedAt: now,
      };

      if (existingProfile[0]) {
        await db
          .update(userProfiles)
          .set(profileValues)
          .where(eq(userProfiles.userId, ctx.userId));
      } else {
        await db.insert(userProfiles).values({
          id: crypto.randomUUID(),
          userId: ctx.userId,
          ...profileValues,
        });
      }

      return { ok: true };
    }),
});
