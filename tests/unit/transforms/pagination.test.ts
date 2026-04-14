import { describe, expect, it } from "vitest";
import { transformPagination } from "../../../src/transforms/pagination.js";

describe("transformPagination (CONTRACT-08)", () => {
  it("sets has_more true and next-page hint when more pages remain", () => {
    const out = transformPagination(
      { page: 1, per_page: 20, total: 100, page_count: 5 },
      "search_products",
    );
    expect(out.pagination).toEqual({
      page: 1,
      per_page: 20,
      total: 100,
      has_more: true,
    });
    expect(out.hints.next_step).toBe(
      "Call search_products with page: 2 to see more results.",
    );
  });

  it("sets has_more false and last-page hint on the final page", () => {
    const out = transformPagination(
      { page: 5, per_page: 20, total: 100, page_count: 5 },
      "list_products",
    );
    expect(out.pagination.has_more).toBe(false);
    expect(out.hints.next_step).toBe("This is the last page of results.");
  });

  it("handles single-page results (page_count === 1)", () => {
    const out = transformPagination(
      { page: 1, per_page: 20, total: 3, page_count: 1 },
      "list_import_list",
    );
    expect(out.pagination.has_more).toBe(false);
    expect(out.hints.next_step).toBe("This is the last page of results.");
  });

  it("uses the provided tool name in the next-step hint", () => {
    const out = transformPagination(
      { page: 2, per_page: 10, total: 50, page_count: 5 },
      "get_sync_jobs",
    );
    expect(out.hints.next_step).toBe(
      "Call get_sync_jobs with page: 3 to see more results.",
    );
  });
});
