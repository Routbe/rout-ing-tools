import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";


const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

/**
 * Baseline security headers on every response.
 *
 * Deliberately no X-Frame-Options: the Lovable editor renders the app in an
 * iframe, and framing protection for the published site belongs in the hosting
 * layer. No Access-Control-Allow-Origin either — the database gateway and every
 * other server function are same-origin only, so no browser outside our own
 * domains can call them at all.
 */
const securityHeadersMiddleware = createMiddleware().server(async ({ next }) => {
  const result = await next();
  const response = (result as { response?: Response }).response;
  const headers = response?.headers;
  if (headers) {
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("X-DNS-Prefetch-Control", "off");
    headers.set("Permissions-Policy", "geolocation=(), microphone=(), payment=()");
  }
  return result;
});

// Sessions are carried by the httpOnly `rout_session` cookie (Neon), so no
// client-side token attacher is needed on server functions.
export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, securityHeadersMiddleware, csrfMiddleware],
}));


