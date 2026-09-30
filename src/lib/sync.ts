"use client";

import {
  DEMO_USER_ID,
  LAST_USER_KEY,
  SIMULATE_API_FAILURE_KEY,
} from "@/lib/constants";
import { getDatabase } from "@/lib/db";
import { isDemoSession } from "@/lib/demo";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { CachedOrder, CachedProfile, CachedTicket } from "@/lib/types";

export type SyncResult = "synced" | "offline" | "signed-out" | "failed";

let syncGeneration = 0;
let signOutInProgress = false;

export function beginSignOut() {
  signOutInProgress = true;
  syncGeneration += 1;
}

export function finishSignOut() {
  signOutInProgress = false;
}

export async function syncOfflineData(): Promise<SyncResult> {
  if (typeof window === "undefined") return "failed";
  if (signOutInProgress) return "signed-out";
  const generation = syncGeneration;
  if (!navigator.onLine) return "offline";
  if (window.localStorage.getItem(SIMULATE_API_FAILURE_KEY) === "true") return "failed";

  const db = getDatabase();
  const now = new Date().toISOString();

  if (isDemoSession()) {
    await db.metadata.put({ key: `lastSync:${DEMO_USER_ID}`, value: now });
    window.dispatchEvent(new Event("ticket-cache-updated"));
    return "synced";
  }

  if (!isSupabaseConfigured) return "signed-out";

  try {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) {
      window.localStorage.removeItem(LAST_USER_KEY);
      return "signed-out";
    }

    const profile: CachedProfile = {
      id: user.id,
      email: user.email ?? "",
      displayName:
        user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split("@")[0] ?? "ผู้ถือบัตร",
      syncedAt: now,
    };

    const profileResult = await supabase.from("profiles").upsert(
      {
        id: user.id,
        email: profile.email,
        display_name: profile.displayName,
        updated_at: now,
      },
      { onConflict: "id" },
    );
    if (profileResult.error) throw profileResult.error;

    const [ordersResult, ticketsResult] = await Promise.all([
      supabase
        .from("orders")
        .select("id,user_id,event_id,event_name,venue,event_starts_at,status,total_amount,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("tickets")
        .select("id,order_id,user_id,event_id,event_name,venue,event_starts_at,ticket_number,holder_name,qr_payload,status,issued_at")
        .eq("user_id", user.id)
        .order("issued_at", { ascending: false }),
    ]);
    if (ordersResult.error) throw ordersResult.error;
    if (ticketsResult.error) throw ticketsResult.error;

    const orders: CachedOrder[] = (ordersResult.data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      eventId: row.event_id,
      eventName: row.event_name,
      venue: row.venue,
      eventStartsAt: row.event_starts_at,
      status: row.status,
      totalAmount: row.total_amount,
      createdAt: row.created_at,
    }));
    const tickets: CachedTicket[] = (ticketsResult.data ?? []).map((row) => ({
      id: row.id,
      orderId: row.order_id,
      userId: row.user_id,
      eventId: row.event_id,
      eventName: row.event_name,
      venue: row.venue,
      eventStartsAt: row.event_starts_at,
      ticketNumber: row.ticket_number,
      holderName: row.holder_name,
      qrPayload: row.qr_payload,
      status: row.status,
      issuedAt: row.issued_at,
    }));

    if (generation !== syncGeneration) return "signed-out";
    await db.replaceUserSnapshot(profile, orders, tickets);
    if (generation !== syncGeneration) return "signed-out";

    window.localStorage.setItem(LAST_USER_KEY, user.id);
    window.dispatchEvent(new Event("ticket-cache-updated"));
    return "synced";
  } catch (error) {
    console.error("Ticket sync failed; cached data remains available.", error);
    return "failed";
  }
}
