/**
 * Shared identity, flexible URL.
 *
 * A handle resolves through four interchangeable shapes:
 *   rout.be/u/jona · rout.be/u/@jona · rout.be/jona · rout.be/@jona
 *
 * All four render the exact same profile — the choice below only decides which
 * shape ROUT *shows* the member (dashboard, copy button, share sheet).
 */

export type UrlStyle = "u" | "u_at" | "clean" | "clean_at";

export const URL_STYLES: UrlStyle[] = ["u_at", "u", "clean_at", "clean"];

export const DEFAULT_URL_STYLE: UrlStyle = "u_at";

export const isUrlStyle = (value: unknown): value is UrlStyle =>
  typeof value === "string" && (URL_STYLES as string[]).includes(value);

/** Strips a leading @ and lowercases — the canonical database handle. */
export const canonicalHandle = (raw: string) => raw.replace(/^@+/, "").toLowerCase();

/** Path for a handle in the requested display style. */
export function styledProfilePath(handle: string, style: UrlStyle = DEFAULT_URL_STYLE): string {
  const h = canonicalHandle(handle);
  switch (style) {
    case "u":
      return `/u/${h}`;
    case "clean":
      return `/${h}`;
    case "clean_at":
      return `/@${h}`;
    case "u_at":
    default:
      return `/u/@${h}`;
  }
}

/** Human-facing URL without the scheme, e.g. `rout.be/u/@jona`. */
export function styledProfileLabel(
  handle: string,
  style: UrlStyle = DEFAULT_URL_STYLE,
  domain = "rout.be",
): string {
  return `${domain}${styledProfilePath(handle, style)}`;
}

export function styledProfileUrl(
  handle: string,
  style: UrlStyle = DEFAULT_URL_STYLE,
  origin = "https://rout.be",
): string {
  return `${origin.replace(/\/$/, "")}${styledProfilePath(handle, style)}`;
}

/** Every shape a visitor may type — used by tests and share copy. */
export const allProfilePaths = (handle: string) =>
  URL_STYLES.map((style) => styledProfilePath(handle, style));

/**
 * The shape ROUT may actually show for a member.
 *
 * Clean root URLs (`/jona`, `/@jona`) are part of the verified namespace, so an
 * unverified member's chosen style is folded back to its `/u/` twin — the `@`
 * preference is kept. Every shape still resolves to the same profile, this only
 * decides what the app displays and links to.
 */
export function effectiveUrlStyle(style: UrlStyle, verified: boolean): UrlStyle {
  if (verified) return style;
  if (style === "clean") return "u";
  if (style === "clean_at") return "u_at";
  return style;
}
