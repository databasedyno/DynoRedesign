#!/usr/bin/env bash
# E2E: "sign out all other devices" must kill every other token (tracked or not) and keep the caller alive.
set -u
API=${API:-https://passphrase-init.preview.emergentagent.com}
EMAIL=onarrival21@gmail.com
PASS='Katiekendra123@'

login() { # $1 = user-agent
  curl -s -X POST "$API/api/user/login" -H "Content-Type: application/json" -H "User-Agent: $1" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}"
}
field() { python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['$1'])"; }
code() { # $1 = token, $2 = path
  curl -s -o /dev/null -w "%{http_code}" "$API/api/user/$2" -H "Authorization: Bearer $1"
}

DESK=$(login "Mozilla/5.0 (Windows NT 10.0) Chrome/120")
DESK_TOKEN=$(echo "$DESK" | field accessToken); DESK_REFRESH=$(echo "$DESK" | field refreshToken)
MOB=$(login "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1 Mobile")
MOB_TOKEN=$(echo "$MOB" | field accessToken); MOB_REFRESH=$(echo "$MOB" | field refreshToken)

# Untracked token: signed with the server secret but no tbl_user_session row (simulates auto-login / legacy tokens).
UNTRACKED=$(cd /app/backend && node -e '
  require("dotenv").config();
  const jwt=require("jsonwebtoken");
  console.log(jwt.sign({user_id:1,email:process.argv[1]}, process.env.ACCESS_TOKEN_SECRET, {expiresIn:"7d"}));
' "$EMAIL")

echo "[before] desktop=$(code "$DESK_TOKEN" session-check) mobile=$(code "$MOB_TOKEN" session-check) untracked=$(code "$UNTRACKED" session-check)  (expect 200 200 200)"

sleep 1.2  # ensure the cutoff second is strictly after the tokens' iat
REV=$(curl -s -X DELETE "$API/api/user/sessions" -H "Authorization: Bearer $DESK_TOKEN" -H "Content-Type: application/json")
echo "[revoke] $(echo "$REV" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("message"), d.get("data"))')"

echo "[after]  desktop=$(code "$DESK_TOKEN" session-check) mobile=$(code "$MOB_TOKEN" session-check) untracked=$(code "$UNTRACKED" session-check)  (expect 200 401 401)"
echo "[after]  desktop /sessions=$(code "$DESK_TOKEN" sessions) mobile /sessions=$(code "$MOB_TOKEN" sessions)  (expect 200 401)"

MOB_REFRESH_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/user/refresh-token" -H "Content-Type: application/json" -d "{\"refresh_token\":\"$MOB_REFRESH\"}")
DESK_REFRESH_RES=$(curl -s -X POST "$API/api/user/refresh-token" -H "Content-Type: application/json" -d "{\"refresh_token\":\"$DESK_REFRESH\"}")
DESK_NEW_TOKEN=$(echo "$DESK_REFRESH_RES" | python3 -c "import sys,json;d=json.load(sys.stdin);print((d.get('data') or {}).get('accessToken',''))")
echo "[refresh] mobile refresh=$MOB_REFRESH_CODE (expect 401); desktop refresh ok=$([ -n "$DESK_NEW_TOKEN" ] && echo yes || echo no); new desktop token session-check=$(code "$DESK_NEW_TOKEN" session-check) (expect 200)"

# Second click from the same (kept) device must still keep it alive.
curl -s -o /dev/null -X DELETE "$API/api/user/sessions" -H "Authorization: Bearer $DESK_NEW_TOKEN"
echo "[twice]  desktop=$(code "$DESK_NEW_TOKEN" session-check) (expect 200)"

# Fresh login AFTER the cutoff must work.
NEW=$(login "Mozilla/5.0 (iPhone) Mobile")
NEW_TOKEN=$(echo "$NEW" | field accessToken)
echo "[relogin] new mobile login=$(code "$NEW_TOKEN" session-check) (expect 200)"
echo "[list]  $(curl -s "$API/api/user/sessions" -H "Authorization: Bearer $DESK_NEW_TOKEN" | python3 -c 'import sys,json;d=json.load(sys.stdin)["data"];print("active sessions:",d["total"],[ (s["device_name"], s["is_current"]) for s in d["sessions"]])')"
