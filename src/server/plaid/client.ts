import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

let cached: PlaidApi | null = null;

export function getPlaid(): PlaidApi {
  if (cached) return cached;

  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const env = process.env.PLAID_ENV ?? "sandbox";

  if (!clientId || !secret) {
    throw new Error("PLAID_CLIENT_ID and PLAID_SECRET must be set");
  }

  const basePath = PlaidEnvironments[env];
  if (!basePath) {
    throw new Error(`Invalid PLAID_ENV "${env}" — expected sandbox | development | production`);
  }

  cached = new PlaidApi(
    new Configuration({
      basePath,
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": clientId,
          "PLAID-SECRET": secret,
          "Plaid-Version": "2020-09-14",
        },
      },
    }),
  );

  return cached;
}

export const plaidEnv = process.env.PLAID_ENV ?? "sandbox";
