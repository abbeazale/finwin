import path from "node:path";

// Every setting comes from the environment. Bun loads .env from the working
// directory; on the server host, systemd supplies an EnvironmentFile.
function setting(name: string, fallback?: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`${name} is not set.`);
}

const repoRoot = path.resolve(import.meta.dir, "../..");

export const config = {
  databaseUrl: () =>
    setting("MARKET_DATA_DATABASE_URL", "postgres://localhost/finwin_market"),
  massiveApiKey: () => setting("MASSIVE_API_KEY"),
  token: () => {
    const token = setting("MARKET_DATA_TOKEN");
    if (token.length < 32)
      throw new Error("MARKET_DATA_TOKEN must have at least 32 characters.");
    return token;
  },
  archiveDir: () =>
    setting(
      "MARKET_DATA_ARCHIVE",
      path.join(repoRoot, ".local/market-data/raw"),
    ),
  symbols: () =>
    setting("MARKET_DATA_SYMBOLS", "AAPL,MSFT,NVDA,SPY,IWM")
      .split(",")
      .map((symbol) => symbol.trim().toUpperCase())
      .filter(Boolean),
  host: () => setting("MARKET_DATA_HOST", "127.0.0.1"),
  port: () => Number(setting("MARKET_DATA_PORT", "8787")),
};
