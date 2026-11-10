#!/usr/bin/env bash
# Deploys the current checkout to our hosted MiniCrafter site (the online edition with
# Play Together; accounts later). Where it goes lives in tools/.deploy.env, which is not in Git:
#   DEPLOY_SSH=my-server-alias
#   DEPLOY_DIR=/var/www/minicrafter-site
#   SITE_URL=https://example.com/          (only used for the message at the end)
# The repo's site-config.json keeps the online features off (the free copy); this script
# uploads an "on" version to our site instead.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f tools/.deploy.env ] || { echo "Create tools/.deploy.env first (see the top of this script)"; exit 1; }
# shellcheck disable=SC1091
source tools/.deploy.env
: "${DEPLOY_SSH:?}" "${DEPLOY_DIR:?}"
cp site-config.json "${TMPDIR:-/tmp}/site-config.json.keep" 2>/dev/null || true
printf '{ "online": true, "rooms": "/rooms", "accounts": true }\n' > site-config.json
trap 'mv -f "${TMPDIR:-/tmp}/site-config.json.keep" site-config.json 2>/dev/null || true' EXIT
rsync -az --delete \
  --include='index.html' --include='style.css' --include='sw.js' --include='manifest.webmanifest' --include='site-config.json' \
  --include='icons/***' --include='src/***' --include='vendor/***' --exclude='*' \
  ./ "$DEPLOY_SSH:$DEPLOY_DIR/"
ssh "$DEPLOY_SSH" "chmod -R a+rX $DEPLOY_DIR"
echo "Deployed $(git rev-parse --short HEAD) to ${SITE_URL:-$DEPLOY_SSH:$DEPLOY_DIR}"
