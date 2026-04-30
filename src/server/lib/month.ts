import { z } from "zod";

const MONTH_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** True when `value` is a valid `YYYY-MM-01` first-of-month string. */
function isFirstOfMonth(value: string) {
  const parts = value.split("-");
  return parts.length === 3 && parts[2] === "01";
}

/** Returns the first day of the month after `value` (input must be `YYYY-MM-DD`). */
export function getNextMonthStart(value: string) {
  const [year, month] = value.split("-").map(Number);
  const nextDate = new Date(Date.UTC(year, month, 1));
  const nextYear = nextDate.getUTCFullYear();
  const nextMonth = `${nextDate.getUTCMonth() + 1}`.padStart(2, "0");

  return `${nextYear}-${nextMonth}-01`;
}

/** Returns the first day of the month before `value` (input must be `YYYY-MM-DD`). */
export function getPreviousMonthStart(value: string) {
  const [year, month] = value.split("-").map(Number);
  const previousDate = new Date(Date.UTC(year, month - 2, 1));
  const previousYear = previousDate.getUTCFullYear();
  const previousMonth = `${previousDate.getUTCMonth() + 1}`.padStart(2, "0");

  return `${previousYear}-${previousMonth}-01`;
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
