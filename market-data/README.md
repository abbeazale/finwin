# FinWin market-data service

A small Bun service that downloads Massive price and float data into Postgres and
serves it to FinWin's screener through a read-only API. It runs on a machine you
control, so stored history is not limited by Neon's free storage. FinWin calls it
over HTTPS with a bearer token. Postgres never accepts connections from outside
the machine.

```
Massive ──(daily ingest)──▶ Postgres ◀── API (127.0.0.1:8787) ◀── Tailscale Funnel ◀── FinWin
```

## What it stores

| Table | Content |
|---|---|
| `minute_bars` | Unadjusted one-minute bars, extended hours included. Prices in billionths of a USD, volume in millionths of a share. |
| `daily_bars` | Unadjusted daily bars with the official close. |
| `float_history` | Change log of Massive free float. A row is added only when a (ticker, effective date, float) combination is new. |
| `ingest_runs` | One row per ingest run, with its status and any data issues. |

Raw Massive responses are also kept, gzipped, in `MARKET_DATA_ARCHIVE`. They let
you rebuild the database, and `scripts/screener-indicator-oracle.py` checks the
app against them.

The symbol list is `MARKET_DATA_SYMBOLS` (default `AAPL,MSFT,NVDA,SPY,IWM`).
Massive's free plan allows 5 requests per minute, so the ingest waits 13 seconds
between requests. The first two-year download takes about 4 minutes per symbol.

## Commands

Run from the repository root, so Bun loads the root `.env`:

```sh
bun market-data/src/migrate.ts                       # create tables
bun market-data/src/ingest.ts backfill --from 2024-10-14
bun market-data/src/ingest.ts daily                  # new bars + floats
bun market-data/src/ingest.ts floats                 # floats only
bun market-data/src/ingest.ts floats --import .local/float-snapshots/massive-2026-10-06.json
bun market-data/src/ingest.ts verify                 # report data gaps
bun market-data/src/server.ts                        # API on 127.0.0.1:8787
```

`daily` downloads the last three stored sessions again, so a session fetched
before Massive finished it is replaced. Gaps are reported in the log and in
`ingest_runs`; they do not stop the run, because the screener already excludes
an instrument that has a missing candle.

## API

Every route except `/v1/health` needs `Authorization: Bearer <MARKET_DATA_TOKEN>`.
Responses are gzipped when the client accepts it.

| Route | Returns |
|---|---|
| `GET /v1/health` | `{ ok: true }` |
| `GET /v1/coverage` | Sessions every symbol has, for minutes and daily bars, and the float row count |
| `GET /v1/minutes?symbols=AAPL,SPY&from=2026-07-01&to=2026-10-09` | Regular-session minutes, `[start, open, high, low, close, volume]`, at most 130 sessions |
| `GET /v1/daily?symbols=…&from=…&to=…` | `[session, open, high, low, close, volume]`, at most 600 sessions |
| `GET /v1/floats?symbols=…` | Float change log for the symbols |

## Local development on a Mac

```sh
createdb finwin_market                      # Postgres.app
bun market-data/src/migrate.ts
bun market-data/src/ingest.ts backfill --from 2024-10-14
MARKET_DATA_TOKEN=$(openssl rand -hex 32) bun market-data/src/server.ts
```

Then set `MARKET_DATA_URL=http://127.0.0.1:8787` and the same `MARKET_DATA_TOKEN`
in FinWin's `.env`. The screener checks start their own server on a private port.

## Linux server

The server is the Omarchy (Arch) laptop `omarchy` on the tailnet
(`omarchy.tailb46a58.ts.net`), set up 2026-10-13.

| Part | Where |
|---|---|
| Code | `/opt/finwin`, a git checkout owned by `abbe` that accepts pushes to the `deploy` branch (`receive.denyCurrentBranch=updateInstead`) |
| Bun | `/usr/local/bin/bun`, the only copy on the machine. It is outside mise because the `finwin` user cannot read mise installs in `/home/abbe`, so `omarchy-update` does not upgrade it. Upgrade with `sudo /usr/local/bin/bun upgrade`. Do not install Bun from Omarchy's Install > Development menu: it adds a second copy through mise |
| Postgres | pacman `postgresql`, data in `/var/lib/postgres/data` (btrfs copy-on-write off), listens on localhost only. Role `finwin` owns `finwin_market`; role `abbe` (peer login) is a member of `finwin` |
| Service user | `finwin`, no login shell |
| Raw archive | `/var/lib/finwin-market-data/raw`, owned by `finwin` |
| Secrets | `/etc/finwin-market-data.env`, root, mode 600 |
| Units | root-owned copies of `deploy/*.service` and `*.timer` in `/etc/systemd/system` |
| Lid | `/etc/systemd/logind.conf.d/90-finwin-server.conf` ignores lid close on AC and battery |
| sudo | `/etc/sudoers.d/finwin-market-data` lets `abbe` restart the API and start the ingest without a password. Nothing else |
| SSH from the Mac | `ssh omarchy`. `~/.ssh/config` on the Mac uses the key `~/.ssh/id_ed25519_omarchy` (no passphrase, this host only). Revoke it by deleting its line in `~/.ssh/authorized_keys` on the laptop |
| Funnel | `sudo tailscale funnel --bg 8787` publishes `https://omarchy.tailb46a58.ts.net`. Turn it off with `sudo tailscale funnel --https=443 off` |
| Logs | `abbe` is in `systemd-journal`, so `journalctl` needs no sudo |

### Deploy

Commit, then from the Mac:

```sh
bash market-data/deploy/deploy.sh
```

It pushes HEAD to the server, runs `bun install`, and restarts the API. The
API unit applies the schema before it starts. If a unit file changed, the
script stops and prints the `sudo install` command to run on the server.

### Operate

```sh
ssh omarchy journalctl -u finwin-market-data -u finwin-market-data-ingest -n 50
ssh omarchy sudo systemctl start finwin-market-data-ingest.service   # ingest now
ssh omarchy psql -d finwin_market -c "select * from ingest_runs order by id desc limit 5"
```

### Limits

- The disk is LUKS-encrypted and unlocked by passphrase at boot. After a
  reboot, the server stays off the tailnet until someone types the passphrase
  at the laptop. The battery covers short power cuts, and the ingest timer
  runs a missed job when the machine is back.
- TPM2 unlock is deferred (2026-10-13). On Omarchy it needs the `sd-encrypt`
  hook, which does not run Omarchy's `btrfs-overlayfs` hook (read-only snapshot
  boot from the Limine menu). Omarchy owns the hook file, so an update can undo
  the change and stop the boot. It also needs SDDM autologin off, and Secure
  Boot is off, which weakens the TPM binding. If reboots become a problem,
  prefer remote unlock: SSH and Tailscale in the initramfs
  (`mkinitcpio-tailscale` with `encryptssh`), which keeps the current hooks.
- Funnel publishes `https://omarchy.tailb46a58.ts.net` to the internet.
  Every route except `/v1/health` needs the token.

While the server is off or offline, the screener shows "Market data unavailable".
The rest of FinWin keeps working.
