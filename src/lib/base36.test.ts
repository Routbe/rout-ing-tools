import { describe, expect, it } from "vitest";
import {
  fitsVersion1,
  isBase36Slug,
  looksLikeBase36Slug,
  qrPayloadForSlug,
  randomBase36Slug,
  toBase36,
} from "./base36";

describe("base36 slugs", () => {
  it("generates 4-char uppercase codes with at least one digit", () => {
    for (let i = 0; i < 200; i += 1) {
      const slug = randomBase36Slug();
      expect(slug).toHaveLength(4);
      expect(isBase36Slug(slug)).toBe(true);
      expect(/[0-9]/.test(slug)).toBe(true);
    }
  });

  it("normalises messy input", () => {
    expect(toBase36(" a8-9k! ")).toBe("A89K");
  });

  it("only treats 4-char codes with a digit as root short links", () => {
    expect(looksLikeBase36Slug("A89K")).toBe(true);
    expect(looksLikeBase36Slug("a89k")).toBe(true);
    expect(looksLikeBase36Slug("jona")).toBe(false);
    expect(looksLikeBase36Slug("a89kk")).toBe(false);
  });

  it("keeps the QR payload inside a Version 1 code", () => {
    const payload = qrPayloadForSlug("a89k");
    expect(payload).toBe("HTTPS://ROUT.BE/A89K");
    expect(payload.length).toBeLessThanOrEqual(20);
    expect(fitsVersion1(payload)).toBe(true);
  });

  it("rejects lowercase payloads for Version 1", () => {
    expect(fitsVersion1("https://rout.be/a89k")).toBe(false);
  });
});
