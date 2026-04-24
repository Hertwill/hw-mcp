import { z } from "zod";

// Register response: POST /v1/auth/register returns 201 with no structured body per spec
// We accept an optional data envelope for forward compatibility
export const RegisterResponseSchema = z.object({
  data: z
    .object({
      user: z.object({}).optional(),
      message: z.string().optional(),
    })
    .optional(),
});

export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;

// Login response: POST /v1/auth/login
export const LoginResponseSchema = z.object({
  data: z.object({
    token: z.string(),
    refresh_token: z.string(),
    user: z.object({}).optional(),
  }),
});

export type LoginResponse = z.infer<typeof LoginResponseSchema>;

// Refresh response: POST /v1/auth/refresh
export const RefreshResponseSchema = z.object({
  data: z.object({
    token: z.string(),
    refresh_token: z.string(),
    user: z.object({}).optional(),
  }),
});

export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;

// API key shape (id, name, prefix, key, store_id, created_at)
export const ApiKeySchema = z.object({
  id: z.number(),
  name: z.string(),
  prefix: z.string(),
  key: z.string().optional(), // Only present on creation (shown once)
  store_id: z.number().optional(),
  created_at: z.string(),
});

export type ApiKey = z.infer<typeof ApiKeySchema>;

// Create API key response: POST /v1/api-keys
export const CreateApiKeyResponseSchema = z.object({
  data: ApiKeySchema,
});

export type CreateApiKeyResponse = z.infer<typeof CreateApiKeyResponseSchema>;

// Revoke API key response: DELETE /v1/api-keys/{id}
// Returns 200 with optional message
export const RevokeApiKeyResponseSchema = z.object({
  data: z
    .object({
      message: z.string().optional(),
    })
    .optional(),
});

export type RevokeApiKeyResponse = z.infer<typeof RevokeApiKeyResponseSchema>;
