# Hertwill API Rate Limits

## Buckets

- **Public (unauthenticated) bucket**: 60 requests per minute, enforced client-side via a Bottleneck token bucket.
- **Authenticated bucket** (when `HERTWILL_API_KEY` is set): 300 requests per minute, also enforced via Bottleneck.

The two buckets are independent. Public endpoints (search, list, get, categories, brands) drain the public bucket; endpoints that require a key (import list, sync, check_auth) drain the authenticated bucket.

## Retry-After contract

When the Hertwill API returns a 429, the MCP client reads the `Retry-After` header:

- If present, the client waits exactly `Retry-After` seconds before retrying (up to 3 retries, exponential backoff with jitter).
- If absent, the client falls back to a conservative 30-second backoff.

The client retries automatically on 429, 502, 503, and 504. All other 4xx errors surface immediately as `HertwillApiError` with sanitized `{status, code, message}` — headers and key material are stripped.

## What to do before you hit a 429

- Batch operations: `add_to_import_list` accepts 1–50 products in a single call. Don't loop single-item adds.
- Prefer resources (`hertwill://taxonomy/categories`, `hertwill://taxonomy/brands`) over `list_categories` / `list_brands` tool calls — resources are cached for 60 minutes in-process.
- Use `check_health` to inspect the current remaining budget of both buckets before firing a burst of calls.

## When you hit a 429 anyway

The client surfaces rate-limit errors with an actionable message. Wait for the `Retry-After` window and retry the single failing call — do not re-fire the whole batch.
