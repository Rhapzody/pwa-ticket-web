export function validatePurchaseInput(eventId, quantity, expectedEventId) {
  if (eventId !== expectedEventId) {
    return { valid: false, error: "งานนี้ยังไม่เปิดจำหน่ายตั๋ว" };
  }

  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 4) {
    return { valid: false, error: "เลือกจำนวนตั๋วตั้งแต่ 1 ถึง 4 ใบ" };
  }

  return { valid: true, quantity };
}

export function createQrPayload(ticketId, eventId) {
  return JSON.stringify({ version: 1, ticketId, eventId, mode: "POC" });
}
