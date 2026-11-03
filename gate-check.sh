#!/usr/bin/env bash
# gate-check.sh — mechanical gate criteria for the H-series contract.
# Runs every check a gate needs and prints a table. No model required.
#
#   ./gate-check.sh            local checks only
#   ./gate-check.sh --live     local + live probes against the deployed services
#
# Exit 0 = every check passed. Exit 1 = at least one FAIL.
# Put the output in the ruling file. That IS the evidence.

set -uo pipefail

# ── configure once ────────────────────────────────────────────────────
PKG="${PKG:-pnpm}"                       # pnpm | npm | yarn
API_URL="${API_URL:-https://voltura-api.onrender.com}"
WEB_URL="${WEB_URL:-https://voltura-web.onrender.com}"
# Counts moved at H-S: +5 api-server tests for the F2 PDF scoping lock.
# 108 -> 113 total, 36 -> 41 api. Deleting audio/ and image/ moved nothing:
# chat/routes.test.ts was the only test file in that subtree.
# Moved again at H1: +5 for the -999 and partial-coverage locks (A3.6, A3.7),
# +4 for /api/version. 113 -> 122 total, 41 -> 50 api. Then +9 for H1.5s
# carbon-intensity lock: 122 -> 131 total, 50 -> 59 api.
# Found 19 short on arrival at H-OPT (2026-09-11): the tree was already at
# 150 total / 78 api against a config saying 131 / 59, so the row had been
# failing since something after H1.5 landed without touching these constants.
# Recorded in the H-OPT ruling rather than quietly corrected.
# H-OPT adds 49 api tests — 17 sizing, 16 optimize route, +14 net across the
# rewritten optimize-payload and shared-routes files: 150 -> 199 total,
# 78 -> 127 api.
EXPECTED_TOTAL_TESTS="${EXPECTED_TOTAL_TESTS:-199}"
EXPECTED_API_TESTS="${EXPECTED_API_TESTS:-127}"
EXPECTED_ASSISTANT_TESTS="${EXPECTED_ASSISTANT_TESTS:-9}"
EXPECTED_F2_TESTS="${EXPECTED_F2_TESTS:-5}"
# G4 as narrowed by amendment A14 (26 Aug 2026): chat/ is the protected subtree,
# not the parent. audio/, image/ and batch/ are deletable, so "parent exists" no
# longer proves the Assistant survived — chat/ deleted with audio/ left standing
# would have printed PASS.
PROTECTED_DIR="artifacts/api-server/src/replit_integrations/chat"
# ──────────────────────────────────────────────────────────────────────

PASS=0; FAIL=0; SKIP=0
ROWS=()

row() { ROWS+=("$1|$2|$3"); case "$1" in
  PASS) PASS=$((PASS+1));; FAIL) FAIL=$((FAIL+1));; *) SKIP=$((SKIP+1));; esac; }

have() { command -v "$1" >/dev/null 2>&1; }

# ══ 1. git state ══════════════════════════════════════════════════════
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")
TIP=$(git rev-parse --short HEAD 2>/dev/null || echo "?")
MAIN=$(git rev-parse --short main 2>/dev/null || echo "?")
DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null | wc -l | tr -d ' ')

row INFO "branch"            "$BRANCH @ $TIP   (main @ $MAIN)"
if [ "$DIRTY" -eq 0 ]; then
  row PASS "working tree"    "clean"
else
  row FAIL "working tree"    "$DIRTY modified, $UNTRACKED untracked — G13: commit before session end"
fi
if [ "$BRANCH" = "main" ]; then
  row FAIL "G1 not on main"  "you are ON main — never commit here"
else
  row PASS "G1 not on main"  "$BRANCH"
fi

# ══ 2. G4 — the Assistant must survive ════════════════════════════════
if [ -d "$PROTECTED_DIR" ]; then
  row PASS "G4 assistant dir" "$PROTECTED_DIR present"
else
  row FAIL "G4 assistant dir" "MISSING — $PROTECTED_DIR was deleted. Stop."
fi

# ══ 3. typecheck ══════════════════════════════════════════════════════
if have "$PKG"; then
  TC=$($PKG -r exec tsc --noEmit 2>&1); TC_RC=$?
  TC_ERRS=$(printf '%s' "$TC" | grep -cE 'error TS' || true)
  if [ "$TC_RC" -eq 0 ] && [ "$TC_ERRS" -eq 0 ]; then
    row PASS "typecheck"     "0 errors"
  else
    row FAIL "typecheck"     "$TC_ERRS errors"
  fi
else
  row SKIP "typecheck"       "$PKG not found"
fi

