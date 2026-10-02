import type { EventSummary } from "./types";

export const EVENTS: readonly EventSummary[];
export const FEATURED_EVENT: EventSummary;
export function getEvent(eventId: unknown): EventSummary | undefined;
