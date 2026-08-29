/**
 * Passkeys (WebAuthn) need a trusted server to mint and verify challenges.
 * This app runs as a Vite SPA without that endpoint, so the
 * original TanStack Start implementation cannot be ported as-is. The exports
 * stay so the auth and settings screens compile; they fail loudly rather than
 * pretend to authenticate.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

const UNAVAILABLE = "Passkeys zijn niet beschikbaar in deze omgeving.";

const unsupported = async (..._args: any[]): Promise<any> => {
  throw new Error(UNAVAILABLE);
};

export const passkeysAvailable = false;

export const startPasskeyRegistration = unsupported;
export const finishPasskeyRegistration = unsupported;
export const startPasskeyLogin = unsupported;
export const finishPasskeyLogin = unsupported;
export const deletePasskey = unsupported;
export const listPasskeys = async (..._args: any[]): Promise<any> => [];
