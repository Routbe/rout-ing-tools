import { createServerFn } from "@tanstack/react-start";

/**
 * Tells the sign-in page which external providers actually have credentials in
 * this deployment, so a button is only ever offered when it can work. No secret
 * value crosses the wire — only booleans.
 */
export const getSocialProviderStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { isProviderConfigured } = await import("./social-oauth.server");
  return {
    google: isProviderConfigured("google"),
    github: isProviderConfigured("github"),
    gitlab: isProviderConfigured("gitlab"),
  };
});
