import { afterAll, afterEach, beforeAll } from "vitest";
import { mockServer } from "./mocks/server.js";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());
