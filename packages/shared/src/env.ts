/**
 * Environment Configuration Loader
 *
 * MUST be imported first before any other modules
 * to ensure .env variables are loaded before config initialization
 */

import { config as dotenvConfig } from "dotenv";

// Load .env file immediately
dotenvConfig();

// Export a dummy value to ensure this module is imported
export const ENV_LOADED = true;
