import assert from "node:assert/strict";
import test from "node:test";
import { EVENTS, getEvent } from "../src/lib/event-catalog.mjs";
import { createQrPayload, validatePurchaseInput } from "../src/lib/ticket-domain.mjs";

test("every catalog event can be purchased and produces a QR for that event", () => {
  assert.equal(EVENTS.length, 7);
  assert.equal(new Set(EVENTS.map((event) => event.id)).size, EVENTS.length);
  for (const event of EVENTS) {
    const selected = getEvent(event.id);
    assert.equal(selected, event);
    assert.equal(validatePurchaseInput(event.id, 4, selected.id).valid, true);
    assert.equal(JSON.parse(createQrPayload("ticket-id", selected.id)).eventId, event.id);
    assert(Number.isInteger(event.price) && event.price > 0);
    assert(Number.isFinite(Date.parse(event.startsAt)));
  }
});

test("unknown or malformed event IDs cannot select a purchasable event", () => {
  for (const id of ["unknown", null, undefined, {}, 1]) assert.equal(getEvent(id), undefined);
});
