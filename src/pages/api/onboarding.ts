import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/index";
import { user, userProfiles } from "@/db/schema";

type ErrorResponse = {
  error: string;
};

function capitalizeNameWords(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ErrorResponse | { ok: true }>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const session = await auth.api.getSession({
    headers: new Headers(
      Object.entries(req.headers).flatMap(([key, value]) => {
        if (Array.isArray(value)) {
          return [[key, value.join(", ")]];
        }

        return value ? [[key, value]] : [];
      }),
    ),
  });

  if (!session) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  const firstName = capitalizeNameWords(
    typeof req.body?.firstName === "string" ? req.body.firstName : "",
  );
  const lastName = capitalizeNameWords(
    typeof req.body?.lastName === "string" ? req.body.lastName : "",
  );
  const currency =
    typeof req.body?.currency === "string" ? req.body.currency.trim().toUpperCase() : "";
  const timezone =
    typeof req.body?.timezone === "string" ? req.body.timezone.trim() : "";
  const ageInput =
    typeof req.body?.age === "number" || typeof req.body?.age === "string"
      ? Number(req.body.age)
      : Number.NaN;
  const age = Number.isInteger(ageInput) ? ageInput : Number.NaN;
  const resolvedDisplayName =
    session.user.name?.trim() || `${firstName} ${lastName}`.trim();

  if (!firstName || !lastName) {
    return res.status(400).json({ error: "First name and last name are required." });
  }

  if (!Number.isInteger(age) || age < 13 || age > 120) {
    return res.status(400).json({ error: "Enter a valid age between 13 and 120." });
  }

  if (!currency || !timezone) {
    return res.status(400).json({ error: "Currency and timezone are required." });
  }

  const now = new Date();

  await db
    .update(user)
    .set({
      name: resolvedDisplayName,
      updatedAt: now,
    })
    .where(eq(user.id, session.user.id));

  const existingProfile = await db
    .select({ id: userProfiles.id })
    .from(userProfiles)
    .where(eq(userProfiles.userId, session.user.id))
    .limit(1);

  if (existingProfile[0]) {
    await db
      .update(userProfiles)
      .set({
        firstName,
        lastName,
        age,
        currency,
        timezone,
        updatedAt: now,
      })
      .where(eq(userProfiles.userId, session.user.id));
  } else {
    await db.insert(userProfiles).values({
      id: crypto.randomUUID(),
      userId: session.user.id,
      firstName,
      lastName,
      age,
      currency,
      timezone,
      updatedAt: now,
    });
  }

  return res.status(200).json({ ok: true });
}
