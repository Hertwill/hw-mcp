// Shared building blocks
export {
  PaginationInput,
  PriceRangeFilter,
  ProductIdParam,
  ProductIdArrayParam,
} from "./common.js";

// Tool input schemas
export {
  SearchProductsInput,
  type SearchProductsParams,
} from "./search-products.js";
export { ListProductsInput, type ListProductsParams } from "./list-products.js";
export { GetProductInput, type GetProductParams } from "./get-product.js";
export {
  EvaluateProductInput,
  type EvaluateProductParams,
} from "./evaluate-product.js";
export {
  CalculateMarginInput,
  type CalculateMarginParams,
} from "./calculate-margin.js";
export { CheckHealthInput, type CheckHealthParams } from "./check-health.js";
export {
  ListImportListInput,
  type ListImportListParams,
} from "./list-import-list.js";
export {
  AddToImportListInput,
  type AddToImportListParams,
} from "./add-to-import-list.js";
export {
  RemoveFromImportListInput,
  type RemoveFromImportListParams,
} from "./remove-from-import-list.js";
export { SyncProductsInput, type SyncProductsParams } from "./sync-products.js";
export { GetSyncJobsInput, type GetSyncJobsParams } from "./get-sync-jobs.js";
export { CheckAuthInput, type CheckAuthParams } from "./check-auth.js";
