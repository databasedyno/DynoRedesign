# Railway Deployment Access — DynoPay

## Credentials

| Key | Value |
|-----|-------|
| **Token** | `8d64cde8-a022-4485-9cd7-ae138aa45313` |
| **Token Type** | Project-Access-Token (scoped to this project) |
| **Project ID** | `64052ce1-2ba2-4345-bf65-449c01cb77ef` |
| **Service ID** | `ec021102-c129-48c5-a9a9-ef54108af927` |
| **Environment** | `production` — ID: `77215087-a0dd-438b-ba84-1480def90f7a` |

## GraphQL API (WORKING)

**Endpoint:** `https://backboard.railway.com/graphql/v2`  
**Auth header:** `Project-Access-Token: 8d64cde8-a022-4485-9cd7-ae138aa45313`

> ⚠️ `Authorization: Bearer <token>` does NOT work with this token type. Must use `Project-Access-Token` header.

### Get Latest Deployments
```bash
curl -s -X POST https://backboard.railway.com/graphql/v2 \
  -H "Content-Type: application/json" \
  -H "Project-Access-Token: 8d64cde8-a022-4485-9cd7-ae138aa45313" \
  -d '{
    "query": "{ deployments(first: 5, input: { projectId: \"64052ce1-2ba2-4345-bf65-449c01cb77ef\", serviceId: \"ec021102-c129-48c5-a9a9-ef54108af927\", environmentId: \"77215087-a0dd-438b-ba84-1480def90f7a\" }) { edges { node { id status createdAt updatedAt staticUrl } } } }"
  }'
```

### Get Deployment Logs (runtime)
```bash
# Replace DEPLOYMENT_ID with actual deployment ID from above
curl -s -X POST https://backboard.railway.com/graphql/v2 \
  -H "Content-Type: application/json" \
  -H "Project-Access-Token: 8d64cde8-a022-4485-9cd7-ae138aa45313" \
  -d '{
    "query": "{ deploymentLogs(deploymentId: \"DEPLOYMENT_ID\", limit: 2000) { message timestamp severity } }"
  }'
```

### Get Deployment Logs (with time filter)
```bash
curl -s -X POST https://backboard.railway.com/graphql/v2 \
  -H "Content-Type: application/json" \
  -H "Project-Access-Token: 8d64cde8-a022-4485-9cd7-ae138aa45313" \
  -d '{
    "query": "{ deploymentLogs(deploymentId: \"DEPLOYMENT_ID\", limit: 2000, endDate: \"2026-02-18T12:30:00Z\") { message timestamp severity } }"
  }'
```

### Get HTTP Logs (request/response level)
```bash
curl -s -X POST https://backboard.railway.com/graphql/v2 \
  -H "Content-Type: application/json" \
  -H "Project-Access-Token: 8d64cde8-a022-4485-9cd7-ae138aa45313" \
  -d '{
    "query": "{ httpLogs(deploymentId: \"DEPLOYMENT_ID\", limit: 100, startDate: \"2026-02-18T12:00:00Z\", endDate: \"2026-02-18T14:00:00Z\") { method path httpStatus timestamp srcIp totalDuration } }"
  }'
```

### Get Environments
```bash
curl -s -X POST https://backboard.railway.com/graphql/v2 \
  -H "Content-Type: application/json" \
  -H "Project-Access-Token: 8d64cde8-a022-4485-9cd7-ae138aa45313" \
  -d '{
    "query": "{ environments(projectId: \"64052ce1-2ba2-4345-bf65-449c01cb77ef\") { edges { node { id name } } } }"
  }'
```

## GraphQL Schema (key types)

### Log fields
`message`, `timestamp`, `severity`

### HttpLog fields
`method`, `path`, `httpStatus`, `timestamp`, `srcIp`, `totalDuration`, `requestId`, `host`, `clientIp`, `httpVersion`, `scheme`, `edgeRegion`, `srcLat`, `srcLon`

### Deployment fields
`id`, `status`, `createdAt`, `updatedAt`, `staticUrl`

## Railway CLI

**Install:**
```bash
bash <(curl -fsSL cli.new)
```

> ⚠️ CLI uses `RAILWAY_TOKEN` env var but this Project-Access-Token does NOT work with CLI (returns Unauthorized). CLI requires an Account-level token from Railway Dashboard → Account Settings → Tokens.

## Quick Log Search Script

Save as `/app/scripts/railway-logs.sh`:
```bash
#!/bin/bash
# Usage: ./railway-logs.sh <deployment_id> [search_term] [limit]
DEPLOY_ID=${1:?"Usage: $0 <deployment_id> [search_term] [limit]"}
SEARCH=${2:-""}
LIMIT=${3:-2000}

curl -s -X POST https://backboard.railway.com/graphql/v2 \
  -H "Content-Type: application/json" \
  -H "Project-Access-Token: 8d64cde8-a022-4485-9cd7-ae138aa45313" \
  -d "{\"query\": \"{ deploymentLogs(deploymentId: \\\"$DEPLOY_ID\\\", limit: $LIMIT) { message timestamp severity } }\"}" \
  | python3 -c "
import json, sys
data = json.load(sys.stdin)
logs = data.get('data', {}).get('deploymentLogs', [])
search = '$SEARCH'.lower()
for log in logs:
    msg = log.get('message', '')
    if not search or search in msg.lower():
        print(f'[{log[\"timestamp\"][:19]}] [{log[\"severity\"]}] {msg}')
"
```
