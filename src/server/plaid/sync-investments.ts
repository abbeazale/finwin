import { and, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import type { Holding, InvestmentTransaction, Security } from "plaid";
import {
  bankAccounts,
  bankConnections,
  investmentHoldings,
  investmentTransactions,
  securities,
} from "@/db/schema";
import { db } from "@/index";
import { getPlaid } from "./client";
import { chunkArray } from "./chunk";
import { decryptPlaidAccessTokenFromRow } from "./crypto";
import { getPlaidErrorCode } from "./errors";

export type InvestmentSyncResult = {
  investmentHoldingsUpserted: number;
  investmentHoldingsRemoved: number;
  investmentTransactionsUpserted: number;
};

type ConnectionForPlaidSync = {
  id: string;
  userId: string;
  accessTokenEncrypted: string;
  accessTokenKeyVersion: string;
};

export const EMPTY_INVESTMENT_SYNC_RESULT: InvestmentSyncResult = {
  investmentHoldingsUpserted: 0,
  investmentHoldingsRemoved: 0,
  investmentTransactionsUpserted: 0,
};

function fixed(value: number, scale: number) {
  return value.toFixed(scale);
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoString(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function addDaysString(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function mapSecurity(security: Security) {
  return {
    plaidSecurityId: security.security_id,
    tickerSymbol: security.ticker_symbol,
    name: security.name,
    type: security.type,
    isCashEquivalent: security.is_cash_equivalent ?? false,
    closePrice:
      security.close_price === null ? null : fixed(security.close_price, 4),
    closePriceAsOf: security.close_price_as_of,
    isoCurrencyCode: security.iso_currency_code,
    unofficialCurrencyCode: security.unofficial_currency_code,
    updatedAt: new Date(),
  };
}

async function upsertSecurities(plaidSecurities: Security[]) {
  const rowsByPlaidId = new Map<string, ReturnType<typeof mapSecurity>>();
  for (const security of plaidSecurities) {
    rowsByPlaidId.set(security.security_id, mapSecurity(security));
  }

  const rows = [...rowsByPlaidId.values()];
  if (rows.length === 0) return new Map<string, string>();

  for (const chunk of chunkArray(rows)) {
    await db
      .insert(securities)
      .values(chunk)
      .onConflictDoUpdate({
        target: securities.plaidSecurityId,
        set: {
          tickerSymbol: sql`excluded.ticker_symbol`,
          name: sql`excluded.name`,
          type: sql`excluded.type`,
          isCashEquivalent: sql`excluded.is_cash_equivalent`,
          closePrice: sql`excluded.close_price`,
          closePriceAsOf: sql`excluded.close_price_as_of`,
          isoCurrencyCode: sql`excluded.iso_currency_code`,
          unofficialCurrencyCode: sql`excluded.unofficial_currency_code`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }

  const securityRows = await db
    .select({ id: securities.id, plaidSecurityId: securities.plaidSecurityId })
    .from(securities)
    .where(
      inArray(
        securities.plaidSecurityId,
        rows.map((row) => row.plaidSecurityId),
      ),
    );

  return new Map(securityRows.map((row) => [row.plaidSecurityId, row.id]));
}

async function getConnectionForPlaidSync(
  connectionId: string,
): Promise<ConnectionForPlaidSync> {
  const [connection] = await db
    .select({
      id: bankConnections.id,
      userId: bankConnections.userId,
      accessTokenEncrypted: bankConnections.accessTokenEncrypted,
      accessTokenKeyVersion: bankConnections.accessTokenKeyVersion,
    })
    .from(bankConnections)
    .where(eq(bankConnections.id, connectionId))
    .limit(1);

  if (!connection) throw new Error(`bankConnection ${connectionId} not found`);
  return connection;
}

async function getActiveInvestmentAccounts(connectionId: string) {
  return db
    .select({
      id: bankAccounts.id,
      providerAccountId: bankAccounts.providerAccountId,
    })
    .from(bankAccounts)
    .where(
      and(
        eq(bankAccounts.connectionId, connectionId),
        eq(bankAccounts.type, "investment"),
        eq(bankAccounts.isActive, true),
      ),
    );
}

export async function syncInvestmentHoldings(
  connectionId: string,
): Promise<InvestmentSyncResult> {
  const connection = await getConnectionForPlaidSync(connectionId);
  const accountRows = await getActiveInvestmentAccounts(connection.id);
  if (accountRows.length === 0) return EMPTY_INVESTMENT_SYNC_RESULT;

  const accessToken = decryptPlaidAccessTokenFromRow(connection);

  let data: Awaited<
    ReturnType<ReturnType<typeof getPlaid>["investmentsHoldingsGet"]>
  >["data"];
  try {
    const response = await getPlaid().investmentsHoldingsGet({
      access_token: accessToken,
    });
    data = response.data;
  } catch (err) {
    if (getPlaidErrorCode(err) === "PRODUCT_NOT_READY")
      return EMPTY_INVESTMENT_SYNC_RESULT;
    throw err;
  }

  const securityIdByPlaidId = await upsertSecurities(data.securities);
  const holdingsByProviderAccount = new Map<string, Holding[]>();
  for (const holding of data.holdings) {
    const rows = holdingsByProviderAccount.get(holding.account_id) ?? [];
    rows.push(holding);
    holdingsByProviderAccount.set(holding.account_id, rows);
  }

  let holdingsUpserted = 0;
  let holdingsRemoved = 0;

  for (const account of accountRows) {
    const holdingsForAccount =
      holdingsByProviderAccount.get(account.providerAccountId) ?? [];
    const keptSecurityIds = new Set<string>();

    await db.transaction(async (tx) => {
      const holdingRows = holdingsForAccount.flatMap((holding) => {
        const securityId = securityIdByPlaidId.get(holding.security_id);
        if (!securityId) return [];

        keptSecurityIds.add(securityId);
        return [
          {
            userId: connection.userId,
            accountId: account.id,
            securityId,
            quantity: fixed(holding.quantity, 8),
            costBasis:
              holding.cost_basis === null ? null : fixed(holding.cost_basis, 2),
            institutionPrice: fixed(holding.institution_price, 4),
            institutionPriceAsOf: holding.institution_price_as_of ?? null,
            isoCurrencyCode: holding.iso_currency_code,
            unofficialCurrencyCode: holding.unofficial_currency_code,
            updatedAt: new Date(),
          },
        ];
      });

      for (const chunk of chunkArray(holdingRows)) {
        await tx
          .insert(investmentHoldings)
          .values(chunk)
          .onConflictDoUpdate({
            target: [
              investmentHoldings.accountId,
              investmentHoldings.securityId,
            ],
            set: {
              quantity: sql`excluded.quantity`,
              costBasis: sql`excluded.cost_basis`,
              institutionPrice: sql`excluded.institution_price`,
              institutionPriceAsOf: sql`excluded.institution_price_as_of`,
              isoCurrencyCode: sql`excluded.iso_currency_code`,
              unofficialCurrencyCode: sql`excluded.unofficial_currency_code`,
              updatedAt: sql`excluded.updated_at`,
            },
          });
      }
      holdingsUpserted += holdingRows.length;

      const keptIds = [...keptSecurityIds];
      const removedRows = await tx
        .delete(investmentHoldings)
        .where(
          keptIds.length > 0
            ? and(
                eq(investmentHoldings.accountId, account.id),
                notInArray(investmentHoldings.securityId, keptIds),
              )
            : eq(investmentHoldings.accountId, account.id),
        )
        .returning({ id: investmentHoldings.id });
      holdingsRemoved += removedRows.length;
    });
  }

  const now = new Date();
  await db
    .update(bankConnections)
    .set({
      status: "active",
      syncErrorCode: null,
      lastSyncedAt: now,
      updatedAt: now,
    })
    .where(eq(bankConnections.id, connection.id));

  return {
    investmentHoldingsUpserted: holdingsUpserted,
    investmentHoldingsRemoved: holdingsRemoved,
    investmentTransactionsUpserted: 0,
  };
}

export async function syncInvestmentTransactions(
  connectionId: string,
): Promise<InvestmentSyncResult> {
  const connection = await getConnectionForPlaidSync(connectionId);
  const accountRows = await getActiveInvestmentAccounts(connection.id);
  if (accountRows.length === 0) return EMPTY_INVESTMENT_SYNC_RESULT;

  const accountIdByProvider = new Map(
    accountRows.map((account) => [account.providerAccountId, account.id]),
  );
  const accessToken = decryptPlaidAccessTokenFromRow(connection);

  const [latest] = await db
    .select({ date: investmentTransactions.date })
    .from(investmentTransactions)
    .innerJoin(
      bankAccounts,
      eq(investmentTransactions.accountId, bankAccounts.id),
    )
    .where(
      and(
        eq(bankAccounts.connectionId, connection.id),
        eq(bankAccounts.type, "investment"),
      ),
    )
    .orderBy(desc(investmentTransactions.date))
    .limit(1);

  const startDate = latest?.date
    ? addDaysString(latest.date, -7)
    : daysAgoString(730);
  const endDate = todayString();
  const pageSize = 500;
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  const plaidTransactions: InvestmentTransaction[] = [];
  const plaidSecurities: Security[] = [];

  try {
    while (offset < total) {
      const { data } = await getPlaid().investmentsTransactionsGet({
        access_token: accessToken,
        start_date: startDate,
        end_date: endDate,
        options: { count: pageSize, offset },
      });

      plaidTransactions.push(...data.investment_transactions);
      plaidSecurities.push(...data.securities);
      total = data.total_investment_transactions;
      if (data.investment_transactions.length === 0) break;
      offset += data.investment_transactions.length;
    }
  } catch (err) {
    if (getPlaidErrorCode(err) === "PRODUCT_NOT_READY")
      return EMPTY_INVESTMENT_SYNC_RESULT;
    throw err;
  }

  const securityIdByPlaidId = await upsertSecurities(plaidSecurities);
  const transactionRows = plaidTransactions.flatMap((plaidTransaction) => {
    const accountId = accountIdByProvider.get(plaidTransaction.account_id);
    if (!accountId) return [];

    const securityId = plaidTransaction.security_id
      ? (securityIdByPlaidId.get(plaidTransaction.security_id) ?? null)
      : null;

    return [
      {
        userId: connection.userId,
        accountId,
        securityId,
        plaidInvestmentTransactionId:
          plaidTransaction.investment_transaction_id,
        date: plaidTransaction.date,
        name: plaidTransaction.name,
        quantity: fixed(plaidTransaction.quantity, 8),
        plaidAmount: fixed(plaidTransaction.amount, 2),
        price: fixed(plaidTransaction.price, 4),
        fees:
          plaidTransaction.fees === null
            ? null
            : fixed(plaidTransaction.fees, 2),
        type: plaidTransaction.type,
        subtype: plaidTransaction.subtype,
        isoCurrencyCode: plaidTransaction.iso_currency_code,
        unofficialCurrencyCode: plaidTransaction.unofficial_currency_code,
      },
    ];
  });

  await db.transaction(async (tx) => {
    for (const chunk of chunkArray(transactionRows)) {
      await tx
        .insert(investmentTransactions)
        .values(chunk)
        .onConflictDoUpdate({
          target: investmentTransactions.plaidInvestmentTransactionId,
          set: {
            userId: sql`excluded.user_id`,
            accountId: sql`excluded.account_id`,
            securityId: sql`excluded.security_id`,
            date: sql`excluded.date`,
            name: sql`excluded.name`,
            quantity: sql`excluded.quantity`,
            plaidAmount: sql`excluded.plaid_amount`,
            price: sql`excluded.price`,
            fees: sql`excluded.fees`,
            type: sql`excluded.type`,
            subtype: sql`excluded.subtype`,
            isoCurrencyCode: sql`excluded.iso_currency_code`,
            unofficialCurrencyCode: sql`excluded.unofficial_currency_code`,
          },
        });
    }
  });

  const transactionsUpserted = transactionRows.length;

  const now = new Date();
  await db
    .update(bankConnections)
    .set({
      status: "active",
      syncErrorCode: null,
      lastSyncedAt: now,
      updatedAt: now,
    })
    .where(eq(bankConnections.id, connection.id));

  return {
    investmentHoldingsUpserted: 0,
    investmentHoldingsRemoved: 0,
    investmentTransactionsUpserted: transactionsUpserted,
  };
}

export async function syncInvestmentsForConnection(
  connectionId: string,
): Promise<InvestmentSyncResult> {
  const holdings = await syncInvestmentHoldings(connectionId);
  const investmentTx = await syncInvestmentTransactions(connectionId);

  return {
    investmentHoldingsUpserted: holdings.investmentHoldingsUpserted,
    investmentHoldingsRemoved: holdings.investmentHoldingsRemoved,
    investmentTransactionsUpserted: investmentTx.investmentTransactionsUpserted,
  };
}
