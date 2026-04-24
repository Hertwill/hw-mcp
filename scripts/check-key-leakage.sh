#!/bin/bash
set -euo pipefail

# SEC-03: Key-leakage prevention gate.
#
# Detects full API key values committed to the repository.
# Real Hertwill API keys follow the pattern:
#   hw_live_<32+ alphanumeric chars>  or  hw_test_<32+ alphanumeric chars>
#
# A 16-char length threshold after the prefix distinguishes real keys from
# short test fixtures like hw_test_FAKEKEY (7 chars) or hw_live_a1b2c3d4 (8 chars)
# used legitimately in mock data and comments.
#
# Scanned: src/ tests/ scripts/ skills/ docs/
# Excluded: src/hertwill/generated/ (auto-generated OpenAPI types with spec examples)
#           node_modules/ dist/ vendor/ .git/

PATTERN='hw_(live|test)_[a-zA-Z0-9]{16,}'

LEAKS=$(grep -rEn "$PATTERN" \
  src/ tests/ scripts/ skills/ docs/ \
  --include="*.ts" --include="*.js" --include="*.mjs" --include="*.md" --include="*.sh" \
  --exclude-dir=generated --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=vendor \
  2>/dev/null || true)

if [ -n "$LEAKS" ]; then
  echo "ERROR: Full-length API key value found in repository (SEC-03):"
  echo "$LEAKS"
  echo ""
  echo "If this is a test fixture, shorten it to fewer than 16 chars after the prefix."
  echo "If this is a real key, remove it immediately and rotate the key."
  exit 1
fi

echo "Key-leakage gate passed: no full-length hw_live_/hw_test_ key values found."
