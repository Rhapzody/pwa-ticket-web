export type TicketStatus = "valid" | "used" | "cancelled";
export type OrderStatus = "paid" | "pending" | "cancelled";

export interface CachedProfile {
  id: string;
  email: string;
  displayName: string;
  syncedAt: string;
}

export interface CachedOrder {
  id: string;
  userId: string;
  eventId: string;
  eventName: string;
  venue: string;
  eventStartsAt: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
}

export interface CachedTicket {
  id: string;
  orderId: string;
  userId: string;
  eventId: string;
  eventName: string;
  venue: string;
  eventStartsAt: string;
  ticketNumber: string;
  holderName: string;
  qrPayload: string;
  status: TicketStatus;
  issuedAt: string;
}

export interface CacheMetadata {
  key: string;
  value: string;
}

export interface EventSummary {
  id: string;
  name: string;
  description: string;
  venue: string;
  startsAt: string;
  price: number;
}
