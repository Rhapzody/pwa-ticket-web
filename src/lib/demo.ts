import {
  DEMO_EMAIL,
  DEMO_NAME,
  DEMO_SESSION_KEY,
  DEMO_USER_ID,
  FEATURED_EVENT,
  LAST_USER_KEY,
} from "@/lib/constants";
import { getDatabase } from "@/lib/db";
import { createQrPayload } from "@/lib/ticket-domain.mjs";
import { getEvent } from "@/lib/event-catalog.mjs";
import type { CachedOrder, CachedProfile, CachedTicket } from "@/lib/types";

export function isDemoSession() {
  return typeof window !== "undefined" && window.localStorage.getItem(DEMO_SESSION_KEY) === "true";
}

export async function startDemoSession() {
  const db = getDatabase();
  const now = new Date().toISOString();
  const profile: CachedProfile = {
    id: DEMO_USER_ID,
    email: DEMO_EMAIL,
    displayName: DEMO_NAME,
    syncedAt: now,
  };

  await db.profiles.put(profile);

  if ((await db.tickets.where("userId").equals(DEMO_USER_ID).count()) === 0) {
    const orderId = crypto.randomUUID();
    const ticketId = crypto.randomUUID();
    const order: CachedOrder = {
      id: orderId,
      userId: DEMO_USER_ID,
      eventId: FEATURED_EVENT.id,
      eventName: FEATURED_EVENT.name,
      venue: FEATURED_EVENT.venue,
      eventStartsAt: FEATURED_EVENT.startsAt,
      status: "paid",
      totalAmount: FEATURED_EVENT.price,
      createdAt: now,
    };
    const ticket: CachedTicket = {
      id: ticketId,
      orderId,
      userId: DEMO_USER_ID,
      eventId: FEATURED_EVENT.id,
      eventName: FEATURED_EVENT.name,
      venue: FEATURED_EVENT.venue,
      eventStartsAt: FEATURED_EVENT.startsAt,
      ticketNumber: `FN-${ticketId.slice(0, 6).toUpperCase()}`,
      holderName: DEMO_NAME,
      qrPayload: createQrPayload(ticketId, FEATURED_EVENT.id),
      status: "valid",
      issuedAt: now,
    };

    await db.savePurchase(order, [ticket], now);
  }

  window.localStorage.setItem(DEMO_SESSION_KEY, "true");
  window.localStorage.setItem(LAST_USER_KEY, DEMO_USER_ID);
  window.dispatchEvent(new Event("ticket-cache-updated"));
  return profile;
}

export async function createDemoPurchase(quantity = 1, eventId = FEATURED_EVENT.id) {
  const selectedEvent = getEvent(eventId);
  if (!selectedEvent) throw new Error("งานนี้ยังไม่เปิดจำหน่ายตั๋ว");
  const db = getDatabase();
  const profile = await db.profiles.get(DEMO_USER_ID);
  if (!profile) throw new Error("กรุณาเริ่มโหมดทดลองก่อนสร้างตั๋ว");

  const now = new Date().toISOString();
  const orderId = crypto.randomUUID();
  const order: CachedOrder = {
    id: orderId,
    userId: DEMO_USER_ID,
    eventId: selectedEvent.id,
    eventName: selectedEvent.name,
    venue: selectedEvent.venue,
    eventStartsAt: selectedEvent.startsAt,
    status: "paid",
    totalAmount: selectedEvent.price * quantity,
    createdAt: now,
  };
  const tickets: CachedTicket[] = Array.from({ length: quantity }, () => {
    const id = crypto.randomUUID();
    return {
      id,
      orderId,
      userId: DEMO_USER_ID,
      eventId: selectedEvent.id,
      eventName: selectedEvent.name,
      venue: selectedEvent.venue,
      eventStartsAt: selectedEvent.startsAt,
      ticketNumber: `FN-${id.slice(0, 6).toUpperCase()}`,
      holderName: profile.displayName,
      qrPayload: createQrPayload(id, selectedEvent.id),
      status: "valid",
      issuedAt: now,
    };
  });

  await db.savePurchase(order, tickets, now);
  window.dispatchEvent(new Event("ticket-cache-updated"));
  return tickets;
}
