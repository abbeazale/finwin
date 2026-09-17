import { eq } from "drizzle-orm";
import { bankConnections } from "@/db/schema";
import { db } from "@/index";
import { getPlaidErrorCode } from "@/server/plaid/errors";
import { getSyncFailureState } from "@/server/plaid/sync-rules";

type ConnectionSyncAttemptResult =
  | { status: "ready" }
  | { status: "sync_failed"; syncErrorCode: string };

export async function markConnectionLinked(connectionId: string) {
  await db
    .update(bankConnections)
    .set({
      status: "linked",
      syncErrorCode: null,
      updatedAt: new Date(),
    })
    .where(eq(bankConnections.id, connectionId));
}

export async function markConnectionSyncFailed(
  connectionId: string,
  errorCode: string | null,
) {
  const failure = getSyncFailureState(errorCode);
  await db
    .update(bankConnections)
    .set({
      ...failure,
      updatedAt: new Date(),
    })
    .where(eq(bankConnections.id, connectionId));
  return failure;
}

export async function runConnectionSyncAttempt<
  Result extends ConnectionSyncAttemptResult,
>(connectionId: string, attempt: () => Promise<Result>): Promise<Result> {
  await db
    .update(bankConnections)
    .set({
      status: "syncing",
      syncErrorCode: null,
      updatedAt: new Date(),
    })
    .where(eq(bankConnections.id, connectionId));

  try {
    const result = await attempt();
    if (result.status === "sync_failed") {
      await markConnectionSyncFailed(connectionId, result.syncErrorCode);
      return result;
    }

    const now = new Date();
    await db
      .update(bankConnections)
      .set({
        status: "ready",
        syncErrorCode: null,
        lastSyncedAt: now,
        updatedAt: now,
      })
      .where(eq(bankConnections.id, connectionId));
    return result;
  } catch (error) {
    await markConnectionSyncFailed(connectionId, getPlaidErrorCode(error));
    throw error;
  }
}
