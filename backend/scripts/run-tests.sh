#!/bin/bash
# ============================================================================
# DynoPay backend test runner — FOREGROUND, BATCHED (agent-tool safe)
#
# WHY THIS EXISTS (2026-08):
#  - NEVER background jest from an agent shell (`yarn test &`, nohup, disown):
#    the detached node children inherit the shell's output pipe, the tool
#    wrapper waits for EOF that never comes, and the call dies without output.
#  - /tmp IS WIPED on pod restart — logs and the default jest/ts-jest cache
#    must live under /app. Cache: backend/.jest-cache (see jest.config.ts).
#  - A full cold suite overran the tool window; batches keep every single
#    invocation well under ~100s (warm cache runs are far faster).
#
# USAGE (from /app/backend):
#   sh scripts/run-tests.sh              # unit batches + redis project (safe, mocked)
#   sh scripts/run-tests.sh --batch 2    # run only batch #2 (see BATCHES below)
#   sh scripts/run-tests.sh --integration# ⚠ ALSO run live-server integration tests
#                                        #   (preview = LIVE prod DB — opt-in only)
#
# Output: streamed to stdout AND appended to /app/backend/test-run.log
# ============================================================================
set -u
set -o pipefail  # tee must not swallow jest's exit code
cd "$(dirname "$0")/.."
LOG=/app/backend/test-run.log
JEST="node_modules/.bin/jest --config jest.config.ts --forceExit --silent"

# Unit test files grouped so each batch stays well under the agent tool timeout.
BATCH_1="__tests__/feeCalculation.test.ts __tests__/feeConfigUtils.test.ts __tests__/feeRateService.test.ts __tests__/feeService.test.ts __tests__/paymentFees.test.ts"
BATCH_2="__tests__/settlementMath.test.ts __tests__/paymentStateMachine.test.ts __tests__/cryptoClassification.test.ts __tests__/confirmationRequirements.test.ts __tests__/settlementModuleResolution.test.ts"
BATCH_3="__tests__/webhookProcessor.test.ts __tests__/webhookHandlers.test.ts __tests__/adminWalletMapping.test.ts __tests__/blockchainFeeService.test.ts __tests__/merchantPoolConfig.test.ts"
# Batch 4 catches suites added after the original batching (ledger + webhook events).
BATCH_4="__tests__/ledgerDecimals.test.ts __tests__/ledgerPaymentMapper.test.ts __tests__/webhookEvents.test.ts"

run() {
  label="$1"; shift
  echo "== [$label] $(date -u +%H:%M:%S) ==" | tee -a "$LOG"
  # shellcheck disable=SC2086
  $JEST $@ 2>&1 | tee -a "$LOG"
  rc=$?
  echo "== [$label] exit $rc ==" | tee -a "$LOG"
  [ $rc -ne 0 ] && OVERALL=1
  return 0
}

OVERALL=0
ONLY_BATCH=""
WITH_INTEGRATION=0
while [ $# -gt 0 ]; do
  case "$1" in
    --batch) ONLY_BATCH="$2"; shift 2 ;;
    --integration) WITH_INTEGRATION=1; shift ;;
    *) shift ;;
  esac
done

echo "===== test run $(date -u '+%Y-%m-%d %H:%M:%S') UTC =====" >> "$LOG"

if [ -n "$ONLY_BATCH" ]; then
  eval "FILES=\$BATCH_$ONLY_BATCH"
  run "unit batch $ONLY_BATCH" --selectProjects unit --runTestsByPath $FILES
else
  run "unit batch 1 (fees)"        --selectProjects unit --runTestsByPath $BATCH_1
  run "unit batch 2 (settlement)"  --selectProjects unit --runTestsByPath $BATCH_2
  run "unit batch 3 (webhooks)"    --selectProjects unit --runTestsByPath $BATCH_3
  run "unit batch 4 (ledger+events)" --selectProjects unit --runTestsByPath $BATCH_4
  run "redis project"              --selectProjects redis
fi

if [ "$WITH_INTEGRATION" = "1" ]; then
  echo "⚠️  Running INTEGRATION tests against the LIVE server (prod DB in preview)" | tee -a "$LOG"
  run "integration" --selectProjects integration
fi

echo "===== overall exit: $OVERALL =====" | tee -a "$LOG"
exit $OVERALL
