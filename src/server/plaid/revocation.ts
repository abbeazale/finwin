import { and, asc, eq, isNotNull, lte } from "drizzle-orm";
import { db } from "@/index";
import { pendingProviderRevocations } from "@/db/schema";
import { logProviderError } from "@/server/observability/provider-error";
import { getPlaid } from "./client";
import { decryptPlaidAccessTokenFromRow } from "./crypto";
import { getPlaidErrorCode } from "./errors";
import {
  classifyRevocationFailure,
  isRevocationConfirmed,
  retryDelayMinutes,
  shouldAbandonRevocation,
  type RevocationOutcome,
} from "./revocation-rules";

function addMinutes(from: Date, minutes: number) {
  return new Date(from.getTime() + minutes * 60_000);
}

type EncryptedCredential = {
  accessTokenEncrypted: string;
  accessTokenKeyVersion: string;
};

/**
 * Asks Plaid to remove the Item. Never throws: the caller decides what to do
 * with the outcome, and a failure here must not stop the unlink.
 */
export async function revokePlaidItem(
  credential: EncryptedCredential,
  context: { correlationId: string; connectionId?: string; retry?: boolean },
): Promise<{ outcome: RevocationOutcome; errorCode: string | null }> {
  const operation = context.retry ? "plaid-item-remove-retry" : "plaid-item-remove";

  let accessToken: string;
  try {
    accessToken = decryptPlaidAccessTokenFromRow(credential);
  } catch (err) {
    // The stored ciphertext cannot be turned back into a token, so no number of
    // retries will ever revoke this Item. An operator has to do it by hand.
    logProviderError(err, {
      operation,
      correlationId: context.correlationId,
      connectionId: context.connectionId,
      errorCode: "REVOCATION_CREDENTIAL_UNUSABLE",
    });
    return { outcome: "unusable-credential", errorCode: "REVOCATION_CREDENTIAL_UNUSABLE" };
  }

  try {
    await getPlaid().itemRemove({ access_token: accessToken });
    return { outcome: "revoked", errorCode: null };
  } catch (err) {
    const outcome = classifyRevocationFailure(err);
    const errorCode = getPlaidErrorCode(err) ?? "UNKNOWN";
    if (outcome !== "already-revoked") {
      logProviderError(err, {
        operation,
        correlationId: context.correlationId,
        connectionId: context.connectionId,
      });
    }
    return { outcome, errorCode };
  }
}

export type PendingRevocationSummary = {
  attempted: number;
  revoked: number;
  retrying: number;
  abandoned: number;
};

/**
 * Retries every revocation that is due. Called by the scheduled internal
 * endpoint.
 *
 * Rows are not locked, so two overlapping sweeps can pick the same row and both
 * call Plaid. That costs one wasted request and nothing more: the second call
 * returns ITEM_NOT_FOUND, which counts as already revoked, and the row is
 * deleted either way.
 */
export async function runDuePlaidRevocations(options: {
  correlationId: string;
  limit?: number;
  now?: Date;
}): Promise<PendingRevocationSummary> {
  const now = options.now ?? new Date();
  const limit = options.limit ?? 25;

  const due = await db
    .select({
      id: pendingProviderRevocations.id,
      providerItemId: pendingProviderRevocations.providerItemId,
      accessTokenEncrypted: pendingProviderRevocations.accessTokenEncrypted,
      accessTokenKeyVersion: pendingProviderRevocations.accessTokenKeyVersion,
      attempts: pendingProviderRevocations.attempts,
    })
    .from(pendingProviderRevocations)
    .where(
      and(
        eq(pendingProviderRevocations.status, "pending"),
        eq(pendingProviderRevocations.provider, "plaid"),
        lte(pendingProviderRevocations.nextAttemptAt, now),
        isNotNull(pendingProviderRevocations.accessTokenEncrypted),
      ),
    )
    .orderBy(asc(pendingProviderRevocations.nextAttemptAt))
    .limit(limit);

  const summary: PendingRevocationSummary = {
    attempted: 0,
    revoked: 0,
    retrying: 0,
    abandoned: 0,
  };

  for (const row of due) {
    if (!row.accessTokenEncrypted || !row.accessTokenKeyVersion) continue;
    summary.attempted += 1;

    const attempts = row.attempts + 1;
    const { outcome, errorCode } = await revokePlaidItem(
      {
        accessTokenEncrypted: row.accessTokenEncrypted,
        accessTokenKeyVersion: row.accessTokenKeyVersion,
      },
      { correlationId: options.correlationId, retry: true },
    );

    if (isRevocationConfirmed(outcome)) {
      await db
        .delete(pendingProviderRevocations)
        .where(eq(pendingProviderRevocations.id, row.id));
      summary.revoked += 1;
      continue;
    }

    const giveUp = shouldAbandonRevocation(outcome, attempts);

    await db
      .update(pendingProviderRevocations)
      .set({
        attempts,
        lastAttemptAt: now,
        lastErrorCode: errorCode,
        status: giveUp ? "abandoned" : "pending",
        // Drop the credential once FinWin has stopped using it.
        accessTokenEncrypted: giveUp ? null : row.accessTokenEncrypted,
        accessTokenKeyVersion: giveUp ? null : row.accessTokenKeyVersion,
        nextAttemptAt: giveUp ? now : addMinutes(now, retryDelayMinutes(attempts)),
        updatedAt: now,
      })
      .where(eq(pendingProviderRevocations.id, row.id));

    if (giveUp) {
      summary.abandoned += 1;
      // Loud on purpose. Access at the provider is still live and only a human
      // working in the Plaid dashboard can close it now.
      logProviderError(new Error("revocation abandoned"), {
        operation: "plaid-item-remove-retry",
        correlationId: options.correlationId,
        errorCode: "REVOCATION_ABANDONED",
      });
    } else {
      summary.retrying += 1;
    }
  }

  return summary;
}
