export const BANK_CONNECTION_STATUSES = [
  "linked",
  "syncing",
  "ready",
  "sync_failed",
] as const;

export type BankConnectionStatus = (typeof BANK_CONNECTION_STATUSES)[number];

export const SYNCABLE_BANK_CONNECTION_STATUSES = [
  "linked",
  "ready",
  "sync_failed",
] as const satisfies readonly BankConnectionStatus[];

export const BANK_CONNECTION_STATUS_LABELS = {
  linked: "Linked",
  syncing: "Syncing",
  ready: "Ready",
  sync_failed: "Sync failed",
} as const satisfies Record<BankConnectionStatus, string>;

type InitialConnectionSync =
  | {
      status: "ready";
      added: number;
      modified: number;
      removed: number;
    }
  | {
      status: "sync_failed";
      syncErrorCode: string;
    };

export function getBankLinkNotice({
  accountCount,
  initialSync,
}: {
  accountCount: number;
  initialSync: InitialConnectionSync;
}) {
  if (initialSync.status === "sync_failed") {
    return {
      tone: "warn" as const,
      text: "The bank connection was saved, but the first import failed. Retry it from Connections.",
    };
  }

  const importedCount = initialSync.added + initialSync.modified;
  return {
    tone: "info" as const,
    text: `Linked ${accountCount} account${accountCount === 1 ? "" : "s"} and imported ${importedCount} transaction${importedCount === 1 ? "" : "s"}.`,
  };
}
