import { and, desc, eq, gte, lt } from "drizzle-orm";
import { transactions } from "@/db/schema";
import { db } from "@/index";
import { getNextMonthStart } from "@/server/lib/month";

export async function getInitialDashboardMonth(
  userId: string,
  currentMonth: string,
) {
  const nextMonth = getNextMonthStart(currentMonth);

  const [currentMonthRow] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, currentMonth),
        lt(transactions.date, nextMonth),
      ),
    )
    .limit(1);

  if (currentMonthRow) {
    return currentMonth;
  }

  const [latestRow] = await db
    .select({ date: transactions.date })
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.date))
    .limit(1);

  return latestRow ? latestRow.date.slice(0, 7) + "-01" : currentMonth;
}
