import { defineConfig } from "@neon/config/v1";

/**
 * Neon infrastructure-as-code for the ROUT app.
 *
 * The app currently uses only Lakebase Postgres via Neon. Supabase remains
 * responsible for authentication and (URL-based) avatar storage, so Neon Auth,
 * the Data API, Object Storage, Functions and the AI Gateway are not declared
 * here.
 */
export default defineConfig({});
