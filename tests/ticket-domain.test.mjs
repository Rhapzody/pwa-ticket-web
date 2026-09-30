import assert from "node:assert/strict";
import test from "node:test";
import { createQrPayload, validatePurchaseInput } from "../src/lib/ticket-domain.mjs";

test("purchase input accepts one to four tickets for the featured event", () => {
  assert.deepEqual(validatePurchaseInput("event-1", 2, "event-1"), {
    valid: true,
    quantity: 2,
  });
});

test("purchase input rejects another event and out-of-range quantities", () => {
  assert.equal(validatePurchaseInput("other-event", 1, "event-1").valid, false);
  assert.equal(validatePurchaseInput("event-1", 0, "event-1").valid, false);
  assert.equal(validatePurchaseInput("event-1", 5, "event-1").valid, false);
});

test("POC QR payload contains only the ticket and event identifiers", () => {
  assert.deepEqual(JSON.parse(createQrPayload("ticket-1", "event-1")), {
    version: 1,
    ticketId: "ticket-1",
    eventId: "event-1",
    mode: "POC",
  });
});
