#!/usr/bin/env bash
set -euo pipefail

ERRORS=0

# CLIENT-01: Only src/hertwill/client.ts should import openapi-fetch
OPFETCH_IMPORTS=$(grep -rl "from.*openapi-fetch" src/ --include="*.ts" | grep -v "src/hertwill/client.ts" || true)
if [ -n "$OPFETCH_IMPORTS" ]; then
  echo "ERROR [CLIENT-01]: openapi-fetch imported outside src/hertwill/client.ts:"
  echo "$OPFETCH_IMPORTS"
  ERRORS=$((ERRORS + 1))
fi

# CLIENT-08a: src/hertwill/ must not import @modelcontextprotocol/sdk
SDK_IN_HERTWILL=$(grep -rl "from.*@modelcontextprotocol/sdk" src/hertwill/ --include="*.ts" 2>/dev/null || true)
if [ -n "$SDK_IN_HERTWILL" ]; then
  echo "ERROR [CLIENT-08]: @modelcontextprotocol/sdk imported in src/hertwill/:"
  echo "$SDK_IN_HERTWILL"
  ERRORS=$((ERRORS + 1))
fi

# CLIENT-08b: src/tools/ may only use "import type" from @modelcontextprotocol/sdk
# Type imports (McpServer, CallToolResult) are needed for registration and return
# types. Value imports are forbidden to keep the tool layer transport-agnostic.
if [ -d "src/tools" ]; then
  SDK_VALUE_IN_TOOLS=$(grep -rn "from.*@modelcontextprotocol/sdk" src/tools/ --include="*.ts" 2>/dev/null | grep -v "import type" || true)
  if [ -n "$SDK_VALUE_IN_TOOLS" ]; then
    echo "ERROR [CLIENT-08]: src/tools/ has value imports from @modelcontextprotocol/sdk (only 'import type' permitted):"
    echo "$SDK_VALUE_IN_TOOLS"
    ERRORS=$((ERRORS + 1))
  fi
fi

# CLIENT-08c: src/errors/ must not import @modelcontextprotocol/sdk
SDK_IN_ERRORS=$(grep -rl "from.*@modelcontextprotocol/sdk" src/errors/ --include="*.ts" 2>/dev/null || true)
if [ -n "$SDK_IN_ERRORS" ]; then
  echo "ERROR [CLIENT-08]: @modelcontextprotocol/sdk imported in src/errors/:"
  echo "$SDK_IN_ERRORS"
  ERRORS=$((ERRORS + 1))
fi

# RES-BOUNDARY: src/resources/ may only use "import type" from @modelcontextprotocol/sdk
# Value imports (without "type") are forbidden to keep the resource layer isolated.
if [ -d "src/resources" ]; then
  SDK_VALUE_IN_RESOURCES=$(grep -rn "from.*@modelcontextprotocol/sdk" src/resources/ --include="*.ts" 2>/dev/null | grep -v "import type" || true)
  if [ -n "$SDK_VALUE_IN_RESOURCES" ]; then
    echo "ERROR [RES-BOUNDARY]: src/resources/ has value imports from @modelcontextprotocol/sdk (only 'import type' permitted):"
    echo "$SDK_VALUE_IN_RESOURCES"
    ERRORS=$((ERRORS + 1))
  fi
fi

# PROMPT-BOUNDARY: src/prompts/ may only use "import type" from @modelcontextprotocol/sdk
if [ -d "src/prompts" ]; then
  SDK_VALUE_IN_PROMPTS=$(grep -rn "from.*@modelcontextprotocol/sdk" src/prompts/ --include="*.ts" 2>/dev/null | grep -v "import type" || true)
  if [ -n "$SDK_VALUE_IN_PROMPTS" ]; then
    echo "ERROR [PROMPT-BOUNDARY]: src/prompts/ has value imports from @modelcontextprotocol/sdk (only 'import type' permitted):"
    echo "$SDK_VALUE_IN_PROMPTS"
    ERRORS=$((ERRORS + 1))
  fi
fi

if [ "$ERRORS" -gt 0 ]; then
  echo "FAILED: $ERRORS import boundary violation(s) found"
  exit 1
fi

echo "Import boundaries OK"