# ══ 4. tests + the counts that matter ═════════════════════════════════
if have "$PKG"; then
  TOUT=$($PKG -r test 2>&1); T_RC=$?
  # Strip ANSI before parsing: vitest colours its summary, and the escape bytes
  # sit between the label and the number.
  #
  # Anchor on "Tests" specifically. The old pattern was a bare
  # `[0-9]+ (passed|passing)`, which also matched the "Test Files N passed"
  # line above it and silently added the file count to the test count — 2+72+
  # 4+36 = 114 against an EXPECTED_TOTAL_TESTS of 108, so this row could never
  # go green. Fixed at H-S.
  TOTAL=$(printf '%s' "$TOUT" | sed -e 's/\x1b\[[0-9;]*m//g' \
          | grep -oE '(^|[^[:alpha:]])Tests[[:space:]]+[0-9]+ (passed|passing)' \
          | grep -oE '[0-9]+' | awk '{s+=$1} END {print s+0}')
  if [ "$T_RC" -eq 0 ]; then
    row PASS "suite green"   "exit 0"
  else
    row FAIL "suite green"   "exit $T_RC"
  fi
  if [ "$TOTAL" -eq "$EXPECTED_TOTAL_TESTS" ]; then
    row PASS "total tests"   "$TOTAL"
  else
    row FAIL "total tests"   "$TOTAL, expected $EXPECTED_TOTAL_TESTS — read the diff, don't just recount"
  fi

  ASSIST=$(grep -rlE "(describe|test|it)\(" "$PROTECTED_DIR" 2>/dev/null \
           | xargs grep -hcE "^\s*(test|it)\(" 2>/dev/null | awk '{s+=$1} END {print s+0}')
  if [ "$ASSIST" -ge "$EXPECTED_ASSISTANT_TESTS" ]; then
    row PASS "assistant tests" "$ASSIST found (expect $EXPECTED_ASSISTANT_TESTS)"
  else
    row FAIL "assistant tests" "$ASSIST found, expected $EXPECTED_ASSISTANT_TESTS — G4"
  fi
else
  row SKIP "tests"           "$PKG not found"
fi

# ══ 4b. F2 — the PDF route must reject a session-less request ═════════
# Tests the property, not C8's trigger. C8 fires on "first external user OR
# first real AVRA data", neither of which a script can observe; this asserts
# the access control that made C8 deferrable in the first place.
#
# Local and offline: the test mocks ../db and ../storage and boots express on
# port 0. No production, and no DB — index.ts runs DDL before listen (G3), so
# booting the real server here would be a schema write.
if have "$PKG"; then
  F2OUT=$(cd artifacts/api-server && $PKG exec vitest run src/routes/pdf-session-scope.test.ts 2>&1)
  F2_RC=$?
  F2_PASS=$(printf '%s' "$F2OUT" | sed -e 's/\x1b\[[0-9;]*m//g' \
            | grep -oE '(^|[^[:alpha:]])Tests[[:space:]]+[0-9]+ passed' \
            | grep -oE '[0-9]+' | head -1)
  if [ "$F2_RC" -eq 0 ] && [ "${F2_PASS:-0}" -ge "$EXPECTED_F2_TESTS" ]; then
    row PASS "F2 pdf scoped"  "${F2_PASS} passed — no header 400, wrong session 404, no oracle"
  else
    row FAIL "F2 pdf scoped"  "exit $F2_RC, ${F2_PASS:-0} passed (expect $EXPECTED_F2_TESTS) — /api/calculate/:id/pdf may be enumerable again"
  fi
else
  row SKIP "F2 pdf scoped"   "$PKG not found"
fi

# ══ 5. G5 — no numeric || defaults (comments excluded) ════════════════
NUMDEF=$(grep -rnE '\|\|\s*-?[0-9]+(\.[0-9]+)?\b' \
          --include='*.ts' --include='*.tsx' \
          --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=artifacts/greencalc . 2>/dev/null \
        | grep -vE ':\s*(//|\*|/\*)' || true)
if [ -z "$NUMDEF" ]; then
  row PASS "G5 no numeric default" "none in code"
else
  row FAIL "G5 no numeric default" "$(printf '%s' "$NUMDEF" | wc -l | tr -d ' ') hit(s) — OPEN AND READ each, comments are excluded already"
  printf '%s\n' "$NUMDEF" | sed 's/^/        /' >&2
fi

# ══ 6. -999 guard present at the parse boundary ═══════════════════════
GUARD=$(grep -rn -- '-999' --include='*.ts' \
         --exclude-dir=node_modules --exclude-dir=dist . 2>/dev/null | wc -l | tr -d ' ')
if [ "$GUARD" -gt 0 ]; then
  row PASS "-999 guard"      "$GUARD reference(s) in TS — verify it's a rejection, not a substitution"
else
  row FAIL "-999 guard"      "no reference — H1.0 not shipped (latent until the year is parameterised)"
fi

