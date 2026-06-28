import { test } from "node:test";
import assert from "node:assert/strict";
import {
  encodePathSegment,
  encodePath,
  buildQueryString,
  validateBaseUrl,
} from "../src/urlUtils.js";

test("encodePathSegment encodes traversal/injection chars", () => {
  assert.equal(encodePathSegment("a/b"), "a%2Fb");
  assert.equal(encodePathSegment("x?y#z"), "x%3Fy%23z");
  assert.equal(encodePathSegment("a b"), "a%20b");
});

test("encodePathSegment rejects traversal segments", () => {
  assert.throws(() => encodePathSegment(".."));
  assert.throws(() => encodePathSegment("."));
});

test("encodePath preserves separators, encodes segments, rejects traversal", () => {
  assert.equal(encodePath("users/abc123"), "users/abc123");
  assert.equal(encodePath("col/with space"), "col/with%20space");
  assert.throws(() => encodePath("col/../secret"));
});

test("buildQueryString encodes keys and values", () => {
  assert.equal(buildQueryString({}), "");
  assert.equal(buildQueryString({ size: "small", token: "jwt123" }), "?size=small&token=jwt123");
  // '&' is escaped so it can't inject an extra parameter
  assert.match(buildQueryString({ token: "a&b" }), /token=a%26b/);
});

test("validateBaseUrl: https allowed, http only for loopback", () => {
  assert.equal(validateBaseUrl("https://api.example.com"), "https://api.example.com");
  assert.equal(validateBaseUrl("http://localhost:3000"), "http://localhost:3000");
  assert.equal(validateBaseUrl("http://127.0.0.1:8080"), "http://127.0.0.1:8080");
  assert.throws(() => validateBaseUrl("http://api.example.com"));
  assert.throws(() => validateBaseUrl("ftp://x"));
  assert.throws(() => validateBaseUrl("not-a-url"));
  assert.throws(() => validateBaseUrl(""));
});
