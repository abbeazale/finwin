#!/usr/bin/env bash
# Deploy the committed HEAD to the market-data server over Tailscale SSH.
#
#   bash market-data/deploy/deploy.sh
#
# The server checkout (/opt/finwin) has receive.denyCurrentBranch=updateInstead,
# so the push updates its files. Then the server installs dependencies and
# restarts the API, which applies the schema before it starts. The only root
# command is the restart, allowed without a password by
# /etc/sudoers.d/finwin-market-data. Unit files are root-owned copies in
# /etc/systemd/system; when they change in the repo, the script stops and
# prints the commands to install them.
set -euo pipefail

host="${FINWIN_SERVER:-omarchy}"
cd "$(git rev-parse --show-toplevel)"

if [ -n "$(git status --porcelain)" ]; then
  echo "Commit or stash your changes first; only committed code is deployed." >&2
  exit 1
fi

git remote get-url "$host" >/dev/null 2>&1 ||
  git remote add "$host" "$host:/opt/finwin"
git push --force "$host" HEAD:refs/heads/deploy

ssh "$host" bash -s <<'REMOTE'
set -euo pipefail
cd /opt/finwin

for unit in finwin-market-data.service finwin-market-data-ingest.service finwin-market-data-ingest.timer; do
  if ! cmp -s "market-data/deploy/$unit" "/etc/systemd/system/$unit"; then
    echo "Unit $unit changed. Install it on the server, then deploy again:" >&2
    echo "  sudo install -m 644 /opt/finwin/market-data/deploy/$unit /etc/systemd/system/ && sudo systemctl daemon-reload" >&2
    exit 1
  fi
done

(cd market-data && bun install --frozen-lockfile --production)
sudo systemctl restart finwin-market-data.service

for _ in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:8787/v1/health >/dev/null 2>&1; then
    echo "Deployed $(git log --oneline -1) with Bun $(bun --version)."
    exit 0
  fi
  sleep 1
done
echo "The API did not answer /v1/health. Logs: journalctl -u finwin-market-data -n 50" >&2
exit 1
REMOTE
