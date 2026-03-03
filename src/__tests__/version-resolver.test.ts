import { describe, it, expect } from "vitest";
import {
  parseSemver,
  compareSemver,
  satisfiesRange,
  pickBestMatch,
} from "../packages/version-resolver";

describe("parseSemver", () => {
  it("parses a simple version", () => {
    expect(parseSemver("1.2.3")).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: undefined,
    });
  });

  it("parses version with prerelease", () => {
    const result = parseSemver("1.0.0-beta.1");
    expect(result).toEqual({
      major: 1,
      minor: 0,
      patch: 0,
      prerelease: "beta.1",
    });
  });

  it("returns null for invalid input", () => {
    expect(parseSemver("not.a.version")).toBeNull();
  });

  it("returns null for partial version", () => {
    expect(parseSemver("1.2")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseSemver("")).toBeNull();
  });

  it('parses "0.0.0"', () => {
    expect(parseSemver("0.0.0")).toEqual({
      major: 0,
      minor: 0,
      patch: 0,
      prerelease: undefined,
    });
  });
});

describe("compareSemver", () => {
  it("returns 0 for equal versions", () => {
    expect(compareSemver("1.2.3", "1.2.3")).toBe(0);
  });

  it("returns negative when left < right by major", () => {
    expect(compareSemver("1.0.0", "2.0.0")).toBeLessThan(0);
  });

  it("returns positive when left > right by minor", () => {
    expect(compareSemver("1.2.0", "1.1.0")).toBeGreaterThan(0);
  });

  it("compares patch versions", () => {
    expect(compareSemver("1.0.1", "1.0.2")).toBeLessThan(0);
    expect(compareSemver("1.0.3", "1.0.2")).toBeGreaterThan(0);
  });

  it("prerelease is less than release", () => {
    expect(compareSemver("1.0.0-alpha", "1.0.0")).toBeLessThan(0);
  });

  it("release is greater than prerelease", () => {
    expect(compareSemver("1.0.0", "1.0.0-beta")).toBeGreaterThan(0);
  });

  it("compares two prerelease versions alphabetically", () => {
    expect(compareSemver("1.0.0-alpha", "1.0.0-beta")).toBeLessThan(0);
  });

  it("falls back to localeCompare for unparseable versions", () => {
    const result = compareSemver("abc", "def");
    expect(typeof result).toBe("number");
  });
});

describe("satisfiesRange", () => {
  it("exact version match", () => {
    expect(satisfiesRange("1.2.3", "1.2.3")).toBe(true);
    expect(satisfiesRange("1.2.4", "1.2.3")).toBe(false);
  });

  it("caret range ^1.2.3 allows minor/patch bumps", () => {
    expect(satisfiesRange("1.3.0", "^1.2.3")).toBe(true);
    expect(satisfiesRange("1.9.9", "^1.2.3")).toBe(true);
    expect(satisfiesRange("2.0.0", "^1.2.3")).toBe(false);
    expect(satisfiesRange("1.2.2", "^1.2.3")).toBe(false);
  });

  it("caret ^0.x.y is more restrictive", () => {
    expect(satisfiesRange("0.2.1", "^0.2.0")).toBe(true);
    expect(satisfiesRange("0.3.0", "^0.2.0")).toBe(false);
  });

  it("tilde range ~1.2.3 allows patch bumps only", () => {
    expect(satisfiesRange("1.2.9", "~1.2.3")).toBe(true);
    expect(satisfiesRange("1.3.0", "~1.2.3")).toBe(false);
  });

  it("comparison operators: >=, >, <, <=", () => {
    expect(satisfiesRange("2.0.0", ">=1.0.0")).toBe(true);
    expect(satisfiesRange("1.0.0", ">=1.0.0")).toBe(true);
    expect(satisfiesRange("1.0.0", ">1.0.0")).toBe(false);
    expect(satisfiesRange("0.9.0", "<1.0.0")).toBe(true);
    expect(satisfiesRange("1.0.0", "<1.0.0")).toBe(false);
    expect(satisfiesRange("1.0.0", "<=1.0.0")).toBe(true);
  });

  it('compound ranges: ">=1.2.0 <3.0.0"', () => {
    expect(satisfiesRange("2.5.0", ">=1.2.0 <3.0.0")).toBe(true);
    expect(satisfiesRange("3.0.0", ">=1.2.0 <3.0.0")).toBe(false);
    expect(satisfiesRange("1.1.0", ">=1.2.0 <3.0.0")).toBe(false);
  });

  it("OR unions", () => {
    expect(satisfiesRange("0.3.0", ">=1.0.0 || <0.5.0")).toBe(true);
    expect(satisfiesRange("2.0.0", ">=1.0.0 || <0.5.0")).toBe(true);
    expect(satisfiesRange("0.7.0", ">=1.0.0 || <0.5.0")).toBe(false);
  });

  it("hyphen ranges", () => {
    expect(satisfiesRange("1.5.0", "1.0.0 - 2.0.0")).toBe(true);
    expect(satisfiesRange("2.1.0", "1.0.0 - 2.0.0")).toBe(false);
    expect(satisfiesRange("0.9.0", "1.0.0 - 2.0.0")).toBe(false);
  });

  it("x-ranges", () => {
    expect(satisfiesRange("1.9.9", "1.x")).toBe(true);
    expect(satisfiesRange("2.0.0", "1.x")).toBe(false);
  });

  it("partial version ranges", () => {
    expect(satisfiesRange("1.5.0", "1")).toBe(true);
    expect(satisfiesRange("2.0.0", "1")).toBe(false);
  });

  it('wildcard "*" matches everything', () => {
    expect(satisfiesRange("99.99.99", "*")).toBe(true);
  });

  it('"latest" matches everything', () => {
    expect(satisfiesRange("1.0.0", "latest")).toBe(true);
  });

  it("prerelease versions only match ranges including prerelease", () => {
    expect(satisfiesRange("1.0.0-beta.1", "^1.0.0")).toBe(false);
    expect(satisfiesRange("1.0.0-beta.1", "^1.0.0-beta.0")).toBe(true);
  });

  it('partial versions are padded: "< 3" treated as "< 3.0.0"', () => {
    expect(satisfiesRange("2.9.9", "<3")).toBe(true);
    expect(satisfiesRange("3.0.0", "<3")).toBe(false);
  });
});

describe("pickBestMatch", () => {
  it("picks highest matching version", () => {
    const versions = ["1.0.0", "1.1.0", "1.2.0", "2.0.0"];
    expect(pickBestMatch(versions, "^1.0.0")).toBe("1.2.0");
  });

  it("returns null when no match", () => {
    expect(pickBestMatch(["1.0.0"], "^2.0.0")).toBeNull();
  });

  it("handles empty array", () => {
    expect(pickBestMatch([], "^1.0.0")).toBeNull();
  });

  it("picks exact version when range is exact", () => {
    const versions = ["1.0.0", "1.1.0", "1.2.0"];
    expect(pickBestMatch(versions, "1.1.0")).toBe("1.1.0");
  });
});
