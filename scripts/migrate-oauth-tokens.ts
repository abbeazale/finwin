import "dotenv/config";

import { eq } from "drizzle-orm";
import { account as accountTable } from "../src/db/schema";
import { db } from "../src/index";
import { encryptOAuthTokenIfNeeded } from "../src/server/auth/oauth-token-migration";

async function main() {
  const rows = await db
    .select({
      id: accountTable.id,
      accessToken: accountTable.accessToken,
      refreshToken: accountTable.refreshToken,
      idToken: accountTable.idToken,
    })
    .from(accountTable);

  let migratedAccounts = 0;
  let migratedTokens = 0;
  for (const row of rows) {
    const [accessToken, refreshToken, idToken] = await Promise.all([
      encryptOAuthTokenIfNeeded(row.accessToken),
      encryptOAuthTokenIfNeeded(row.refreshToken),
      encryptOAuthTokenIfNeeded(row.idToken),
    ]);
    const changed = [
      accessToken !== row.accessToken,
      refreshToken !== row.refreshToken,
      idToken !== row.idToken,
    ];
    if (!changed.some(Boolean)) continue;

    await db
      .update(accountTable)
      .set({ accessToken, refreshToken, idToken, updatedAt: new Date() })
      .where(eq(accountTable.id, row.id));
    migratedAccounts += 1;
    migratedTokens += changed.filter(Boolean).length;
  }

  console.log(
    `OAuth token migration complete: ${migratedTokens} token(s) across ${migratedAccounts} account(s).`,
  );
}

void main();
