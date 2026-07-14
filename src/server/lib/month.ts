import { z } from "zod";
import { shiftMonthStart } from "@/lib/date";

const MONTH_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** True when `value` is a valid `YYYY-MM-01` first-of-month string. */
function isFirstOfMonth(value: string) {
  const parts = value.split("-");
  return parts.length === 3 && parts[2] === "01";
}

/** Returns the first day of the month after `value` (input must be `YYYY-MM-DD`). */
export function getNextMonthStart(value: string) {
  return shiftMonthStart(value, 1);
}

/** Returns the first day of the month before `value` (input must be `YYYY-MM-DD`). */
export function getPreviousMonthStart(value: string) {
  return shiftMonthStart(value, -1);
}

/**
 * Zod schema for `{ month: "YYYY-MM-01" }` inputs used by month-scoped tRPC
 * procedures. Rejects any value that isn't the first day of a month.
 */
export const monthInputSchema = z
  .object({
    month: z.string().regex(MONTH_PATTERN),
  })
  .superRefine((value, ctx) => {
    if (!isFirstOfMonth(value.month)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Month must be the first day of a month.",
        path: ["month"],
      });
    }
  });

/**
 * Adds the same month-must-be-first refinement to a custom shape that already
 * uses the `YYYY-MM-DD` regex on a `month` field.
 */
export function refineFirstOfMonth(
  value: { month: string },
  ctx: z.RefinementCtx,
) {
  if (!isFirstOfMonth(value.month)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Month must be the first day of a month.",
      path: ["month"],
    });
  }
}

export const monthDateRegex = MONTH_PATTERN;
