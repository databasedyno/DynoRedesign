#!/usr/bin/env bash
# Simulates the droplet deploy script from .github/workflows/deploy-droplet.yml
# with stubbed docker/curl/systemctl/caddy/journalctl, for the 3 paths:
#   canary_fail | swap_fail | success
# Usage: scripts/qa/deploy_script_sim.sh [scenario]
set -u
SCENARIO=${1:-success}
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
SB=$(mktemp -d)
mkdir -p "$SB/bin" "$SB/opt/dynopay" "$SB/etc/caddy"

python3 - "$ROOT/.github/workflows/deploy-droplet.yml" "$SB/script.sh" <<'EOF'
import sys, yaml
d = yaml.safe_load(open(sys.argv[1]))
steps = d['jobs']['build-and-deploy']['steps']
s = [x for x in steps if x.get('name','').startswith('Deploy over SSH')][0]['with']['script']
s = s.replace('cd /opt/dynopay', 'cd "$SB/opt/dynopay"').replace('/etc/caddy/Caddyfile', '$SB/etc/caddy/Caddyfile')
open(sys.argv[2], 'w').write(s)
EOF

cat > "$SB/opt/dynopay/docker-compose.yml" <<'EOF'
services:
  app:
    image: ghcr.io/databasedyno/dynopay:PREVSHA
    container_name: dynopay
EOF
printf 'FOO=bar\n' > "$SB/opt/dynopay/.env"
printf 'dynopay.com {\n}\nsafedeal.sh {\n}\n' > "$SB/etc/caddy/Caddyfile"

# state files drive the stubs
echo PREVSHA > "$SB/live_image"     # which image the "live" container runs
echo 0 > "$SB/canary_running"

cat > "$SB/bin/docker" <<'EOF'
#!/usr/bin/env bash
SB=${SB:?}; SC=${SCENARIO:?}
echo "[docker] $*" >> "$SB/calls.log"
case "$1 $2" in
  "login ghcr.io") cat >/dev/null; exit 0;;
  "pull "*) exit 0;;
  "rm -f"|"rmi "*|"image prune"|"builder prune"|"container prune") exit 0;;
  "images --format") printf 'ghcr.io/databasedyno/dynopay:OLD1\nghcr.io/databasedyno/dynopay:PREVSHA\nghcr.io/databasedyno/dynopay:NEWSHA\n'; exit 0;;
  "inspect -f") [ "$(cat "$SB/canary_running")" = 1 ] && echo true || echo false; exit 0;;
  "logs "*) echo "<container logs of $2>"; exit 0;;
  "compose -p") # canary project
     case "$*" in
       *" up -d") if [ "$SC" = canary_fail ]; then echo 0 > "$SB/canary_running"; else echo 1 > "$SB/canary_running"; fi;;
       *" down"*) echo 0 > "$SB/canary_running";;
     esac; exit 0;;
  "compose up") img=$(grep -E '^\s*image:' "$SB/opt/dynopay/docker-compose.yml" | awk '{print $2}' | sed 's|.*:||'); echo "$img" > "$SB/live_image"; exit 0;;
  "compose "*) echo "[compose $2 ok] live=$(cat "$SB/live_image")"; exit 0;;
esac
exit 0
EOF
cat > "$SB/bin/curl" <<'EOF'
#!/usr/bin/env bash
SB=${SB:?}; SC=${SCENARIO:?}
url=${@: -1}
case "$url" in
  *8002/health) [ "$(cat "$SB/canary_running")" = 1 ] && exit 0 || exit 22;;
  *8001/health) live=$(cat "$SB/live_image")
     if [ "$live" = NEWSHA ] && [ "$SC" = swap_fail ]; then exit 22; fi; exit 0;;
esac
exit 22
EOF
for t in systemctl caddy journalctl sleep; do printf '#!/usr/bin/env bash\nexit 0\n' > "$SB/bin/$t"; done
chmod +x "$SB/bin/"*

echo "=== scenario: $SCENARIO"
( export SB SCENARIO PATH="$SB/bin:$PATH" GITHUB_SHA=NEWSHA GITHUB_ACTOR=x GHCR_TOKEN=y SAFEDEAL_API_KEY= SAFEDEAL_WEBHOOK_SECRET=; bash "$SB/script.sh" )
rc=$?
echo "=== exit=$rc  pinned=$(grep -E '^\s*image:' "$SB/opt/dynopay/docker-compose.yml" | awk '{print $2}')  live=$(cat "$SB/live_image")  canary_running=$(cat "$SB/canary_running")  canary_file=$([ -f "$SB/opt/dynopay/docker-compose.canary.yml" ] && echo LEFT_BEHIND || echo removed)"
grep -cE 'rmi|images --format' "$SB/calls.log" | xargs echo "cleanup calls:"
rm -rf "$SB"
