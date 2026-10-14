import { describe, expect, it } from "vitest";
import {
  generateStorageKey,
  isValidStorageKey,
  normalizeStorageKey,
} from "../../../src/storage/storage-key";

describe("storage key validation", () => {
  it("accepts a simple relative key", () => {
    expect(normalizeStorageKey("cor/abc123")).toBe("cor/abc123");
    expect(isValidStorageKey("cor/abc123")).toBe(true);
  });

  it("accepts a single-segment key", () => {
    expect(normalizeStorageKey("a1b2c3")).toBe("a1b2c3");
  });

  it("rejects an empty or whitespace key", () => {
    expect(() => normalizeStorageKey("")).toThrow();
    expect(() => normalizeStorageKey("   ")).toThrow();
    expect(isValidStorageKey("")).toBe(false);
  });

  it("rejects parent traversal segments", () => {
    expect(() => normalizeStorageKey("../etc/passwd")).toThrow();
    expect(() => normalizeStorageKey("a/../../b")).toThrow();
    expect(() => normalizeStorageKey("a/..")).toThrow();
    expect(isValidStorageKey("../secret")).toBe(false);
  });

  it("rejects absolute paths", () => {
    expect(() => normalizeStorageKey("/etc/passwd")).toThrow();
    expect(() => normalizeStorageKey("C:/Windows/system32")).toThrow();
    expect(() => normalizeStorageKey("C:\\Windows\\system32")).toThrow();
    expect(isValidStorageKey("/abs")).toBe(false);
  });

  it("rejects backslash separators", () => {
    expect(() => normalizeStorageKey("cor\\abc")).toThrow();
    expect(isValidStorageKey("cor\\abc")).toBe(false);
  });

  it("rejects null bytes", () => {
    expect(() => normalizeStorageKey("cor/ab\u0000c")).toThrow();
    expect(isValidStorageKey("cor/ab\u0000c")).toBe(false);
  });

  it("rejects empty, dot, or empty segments", () => {
    expect(() => normalizeStorageKey("cor//abc")).toThrow();
    expect(() => normalizeStorageKey("./abc")).toThrow();
    expect(() => normalizeStorageKey("cor/./abc")).toThrow();
    expect(() => normalizeStorageKey("cor/abc/")).toThrow();
  });

  it("generates a valid random key with an optional prefix", () => {
    const plain = generateStorageKey();
    const prefixed = generateStorageKey("thesis");
    expect(isValidStorageKey(plain)).toBe(true);
    expect(isValidStorageKey(prefixed)).toBe(true);
    expect(prefixed.startsWith("thesis/")).toBe(true);
    expect(generateStorageKey()).not.toBe(generateStorageKey());
  });
});
