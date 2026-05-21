import { describe, expect, it } from "vitest";

import { parseGenericCliVersion } from "./providerSnapshot.ts";

describe("parseGenericCliVersion", () => {
  it("extracts a simple semver from stdout", () => {
    expect(parseGenericCliVersion("opencode 1.14.19\n")).toBe("1.14.19");
  });

  it("ignores ANSI colour / style codes surrounding the version", () => {
    expect(parseGenericCliVersion("opencode \u001B[1m1.15.4\u001B[0m\n")).toBe("1.15.4");
    expect(parseGenericCliVersion("opencode \u001B[32m1.15.4\u001B[0m\n")).toBe("1.15.4");
    expect(parseGenericCliVersion("opencode \u001B[1;32m1.15.4\u001B[0m\n")).toBe("1.15.4");
  });

  it("returns the first semver-like token", () => {
    expect(parseGenericCliVersion("foo 1.2.3 bar 4.5.6")).toBe("1.2.3");
  });

  it("returns null when no semver token exists", () => {
    expect(parseGenericCliVersion("no version here")).toBeNull();
  });
});
