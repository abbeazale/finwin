export const PLAID_UPSERT_CHUNK_SIZE = 100;

export function chunkArray<T>(items: T[], chunkSize: number = PLAID_UPSERT_CHUNK_SIZE): T[][] {
  if (chunkSize <= 0) {
    throw new Error("chunkSize must be positive.");
  }

  if (items.length === 0) return [];

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}
