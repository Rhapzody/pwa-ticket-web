export function validatePurchaseInput(
  eventId: unknown,
  quantity: unknown,
  expectedEventId: string,
): { valid: true; quantity: number } | { valid: false; error: string };

export function createQrPayload(ticketId: string, eventId: string): string;
