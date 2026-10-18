import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";

// Starts the market-data API on a private port with a one-time token and points
// FinWin at it. Reads the local finwin_market database. Call before the first
// getServerEnvironment() use.
export async function startMarketData() {
  const token = randomBytes(32).toString("hex");
  const port = 18_700 + Math.floor(Math.random() * 200);
  const server = spawn(process.execPath, ["market-data/src/server.ts"], {
    env: {
      ...process.env,
      MARKET_DATA_TOKEN: token,
      MARKET_DATA_PORT: String(port),
    },
    stdio: "ignore",
  });
  const origin = `http://127.0.0.1:${port}`;
  process.env.MARKET_DATA_URL = origin;
  process.env.MARKET_DATA_TOKEN = token;
  for (let attempt = 0; ; attempt++) {
    try {
      if ((await fetch(`${origin}/v1/health`)).ok) break;
    } catch {}
    if (attempt > 50) {
      server.kill();
      throw new Error("Market-data server did not start.");
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return { origin, token, stop: () => server.kill() };
}
