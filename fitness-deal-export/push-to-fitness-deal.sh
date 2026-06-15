#!/bin/bash
# Run this script locally to push the fitness app to aviadchai/fitness-deal
set -e

echo "==> Cloning fitness-deal..."
git clone https://github.com/aviadchai/fitness-deal.git /tmp/fitness-deal-push
cd /tmp/fitness-deal-push

echo "==> Downloading prepared files from shopping-list branch..."
BASE="https://raw.githubusercontent.com/aviadchai/shopping-list/claude/migrate-fitness-deal-repo-duvoxd/fitness-deal-export"

curl -fsSL "$BASE/index.html"          -o index.html
curl -fsSL "$BASE/manifest.json"        -o manifest.json
curl -fsSL "$BASE/sw.js"               -o sw.js
curl -fsSL "$BASE/fitness-icon-192.png" -o fitness-icon-192.png
curl -fsSL "$BASE/fitness-icon-512.png" -o fitness-icon-512.png

echo "==> Files ready:"
ls -la

echo "==> Committing and pushing to main..."
git add .
git commit -m "Initial commit: fitness deal PWA"
git push origin main

echo "==> Enabling GitHub Pages (requires gh CLI)..."
gh api repos/aviadchai/fitness-deal/pages \
  --method POST \
  -f "source[branch]=main" \
  -f "source[path]=/" \
  2>/dev/null && echo "GitHub Pages enabled!" \
  || echo "Could not enable Pages via API - enable manually in Settings > Pages"

echo ""
echo "Done! Your app will be live at:"
echo "  https://aviadchai.github.io/fitness-deal/"

cd /
rm -rf /tmp/fitness-deal-push
