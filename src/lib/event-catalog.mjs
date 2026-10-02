export const EVENTS = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Field Notes — ดนตรีสดและเสวนา",
    description: "ค่ำคืนของดนตรีอิสระ บทสนทนาดี ๆ และผู้คนที่ชอบสิ่งเดียวกัน",
    venue: "Warehouse 30, กรุงเทพฯ",
    startsAt: "2026-11-14T18:30:00+07:00",
    price: 650,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Jazz After Hours — แจ๊ซยามค่ำ",
    description: "พักจากวันวุ่น ๆ กับวงแจ๊ซสดและเสียงเพลงในบรรยากาศอบอุ่น",
    venue: "River Room, กรุงเทพฯ",
    startsAt: "2026-11-20T19:00:00+07:00",
    price: 890,
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Open Air Cinema — หนังใต้แสงดาว",
    description: "ดูหนังกลางแปลงบนสนามหญ้า พร้อมพูดคุยกับคนรักภาพยนตร์",
    venue: "Garden Yard, กรุงเทพฯ",
    startsAt: "2026-11-21T18:00:00+07:00",
    price: 350,
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    name: "Slow Brew — เวิร์กช็อปกาแฟ",
    description: "ลองดริปกาแฟ ชิมเมล็ดหลากหลาย และเรียนรู้เทคนิคกับบาริสต้า",
    venue: "Brew Studio, กรุงเทพฯ",
    startsAt: "2026-11-22T10:00:00+07:00",
    price: 1200,
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    name: "Design Weekend — ตลาดงานสร้างสรรค์",
    description: "พบงานคราฟต์และดีไซน์จากนักออกแบบอิสระ พร้อมกิจกรรมตลอดวัน",
    venue: "Creative Hall, กรุงเทพฯ",
    startsAt: "2026-11-28T11:00:00+07:00",
    price: 250,
  },
  {
    id: "66666666-6666-4666-8666-666666666666",
    name: "Morning Miles — วิ่งรับแสงเช้า",
    description: "เริ่มวันใหม่กับกิจกรรมวิ่ง 5 กิโลเมตรและเพื่อนร่วมเส้นทาง",
    venue: "Green Park, กรุงเทพฯ",
    startsAt: "2026-11-29T06:00:00+07:00",
    price: 450,
  },
  {
    id: "77777777-7777-4777-8777-777777777777",
    name: "Light & Space — นิทรรศการศิลปะ",
    description: "สำรวจงานจัดวางแสง สี และพื้นที่ พร้อมทัวร์ชมงานกับศิลปิน",
    venue: "Space Gallery, กรุงเทพฯ",
    startsAt: "2026-12-05T14:00:00+07:00",
    price: 300,
  },
];

export const FEATURED_EVENT = EVENTS[0];

export function getEvent(eventId) {
  return EVENTS.find((event) => event.id === eventId);
}
