import { NextResponse } from "next/server";
import { getEvent } from "@/lib/event-catalog.mjs";
import { createQrPayload, validatePurchaseInput } from "@/lib/ticket-domain.mjs";
import { hasServerPurchaseConfig } from "@/lib/supabase/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!hasServerPurchaseConfig) {
    return NextResponse.json(
      { error: "ระบบจองตั๋วไม่พร้อมให้บริการ กรุณาลองอีกครั้ง" },
      { status: 503 },
    );
  }

  const authClient = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อนซื้อตั๋ว" }, { status: 401 });
  }

  let body: { eventId?: unknown; quantity?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลคำขอไม่ถูกต้อง กรุณาลองใหม่" }, { status: 400 });
  }

  const selectedEvent = getEvent(body?.eventId);
  if (!selectedEvent) {
    return NextResponse.json({ error: "งานนี้ยังไม่เปิดจำหน่ายตั๋ว" }, { status: 400 });
  }
  const validation = validatePurchaseInput(body.eventId, body.quantity, selectedEvent.id);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const holderName =
    user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split("@")[0] ?? "ผู้ถือบัตร";

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      user_id: user.id,
      event_id: selectedEvent.id,
      event_name: selectedEvent.name,
      venue: selectedEvent.venue,
      event_starts_at: selectedEvent.startsAt,
      status: "paid",
      total_amount: selectedEvent.price * validation.quantity,
      created_at: now,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    console.error("Unable to create the POC order.", orderError);
    return NextResponse.json({ error: "จองตั๋วไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }

  const tickets = Array.from({ length: validation.quantity }, () => {
    const id = crypto.randomUUID();
    return {
      id,
      order_id: order.id,
      user_id: user.id,
      event_id: selectedEvent.id,
      event_name: selectedEvent.name,
      venue: selectedEvent.venue,
      event_starts_at: selectedEvent.startsAt,
      ticket_number: `FN-${id.slice(0, 6).toUpperCase()}`,
      holder_name: holderName,
      qr_payload: createQrPayload(id, selectedEvent.id),
      status: "valid",
      issued_at: now,
    };
  });

  const { error: ticketError } = await admin.from("tickets").insert(tickets);
  if (ticketError) {
    // A failed ticket insert should not leave an empty order in this POC.
    await admin.from("orders").delete().eq("id", order.id);
    console.error("Unable to create POC tickets.", ticketError);
    return NextResponse.json({ error: "จองตั๋วไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }

  return NextResponse.json(
    { order: { id: order.id, createdAt: now }, tickets },
    { status: 201 },
  );
}
