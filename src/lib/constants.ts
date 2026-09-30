import type { EventSummary } from "@/lib/types";

export const DEMO_USER_ID = "demo-user";
export const DEMO_EMAIL = "demo@ticket.local";
export const DEMO_NAME = "ผู้เยี่ยมชม";
export const DEMO_SESSION_KEY = "ticket-poc:demo-user";
export const LAST_USER_KEY = "ticket-poc:last-user-id";
export const SIMULATE_API_FAILURE_KEY = "ticket-poc:simulate-api-failure";
export const EVENT_ID = "11111111-1111-4111-8111-111111111111";

export const FEATURED_EVENT: EventSummary = {
  id: EVENT_ID,
  name: "Field Notes — ดนตรีสดและเสวนา",
  description: "ค่ำคืนของดนตรีอิสระ บทสนทนาดี ๆ และผู้คนที่ชอบสิ่งเดียวกัน",
  venue: "Warehouse 30, กรุงเทพฯ",
  startsAt: "2026-11-14T18:30:00+07:00",
  price: 650,
};

export const formatDate = (value: string, options?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("th-TH-u-ca-buddhist-nu-latn", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
    ...options,
  }).format(new Date(value));

export const formatTime = (value: string) =>
  new Intl.DateTimeFormat("th-TH-u-ca-buddhist-nu-latn", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));

export const formatMoney = (value: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(value);
