import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

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

export const plaid = new PlaidApi(
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

export const plaidEnv = env;
