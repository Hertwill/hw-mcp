#!/bin/bash
set -euo pipefail

READS=$(grep -rn "process\.env\.HERTWILL_API_KEY" src/ --include="*.ts" | grep -v "^src/config.ts:" || true)

if [ -n "$READS" ]; then
  echo "ERROR: HERTWILL_API_KEY read outside src/config.ts:"
  echo "$READS"
  exit 1
fi

echo "Key-read gate passed: only src/config.ts reads the API key."
