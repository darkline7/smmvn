import test from "node:test";
import assert from "node:assert/strict";
import { isValidCustomDomain, sanitizeDomainInput, stripPort } from "./domain-utils.js";

test("sanitizeDomainInput normalizes protocol, path, and port", () => {
  assert.equal(
    sanitizeDomainInput("https://Sub.Example.com:8443/path?q=1"),
    "sub.example.com",
  );
});

test("stripPort removes a trailing port", () => {
  assert.equal(stripPort("example.com:5173"), "example.com");
});

test("isValidCustomDomain rejects localhost and private hosts", () => {
  assert.equal(isValidCustomDomain("localhost"), false);
  assert.equal(isValidCustomDomain("192.168.1.20"), false);
  assert.equal(isValidCustomDomain("10.0.0.5"), false);
});

test("isValidCustomDomain accepts normal public domains", () => {
  assert.equal(isValidCustomDomain("panel.example.com"), true);
});
