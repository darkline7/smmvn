import assert from "node:assert/strict";
import { isValidCustomDomain, sanitizeDomainInput, stripPort } from "../lib/domain-utils.js";
import { isOrderStatus, isTicketStatus } from "../lib/status-utils.js";

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

run("sanitizeDomainInput normalizes protocol, path, and port", () => {
  assert.equal(
    sanitizeDomainInput("https://Sub.Example.com:8443/path?q=1"),
    "sub.example.com",
  );
});

run("stripPort removes a trailing port", () => {
  assert.equal(stripPort("example.com:5173"), "example.com");
});

run("isValidCustomDomain rejects localhost and private hosts", () => {
  assert.equal(isValidCustomDomain("localhost"), false);
  assert.equal(isValidCustomDomain("192.168.1.20"), false);
  assert.equal(isValidCustomDomain("10.0.0.5"), false);
});

run("isValidCustomDomain accepts normal public domains", () => {
  assert.equal(isValidCustomDomain("panel.example.com"), true);
});

run("isOrderStatus accepts only DB-backed order statuses", () => {
  assert.equal(isOrderStatus("pending"), true);
  assert.equal(isOrderStatus("completed"), true);
  assert.equal(isOrderStatus("refunded"), false);
  assert.equal(isOrderStatus("in_progress"), false);
});

run("isTicketStatus accepts only DB-backed ticket statuses", () => {
  assert.equal(isTicketStatus("open"), true);
  assert.equal(isTicketStatus("pending"), true);
  assert.equal(isTicketStatus("answered"), false);
  assert.equal(isTicketStatus("closed"), true);
});

console.log("All automated checks passed.");
