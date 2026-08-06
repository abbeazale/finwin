import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { getServerEnvironment } from "@/server/env";

let cached: PlaidApi | null = null;

export function getPlaid(): PlaidApi {
  if (cached) return cached;

  const env = getServerEnvironment();

  const basePath = PlaidEnvironments[env.plaidEnvironment];
  if (!basePath) {
    throw new Error(`Invalid PLAID_ENV "${env.plaidEnvironment}".`);
  }

  cached = new PlaidApi(
    new Configuration({
      basePath,
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": env.plaidClientId,
          "PLAID-SECRET": env.plaidSecret,
          "Plaid-Version": "2020-09-14",
        },
      },
    }),
  );

  return cached;
}
