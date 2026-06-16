#!/bin/bash
# Run this script locally to push fixes to aviadchai/fitness-deal
set -e

echo "==> Cloning fitness-deal..."
git clone https://github.com/aviadchai/fitness-deal.git /tmp/fitness-deal-update
cd /tmp/fitness-deal-update

echo "==> Downloading updated files from shopping-list branch..."
BASE="https://raw.githubusercontent.com/aviadchai/shopping-list/claude/migrate-fitness-deal-repo-duvoxd/fitness-deal-export"

curl -fsSL "$BASE/index.html" -o index.html

echo "==> Committing and pushing fixes to main..."
git add index.html
git commit -m "Fix FAB visibility, notification toggle, and deal start timing"
git push origin main

echo ""
echo "Done! Refresh https://aviadchai.github.io/fitness-deal/ in a minute or two."

cd /
rm -rf /tmp/fitness-deal-update
