#!/bin/bash
# Rebuild the production preview without downtime: build into .next-prod-new, then swap + restart.
# Usage: bash scripts/qa/rebuild_swap.sh   (log: /app/memory/tmp/build.log)
set -e
cd /app
rm -rf .next-prod-new
NEXT_DIST_DIR=.next-prod-new NODE_OPTIONS=--max-old-space-size=8192 node_modules/.bin/next build > /app/memory/tmp/build.log 2>&1 || { echo "BUILD FAILED" >> /app/memory/tmp/build.log; exit 1; }
rm -rf .next-prod-old
[ -d .next-prod ] && mv .next-prod .next-prod-old
mv .next-prod-new .next-prod
sudo supervisorctl restart frontend >> /app/memory/tmp/build.log 2>&1
rm -rf .next-prod-old
echo "SWAP DONE $(date +%T)" >> /app/memory/tmp/build.log
