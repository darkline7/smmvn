import test from "node:test";
import assert from "node:assert/strict";
import { isOrderStatus, isTicketStatus } from "./status-utils.js";

test("isOrderStatus accepts only DB-backed order statuses", () => {
  assert.equal(isOrderStatus("pending"), true);
  assert.equal(isOrderStatus("completed"), true);
  assert.equal(isOrderStatus("refunded"), false);
  assert.equal(isOrderStatus("in_progress"), false);
});

test("isTicketStatus accepts only DB-backed ticket statuses", () => {
  assert.equal(isTicketStatus("open"), true);
  assert.equal(isTicketStatus("pending"), true);
  assert.equal(isTicketStatus("answered"), false);
  assert.equal(isTicketStatus("closed"), true);
});