# ══ 7. P7 — forbidden vocabulary ══════════════════════════════════════
# Governance prose is excluded by LOCATION, never by pattern. The rule text
# that forbids a phrase necessarily contains the phrase: P7's own definition
# at HEATSHIELD_CONTRACT.md:98 tripped this check, as did the line in
# docs/ stating the tool does NOT produce a habitability grade. contracts/
# was already excluded for the same reason; the root contract and docs/ are
# the same category and were simply missed.
#
# What the check LOOKS FOR is unchanged. Narrowing the pattern would be
# loosening a legal-exposure check; narrowing the search path is not.
# The accepted cost: prose under docs/ can now carry the vocabulary without
# tripping this. Shipped code and UI strings are still fully covered.
P7=$(grep -rniE '\b(heatshield (grade|rating)|habitability (grade|rating)|compliance result|TM59-compliant)\b' \
      --include='*.ts' --include='*.tsx' --include='*.json' --include='*.md' \
      --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=contracts \
      --exclude-dir=docs --exclude=HEATSHIELD_CONTRACT.md . 2>/dev/null || true)
if [ -z "$P7" ]; then
  row PASS "P7 vocabulary"   "clean"
else
  row FAIL "P7 vocabulary"   "$(printf '%s' "$P7" | wc -l | tr -d ' ') hit(s) — legal exposure, not style"
fi

# ══ 8. the retired figures must not reappear ══════════════════════════
# Location exclusions as P7, PLUS a comment-line filter — A17, 27 Aug 2026.
#
# The filter is byte-identical to G5's below, deliberately: one idiom, not two.
# It changes WHAT this row matches, not only where it looks, which is why it
# needed a ruling of its own.
#
# WHAT NOW SLIPS PAST, stated rather than discovered later:
#   1. A retired figure in a // comment, a /* block, or a JSDoc continuation
#      line beginning *. This is the intended relief - calculate.test.ts:18
#      documents the defect that produced these figures.
#   2. MARKDOWN BULLETS. This checker includes *.md, and a list item written
#      "* 4,203 kWh" begins with * and is skipped. A "-" bullet is still
#      caught. A claims document could therefore carry the overstated figure
#      in a starred bullet and pass this row. Known hole, named in A17, not
#      inherited silently from G5.
#   3. A figure in a string literal on a line that happens to begin with *.
#
# WHAT IS STILL CAUGHT, which is the part that matters: any retired figure in
# executing code. `const x = 4203;` does not begin with a comment marker even
# with a trailing `// note`. Rendered UI strings, fixtures and JSON untouched.
OLD=$(grep -rnE '4203|4,203|1050\.70|1,050\.70' \
       --include='*.ts' --include='*.tsx' --include='*.json' --include='*.md' \
       --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=contracts \
       --exclude-dir=docs --exclude=HEATSHIELD_CONTRACT.md --exclude=README.md . 2>/dev/null \
     | grep -vE ':\s*(//|\*|/\*)' || true)
if [ -z "$OLD" ]; then
  row PASS "old figures"     "absent"
else
  row FAIL "old figures"     "4,203 / €1,050.70 present — overstates by 13.5%"
fi

# ══ 9. builds ═════════════════════════════════════════════════════════
if have "$PKG"; then
  if $PKG -r build >/dev/null 2>&1; then
    row PASS "builds"        "all packages"
  else
    row FAIL "builds"        "build failed"
  fi
fi

# ══ 10. live probes ═══════════════════════════════════════════════════
if [ "${1:-}" = "--live" ]; then
  if have curl; then
    HC=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$API_URL/healthz" || echo 000)
    [ "$HC" = "200" ] && row PASS "api healthz" "200" \
                      || row FAIL "api healthz" "$HC"

    VER=$(curl -s --max-time 20 "$API_URL/api/version" || true)
    if printf '%s' "$VER" | grep -qE '[0-9a-f]{7}'; then
      row PASS "api version"  "$(printf '%s' "$VER" | head -c 120)"
    else
      row SKIP "api version"  "no /api/version — the API blind spot (H1 side task)"
    fi

    SHA=$(curl -s --max-time 20 "$WEB_URL" | grep -oE 'build-sha[^0-9a-f]*[0-9a-f]{7,40}' | head -1 || true)
    if [ -n "$SHA" ]; then
      row INFO "web build-sha" "$SHA   ← compare to main @ $MAIN"
    else
      row SKIP "web build-sha" "not found in served HTML"
    fi
  else
    row SKIP "live probes"    "curl not found"
  fi
else
  row SKIP "live probes"      "re-run with --live"
fi

# ══ report ════════════════════════════════════════════════════════════
echo
printf '%-6s  %-20s  %s\n' "RESULT" "CHECK" "DETAIL"
printf '%-6s  %-20s  %s\n' "------" "--------------------" "------------------------------------"
for r in "${ROWS[@]}"; do
  IFS='|' read -r a b c <<< "$r"
  printf '%-6s  %-20s  %s\n' "$a" "$b" "$c"
done
echo
echo "PASS $PASS   FAIL $FAIL   SKIP $SKIP   —   $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "Paste this block into contracts/rulings/<block>-<gate>.md under TEST EVIDENCE."
[ "$FAIL" -eq 0 ] || echo "GATE NOT CLOSED — $FAIL failing check(s)."
exit $(( FAIL > 0 ? 1 : 0 ))
