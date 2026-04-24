import { setupServer } from "msw/node";
import { handlers } from "./handlers.js";

export const mockServer = setupServer(...handlers);
