import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import { HertwillApiError } from "../errors/api-error.js";
import { mapHertwillError } from "../errors/map.js";
import { logger } from "../logger.js";
import { TOOL_ANNOTATIONS, TOOL_DESCRIPTIONS, TOOL_TITLES } from "../schemas/descriptions.js";
import { GetProductInput } from "../schemas/get-product.js";
import { transformProductDetail } from "../transforms/index.js";
import { toolResult } from "./helpers.js";
import type { ToolDeps } from "./types.js";

type Args = z.infer<typeof GetProductInput>;

export function createGetProductHandler(deps: ToolDeps) {
  return async (args: Args): Promise<CallToolResult> => {
    const reservoir = await deps.publicLimiter.currentReservoir();
    if (reservoir !== null && reservoir <= 0) {
      const retryAfter = deps.publicRateReset.secondsRemaining() ?? 60;
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Rate limit exceeded. Retry after ${retryAfter}s.`,
          },
        ],
      };
    }

    try {
      const raw = await deps.client.getProduct(args.product_id);
      const detail = transformProductDetail(raw.data);
      const variationCount = detail.variations.length;
      const variationText =
        variationCount === 0
          ? "no variations"
          : `${variationCount} variation${variationCount === 1 ? "" : "s"}`;
      const priceText = `€${detail.price.amount.toFixed(2)}`;
      const text = `Product ${detail.id}: "${raw.data.name}" — ${priceText}, stock ${detail.stock.stock_level}, ${variationText}.`;
      const result = toolResult(
        detail as unknown as Record<string, unknown>,
        text,
      );

      // Fetch featured image so the LLM can visually assess the product
      // (ad appeal, quality, category fit). User sees a "Show Image" button.
      // SECURITY: Only fetch from Hertwill's CDN — prevents SSRF via poisoned URLs.
      const IMAGE_HOST_ALLOWLIST = ["assets.hertwill.com"];
      const MAX_IMAGE_BYTES = 2_000_000; // 2 MB cap
      const featuredUrl = detail.images.featured;
      if (featuredUrl) {
        try {
          const parsed = new URL(featuredUrl);
          if (
            !IMAGE_HOST_ALLOWLIST.includes(parsed.hostname) ||
            parsed.protocol !== "https:"
          ) {
            logger.debug(
              { url: featuredUrl },
              "Image URL not on allowlist, skipping",
            );
          } else {
            const res = await fetch(featuredUrl, {
              signal: AbortSignal.timeout(5000),
            });
            if (res.ok) {
              const contentLength = res.headers.get("content-length");
              if (
                contentLength &&
                parseInt(contentLength, 10) > MAX_IMAGE_BYTES
              ) {
                logger.debug(
                  { url: featuredUrl, size: contentLength },
                  "Image too large, skipping",
                );
              } else {
                const mimeType =
                  res.headers.get("content-type") ?? "image/jpeg";
                const buf = await res.arrayBuffer();
                if (buf.byteLength <= MAX_IMAGE_BYTES) {
                  const data = Buffer.from(buf).toString("base64");
                  result.content.push({
                    type: "image",
                    data,
                    mimeType,
                  } as unknown as { type: "text"; text: string });
                }
              }
            }
          }
        } catch {
          logger.debug({ url: featuredUrl }, "Image fetch failed, skipping");
        }
      }

      return result;
    } catch (err) {
      const mapped = mapHertwillError(err);
      if (
        err instanceof HertwillApiError &&
        err.retryAfterSeconds !== undefined &&
        mapped.content[0]?.type === "text"
      ) {
        mapped.content[0].text = `Retry after ${err.retryAfterSeconds}s. ${mapped.content[0].text}`;
      }
      return mapped as CallToolResult;
    }
  };
}

export function registerGetProduct(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    "get_product",
    {
      title: TOOL_TITLES.get_product,
      description: TOOL_DESCRIPTIONS.get_product,
      inputSchema: GetProductInput.shape,
      annotations: TOOL_ANNOTATIONS.get_product,
    },
    createGetProductHandler(deps),
  );
}
