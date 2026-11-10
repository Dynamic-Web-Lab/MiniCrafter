#!/usr/bin/env bash
# Deploys the current checkout to our hosted MiniCrafter site (the online edition: Play Together
# and accounts). Where it goes lives in tools/.deploy.env, which is not in Git:
#   DEPLOY_SSH=my-server-alias
#   DEPLOY_DIR=/var/www/minicrafter-site
#   SITE_URL=https://example.com/          (the site's public address, with a trailing slash)
# It builds the site in a temporary folder (your checkout is never changed), then:
#  - uploads an "on" site-config.json (the copy in Git keeps the online features off),
#  - includes stats.html, the insights page (it asks for STATS_TOKEN from the server's .env),
#  - adds the site's address to features.html (canonical and social-sharing tags),
#  - writes sitemap.xml and robots.txt for search engines.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f tools/.deploy.env ] || { echo "Create tools/.deploy.env first (see the top of this script)"; exit 1; }
# shellcheck disable=SC1091
source tools/.deploy.env
: "${DEPLOY_SSH:?}" "${DEPLOY_DIR:?}" "${SITE_URL:?set SITE_URL in tools/.deploy.env}"
case "$SITE_URL" in */) ;; *) SITE_URL="$SITE_URL/" ;; esac

BUILD=$(mktemp -d "${TMPDIR:-/tmp}/minicrafter-site.XXXXXX")
trap 'rm -rf "$BUILD"' EXIT
rsync -a \
  --include='index.html' --include='style.css' --include='sw.js' --include='manifest.webmanifest' \
  --include='privacy.html' --include='terms.html' --include='legal.css' \
  --include='features.html' --include='features.css' --include='llms.txt' --include='stats.html' \
  --include='icons/***' --include='src/***' --include='vendor/***' \
  --include='docs/' --include='docs/screenshots/***' --exclude='*' \
  ./ "$BUILD/"

printf '{ "online": true, "rooms": "/rooms", "accounts": true, "insights": true }\n' > "$BUILD/site-config.json"

# Site-specific tags on the features page (absolute addresses for search engines and link previews).
META="<link rel=\"canonical\" href=\"${SITE_URL}features.html\">\n  <meta property=\"og:url\" content=\"${SITE_URL}features.html\">\n  <meta property=\"og:image\" content=\"${SITE_URL}docs/screenshots/course.jpg\">\n  <meta name=\"twitter:image\" content=\"${SITE_URL}docs/screenshots/course.jpg\">"
python3 - "$BUILD/features.html" "$META" <<'PY'
import sys
p, meta = sys.argv[1], sys.argv[2].replace('\\n', '\n')
s = open(p).read()
assert '<!--SITE-META-->' in s
open(p, 'w').write(s.replace('<!--SITE-META-->', meta, 1))
PY

TODAY=$(date +%Y-%m-%d)
cat > "$BUILD/sitemap.xml" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}</loc><lastmod>${TODAY}</lastmod><priority>1.0</priority></url>
  <url><loc>${SITE_URL}features.html</loc><lastmod>${TODAY}</lastmod><priority>0.9</priority></url>
  <url><loc>${SITE_URL}privacy.html</loc><lastmod>${TODAY}</lastmod><priority>0.3</priority></url>
  <url><loc>${SITE_URL}terms.html</loc><lastmod>${TODAY}</lastmod><priority>0.3</priority></url>
</urlset>
EOF
printf 'User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /rooms\nDisallow: /stats.html\nSitemap: %ssitemap.xml\n' "$SITE_URL" > "$BUILD/robots.txt"

rsync -az --delete "$BUILD/" "$DEPLOY_SSH:$DEPLOY_DIR/"
ssh "$DEPLOY_SSH" "chmod -R a+rX $DEPLOY_DIR"
echo "Deployed $(git rev-parse --short HEAD)$(git diff --quiet HEAD -- . 2>/dev/null || echo ' (+ uncommitted changes)') to $SITE_URL"
