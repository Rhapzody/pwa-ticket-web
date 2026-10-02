"use client";

import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import {
  DEMO_SESSION_KEY,
  DEMO_USER_ID,
  FEATURED_EVENT,
  EVENTS,
  LAST_USER_KEY,
  SIMULATE_API_FAILURE_KEY,
  formatDate,
  formatMoney,
  formatTime,
} from "@/lib/constants";
import { getDatabase } from "@/lib/db";
import { createDemoPurchase, isDemoSession, startDemoSession } from "@/lib/demo";
import { beginSignOut, finishSignOut, syncOfflineData, type SyncResult } from "@/lib/sync";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { CachedOrder, CachedProfile, CachedTicket } from "@/lib/types";

type IconName = "home" | "ticket" | "receipt" | "user" | "wifi" | "calendar" | "pin" | "arrow" | "refresh" | "check" | "cloud" | "qr" | "close";

function subscribePath(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

function getPathSnapshot() {
  return typeof window === "undefined" ? "/" : window.location.pathname;
}

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function getOnlineSnapshot() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
    ticket: <><path d="M3 8a2 2 0 0 0 0 4v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4a2 2 0 0 0 0-4V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z" /><path d="M13 4v3m0 4v2m0 4v3" /></>,
    receipt: <><path d="M5 3h14v18l-3-2-4 2-4-2-3 2z" /><path d="M8 8h8M8 12h8M8 16h3" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    wifi: <><path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.95 16.11a6 6 0 0 1 6.1 0" /><path d="M12 20h.01" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.5 9A7 7 0 0 1 18 6l2 2M4 16l2 2a7 7 0 0 0 12.5-3" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    cloud: <><path d="M20 16.2A4.5 4.5 0 0 0 18 7.5a6 6 0 0 0-11.6 1.8A4 4 0 0 0 7 17h12" /><path d="m12 11-3 3h2v4h2v-4h2z" /></>,
    qr: <><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM19 14v2m-5 3h2m3 2h2v-4" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  };

  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function statusLabel(status: string) {
  if (status === "valid") return "ตั๋วพร้อม";
  if (status === "used") return "ใช้ตั๋วแล้ว";
  if (status === "paid") return "ยืนยันแล้ว";
  if (status === "pending") return "รอดำเนินการ";
  if (status === "cancelled") return "ยกเลิกแล้ว";
  return "ไม่ทราบสถานะ";
}

function prettySyncTime(value: string | null) {
  if (!value) return "ยังไม่เคยอัปเดต";
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist-nu-latn", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }).format(new Date(value));
}

export default function TicketApp() {
  const path = useSyncExternalStore(subscribePath, getPathSnapshot, () => "/");
  const online = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, () => true);
  const [serviceWorkerReady, setServiceWorkerReady] = useState(false);
  const [profile, setProfile] = useState<CachedProfile | null>(null);
  const [orders, setOrders] = useState<CachedOrder[]>([]);
  const [tickets, setTickets] = useState<CachedTicket[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<"idle" | "syncing" | SyncResult>("idle");
  const [apiFailure, setApiFailure] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(SIMULATE_API_FAILURE_KEY) === "true",
  );
  const [notice, setNotice] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState(FEATURED_EVENT);
  const [working, setWorking] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [cachedTicketDetail, setCachedTicketDetail] = useState<CachedTicket | null>(null);
  const [storageUse, setStorageUse] = useState<string>("กำลังตรวจสอบ…");
  const [appCacheCount, setAppCacheCount] = useState(0);

  const navigate = useCallback((nextPath: string) => {
    if (typeof window === "undefined") return;
    window.history.pushState({}, "", nextPath);
    window.dispatchEvent(new PopStateEvent("popstate"));
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const refreshCache = useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      const db = getDatabase();
      const userId = isDemoSession()
        ? DEMO_USER_ID
        : window.localStorage.getItem(LAST_USER_KEY);
      if (!userId) {
        setProfile(null);
        setOrders([]);
        setTickets([]);
        setLastSync(null);
        return;
      }

      const [cachedProfile, cachedOrders, cachedTickets, syncRecord] = await Promise.all([
        db.profiles.get(userId),
        db.orders.where("userId").equals(userId).toArray(),
        db.tickets.where("userId").equals(userId).toArray(),
        db.metadata.get(`lastSync:${userId}`),
      ]);
      const activeUserId = isDemoSession() ? DEMO_USER_ID : window.localStorage.getItem(LAST_USER_KEY);
      if (activeUserId !== userId) return;
      setProfile(cachedProfile ?? null);
      setOrders(cachedOrders.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setTickets(cachedTickets.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)));
      setLastSync(syncRecord?.value ?? cachedProfile?.syncedAt ?? null);
    } catch (error) {
      console.error("Unable to read the offline ticket cache.", error);
    }
  }, []);

  const runSync = useCallback(async () => {
    setSyncState("syncing");
    const result = await syncOfflineData();
    setSyncState(result);
    await refreshCache();
    return result;
  }, [refreshCache]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- IndexedDB is external state; refreshCache awaits it before updating UI state.
    void refreshCache();

    const checkOfflineReadiness = async () => {
      if (!("caches" in window)) return;
      try {
        const registration = await navigator.serviceWorker.ready;
        const keys = await caches.keys();
        setAppCacheCount(keys.filter((key) => key.startsWith("field-notes-")).length);
        if (!keys.includes("field-notes-shell-v2") || !keys.includes("field-notes-assets-v2")) {
          setServiceWorkerReady(false);
          return;
        }
        const [shellCache, assetCache] = await Promise.all([
          caches.open("field-notes-shell-v2"),
          caches.open("field-notes-assets-v2"),
        ]);
        const [shell, assets] = await Promise.all([shellCache.match("/"), assetCache.keys()]);
        setServiceWorkerReady(Boolean(registration.active && shell && assets.length > 0));
      } catch (error) {
        console.warn("Offline readiness could not be checked.", error);
        setServiceWorkerReady(false);
      }
    };
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", checkOfflineReadiness);
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then(() => checkOfflineReadiness())
        .catch((error) => console.warn("Service worker registration failed.", error));
    }

    if (navigator.storage?.estimate) {
      void navigator.storage.estimate().then(({ usage = 0, quota = 0 }) => {
        setStorageUse(`${(usage / 1024 / 1024).toFixed(1)} MB / ${(quota / 1024 / 1024).toFixed(0)} MB`);
      });
    }
    if ("caches" in window) {
      void caches.keys().then((keys) => setAppCacheCount(keys.filter((key) => key.startsWith("field-notes-")).length));
    }

    if (isDemoSession() || isSupabaseConfigured) void runSync();

    const onOnline = () => void runSync();
    const onFocus = () => {
      if (navigator.onLine) void runSync();
    };
    const onCacheUpdated = () => void refreshCache();
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onFocus);
    window.addEventListener("ticket-cache-updated", onCacheUpdated);

    return () => {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("controllerchange", checkOfflineReadiness);
      }
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("ticket-cache-updated", onCacheUpdated);
    };
  }, [refreshCache, runSync]);

  const ticketId = path.match(/^\/tickets\/([^/]+)/)?.[1] ?? null;
  useEffect(() => {
    if (!ticketId || !profile || tickets.some((ticket) => ticket.id === ticketId && ticket.userId === profile.id)) return;
    let active = true;
    void getDatabase().tickets.get(ticketId).then((value) => {
      if (active) setCachedTicketDetail(value?.userId === profile.id ? value : null);
    });
    return () => { active = false; };
  }, [ticketId, tickets, profile]);
  const ticketDetail = tickets.find((ticket) => ticket.id === ticketId && ticket.userId === profile?.id) ??
    (cachedTicketDetail?.id === ticketId && cachedTicketDetail.userId === profile?.id ? cachedTicketDetail : null);

  const route = useMemo(() => {
    if (path === "/" || path === "") return "home";
    if (path === "/login") return "login";
    if (path === "/my-tickets") return "tickets";
    if (ticketId) return "ticket-detail";
    if (path === "/orders") return "orders";
    if (path === "/account") return "account";
    if (path === "/debug/offline") return "debug";
    if (path === "/offline") return "offline";
    return "not-found";
  }, [path, ticketId]);

  async function handleStartDemo() {
    await startDemoSession();
    setSyncState("synced");
    await refreshCache();
    navigate("/my-tickets");
  }

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working) return;
    setLoginError("");
    if (!isSupabaseConfigured) {
      setLoginError("กรุณาดำเนินการต่อในฐานะผู้เยี่ยมชม");
      return;
    }
    if (!loginEmail.includes("@")) {
      setLoginError("กรุณากรอกอีเมลให้ถูกต้อง");
      return;
    }
    if (!online) {
      setLoginError("กรุณาเชื่อมต่ออินเทอร์เน็ตเพื่อเข้าสู่ระบบ");
      return;
    }

    setWorking(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      if (error) {
        setLoginError(error.code === "email_not_confirmed"
          ? "บัญชีนี้ยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลการทดสอบเพื่อยืนยันบัญชี"
          : error.status === 429
            ? "เข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองอีกครั้ง"
            : "เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลและรหัสผ่านของบัญชีทดสอบ");
        return;
      }
      const user = data.user;
      setLoginPassword("");
      window.localStorage.removeItem(DEMO_SESSION_KEY);
      window.localStorage.setItem(LAST_USER_KEY, user.id);
      setProfile(null);
      setOrders([]);
      setTickets([]);
      setCachedTicketDetail(null);
      const db = getDatabase();
      const cachedProfile = await db.profiles.get(user.id);
      if (!cachedProfile) await db.profiles.put({
        id: user.id,
        email: user.email ?? "",
        displayName: user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split("@")[0] ?? "ผู้ถือบัตร",
        syncedAt: "",
      });
      const result = await runSync();
      navigate("/");
      if (result !== "synced") setNotice("เข้าสู่ระบบแล้ว แต่ยังซิงก์ตั๋วไม่สำเร็จ กรุณาลองอัปเดตอีกครั้ง");
    } catch (error) {
      console.error("Unable to complete password sign-in.", error);
      setLoginError("เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง");
    } finally {
      setWorking(false);
    }
  }

  async function handlePurchase() {
    if (working) return;
    if (!profile) {
      navigate("/login");
      return;
    }
    if (!online) {
      setNotice("กรุณาเชื่อมต่ออินเทอร์เน็ตเพื่อซื้อตั๋ว");
      return;
    }
    if (apiFailure) {
      setNotice("ระบบไม่พร้อมให้บริการ กรุณาลองอีกครั้ง");
      return;
    }

    setWorking(true);
    setNotice("");
    let serverConfirmed = false;
    try {
      if (isDemoSession()) {
        await createDemoPurchase(quantity, selectedEvent.id);
      } else {
        const response = await fetch("/api/purchase", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ eventId: selectedEvent.id, quantity }),
        });
        if (!response.ok) {
          const failure = await response.json().catch(() => null);
          throw new Error(failure?.error ?? "จองตั๋วไม่สำเร็จ ลองอีกครั้งได้เลย");
        }
        serverConfirmed = true;
        const result = await response.json();
        const createdOrder: CachedOrder = {
          id: result.order.id,
          userId: profile.id,
          eventId: selectedEvent.id,
          eventName: selectedEvent.name,
          venue: selectedEvent.venue,
          eventStartsAt: selectedEvent.startsAt,
          status: "paid",
          totalAmount: selectedEvent.price * quantity,
          createdAt: result.order.createdAt,
        };
        const createdTickets: CachedTicket[] = result.tickets.map((ticket: {
          id: string;
          ticket_number: string;
          holder_name: string;
          qr_payload: string;
          issued_at: string;
        }) => ({
          id: ticket.id,
          orderId: createdOrder.id,
          userId: profile.id,
          eventId: selectedEvent.id,
          eventName: selectedEvent.name,
          venue: selectedEvent.venue,
          eventStartsAt: selectedEvent.startsAt,
          ticketNumber: ticket.ticket_number,
          holderName: ticket.holder_name,
          qrPayload: ticket.qr_payload,
          status: "valid",
          issuedAt: ticket.issued_at,
        }));
        const db = getDatabase();
        const cachedAt = new Date().toISOString();
        await db.savePurchase(createdOrder, createdTickets, cachedAt);
        window.localStorage.setItem(LAST_USER_KEY, profile.id);
        window.dispatchEvent(new Event("ticket-cache-updated"));
      }
      await refreshCache();
      navigate("/my-tickets");
      setNotice(`จองตั๋ว ${quantity} ใบเรียบร้อยแล้ว`);
    } catch (error) {
      if (serverConfirmed) {
        console.error("Tickets were created, but the offline copy could not be saved.", error);
        const recovery = await runSync();
        navigate("/my-tickets");
        setNotice(recovery === "synced"
          ? "จองตั๋วเรียบร้อยแล้ว"
          : "จองตั๋วแล้ว กรุณาอัปเดตข้อมูลเพื่อดูตั๋วของคุณ");
      } else {
        const message = error instanceof TypeError
          ? "เชื่อมต่อระบบไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง"
          : error instanceof Error ? error.message : "จองตั๋วไม่สำเร็จ ลองอีกครั้งได้เลย";
        setNotice(message);
      }
    } finally {
      setWorking(false);
    }
  }

  async function handleSignOut() {
    beginSignOut();
    try {
      if (!isDemoSession() && isSupabaseConfigured) {
        const { error } = await createSupabaseBrowserClient().auth.signOut();
      if (error) throw error;
      }
      window.localStorage.removeItem(DEMO_SESSION_KEY);
      window.localStorage.removeItem(LAST_USER_KEY);
      setProfile(null);
      setOrders([]);
      setTickets([]);
      setLastSync(null);
      setCachedTicketDetail(null);
      setSyncState("signed-out");
      navigate("/");
    } catch (error) {
      console.error("Sign-out failed.", error);
      setNotice("ออกจากระบบไม่สำเร็จ กรุณาเชื่อมต่ออินเทอร์เน็ตแล้วลองอีกครั้ง");
    } finally {
      finishSignOut();
    }
  }

  async function handleClearOfflineData() {
    const db = getDatabase();
    await db.clearAll();
    window.localStorage.removeItem(DEMO_SESSION_KEY);
    window.localStorage.removeItem(LAST_USER_KEY);
    await refreshCache();
    setNotice("ลบข้อมูลบัญชี รายการจอง และตั๋วออกจากอุปกรณ์นี้แล้ว");
  }

  async function handleClearAppCache() {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("field-notes-")).map((key) => caches.delete(key)));
    setAppCacheCount(0);
    setServiceWorkerReady(false);
    setNotice("ลบไฟล์แอปที่บันทึกไว้แล้ว เปิดแอปขณะออนไลน์เพื่อบันทึกใหม่");
  }

  function toggleApiFailure() {
    const nextValue = !apiFailure;
    setApiFailure(nextValue);
    window.localStorage.setItem(SIMULATE_API_FAILURE_KEY, String(nextValue));
    setNotice(nextValue ? "เปิดการจำลองระบบขัดข้องแล้ว" : "ปิดการจำลองระบบขัดข้องแล้ว");
  }

  const pageTitle = route === "home" ? "ค้นพบงานที่คุณอยากไป" : route === "tickets" ? "ตั๋วของฉัน" : route === "orders" ? "รายการจอง" : route === "account" ? "บัญชีของฉัน" : route === "debug" ? "สถานะการใช้งานออฟไลน์" : route === "login" ? "เข้าสู่ระบบ" : route === "ticket-detail" ? "รายละเอียดตั๋ว" : route === "offline" ? "ไม่มีอินเทอร์เน็ต" : "ไม่พบหน้านี้";

  return (
    <div className="app-frame">
      <header className="topbar">
        <button className="brand" onClick={() => navigate("/")} aria-label="กลับหน้าหลัก PWA Ticket">
          <span className="brand-mark">PW</span>
          <span className="brand-copy"><strong>PWA Ticket</strong><small>บัตรเข้างาน</small></span>
        </button>
        <div className="topbar-right">
          {profile ? (
            <button className="profile-chip" onClick={() => navigate("/account")}>
              <span className="avatar-small">{profile.displayName.slice(0, 1).toUpperCase()}</span>
              <span>{isDemoSession() ? "ผู้เยี่ยมชม" : profile.displayName.split(" ")[0]}</span>
            </button>
          ) : (
            <button className="topbar-login" onClick={() => navigate("/login")}>เข้าสู่ระบบ <Icon name="arrow" size={15} /></button>
          )}
        </div>
      </header>

      {!online && (
        <div className="offline-banner"><Icon name="wifi" size={16} /> ไม่มีอินเทอร์เน็ต <span>เปิดดูตั๋วที่บันทึกในเครื่องได้</span></div>
      )}

      <nav className="bottom-nav" aria-label="เมนูหลัก">
        <button className={route === "home" ? "active" : ""} onClick={() => navigate("/")}><Icon name="home" size={19} /><span>หน้าแรก</span></button>
        <button className={route === "tickets" || route === "ticket-detail" ? "active" : ""} onClick={() => navigate("/my-tickets")}><Icon name="ticket" size={19} /><span>ตั๋วของฉัน</span>{tickets.length > 0 && <i className="nav-count">{tickets.length}</i>}</button>
        <button className={route === "orders" ? "active" : ""} onClick={() => navigate("/orders")}><Icon name="receipt" size={19} /><span>รายการจอง</span></button>
        <button className={route === "account" || route === "debug" ? "active" : ""} onClick={() => navigate(profile ? "/account" : "/login")}><Icon name="user" size={19} /><span>บัญชี</span></button>
      </nav>

      <main className="page-main">
        <div className="page-heading">
          <div>
            <p className="eyebrow">PWA Ticket · ทุกงานที่คุณอยากไป</p>
            <h1>{pageTitle}</h1>
          </div>
          {route === "debug" && (
            <button className="quiet-button sync-quiet" onClick={() => void runSync()} disabled={syncState === "syncing" || !online}>
              <Icon name="refresh" size={15} /> {syncState === "syncing" ? "กำลังอัปเดต…" : "อัปเดตข้อมูล"}
            </button>
          )}
        </div>

        {notice && <div className="notice-banner" role="status">{notice}</div>}

        {route === "home" && (
          <div className="home-content">
          <div className="home-grid" id="event-selection">
            <section className={`event-poster event-color-${EVENTS.findIndex((event) => event.id === selectedEvent.id)}`} aria-label={selectedEvent.name}>
              <div className="poster-topline"><span>PWA TICKET ชวนคุณมา</span><span>งานตัวอย่าง</span></div>
              <div className="poster-art" aria-hidden="true"><span className="poster-orbit orbit-one" /><span className="poster-orbit orbit-two" /><span className="poster-sun" /></div>
              <div className="poster-copy">
                <p>{selectedEvent.name.split(" — ")[1]}</p>
                <h2 className="catalog-poster-title">{selectedEvent.name.split(" — ")[0]}<span>—</span></h2>
                <div className="poster-footer"><span>{formatDate(selectedEvent.startsAt)}</span><span>{formatTime(selectedEvent.startsAt)} น.</span></div>
              </div>
              <span className="poster-sticker"><Icon name="ticket" size={24} /></span>
            </section>

            <section className="event-details panel">
              <div className="section-kicker"><span className="kicker-dot" /> งานที่เลือก</div>
              <h2>{selectedEvent.name}</h2>
              <p className="event-description">{selectedEvent.description}</p>
              <div className="event-facts">
                <div><span className="fact-icon"><Icon name="calendar" size={17} /></span><span><strong>{formatDate(selectedEvent.startsAt, { weekday: "short", month: "long", day: "numeric" })}</strong><small>{formatTime(selectedEvent.startsAt)} น. · เปิดประตู</small></span></div>
                <div><span className="fact-icon"><Icon name="pin" size={17} /></span><span><strong>{selectedEvent.venue}</strong><small>กรุงเทพมหานคร</small></span></div>
              </div>
              <div className="purchase-row">
                <div><span className="price-caption">บัตรเข้างานทั่วไป</span><strong className="price">{formatMoney(selectedEvent.price)}</strong><small>ต่อใบ</small></div>
                {profile ? (
                  <div className="purchase-controls">
                    <label className="quantity-select"><span className="sr-only">จำนวนตั๋ว</span><select disabled={working} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))}>{[1, 2, 3, 4].map((count) => <option key={count} value={count}>{count} ใบ</option>)}</select></label>
                    <button className="button button-primary" onClick={() => void handlePurchase()} disabled={working || !online}>
                      {working ? "กำลังจองตั๋ว…" : "ซื้อตั๋ว"}<Icon name="arrow" size={16} />
                    </button>
                  </div>
                ) : (
                  <button className="button button-primary" onClick={() => navigate("/login")}>ซื้อตั๋ว <Icon name="arrow" size={16} /></button>
                )}
              </div>
            </section>
          </div>
          <section className="event-catalog" aria-labelledby="catalog-heading">
            <div className="catalog-heading"><div><p className="eyebrow">เลือกประสบการณ์ถัดไป</p><h2 id="catalog-heading">งานทั้งหมด</h2></div><span className="saved-chip">{EVENTS.length} งาน</span></div>
            <p className="muted-copy">งานตัวอย่างสำหรับทดลองจองตั๋ว เลือกงานเพื่อดูรายละเอียดและซื้อตั๋ว</p>
            <div className="catalog-grid">
              {EVENTS.map((event, index) => (
                <article className={`catalog-card panel ${selectedEvent.id === event.id ? "catalog-card-selected" : ""}`} key={event.id}>
                  <div className={`catalog-art event-color-${index}`} aria-hidden="true"><span>{String(index + 1).padStart(2, "0")}</span><strong>{event.name.split(" — ")[0]}</strong><Icon name="ticket" size={28} /></div>
                  <div className="catalog-card-body">
                    <h3>{event.name}</h3>
                    <p><Icon name="calendar" size={15} /> {formatDate(event.startsAt)} · {formatTime(event.startsAt)} น.</p>
                    <p><Icon name="pin" size={15} /> {event.venue}</p>
                    <div className="catalog-card-actions"><strong>{formatMoney(event.price)} <small>/ ใบ</small></strong><button className="button button-secondary" aria-label={`เลือก ${event.name}`} aria-pressed={selectedEvent.id === event.id} disabled={working} onClick={() => {
                      setSelectedEvent(event);
                      setQuantity(1);
                      setNotice("");
                      document.getElementById("event-selection")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}>{selectedEvent.id === event.id ? "เลือกแล้ว" : "เลือกงานนี้"}<Icon name="arrow" size={15} /></button></div>
                  </div>
                </article>
              ))}
            </div>
          </section>
          </div>
        )}

        {route === "login" && (
          <section className="login-layout">
            <div className="login-card panel">
                <>
                  <p className="eyebrow">{isSupabaseConfigured ? "เข้าสู่ระบบด้วยอีเมลและรหัสผ่าน" : "เริ่มต้นใช้งาน"}</p>
                  <h2>{isSupabaseConfigured ? "เข้าสู่ระบบ" : "ยินดีต้อนรับสู่PWA Ticket"}</h2>
                  <p className="muted-copy">{isSupabaseConfigured ? "ใช้บัญชีทดสอบที่ได้รับจากผู้ดูแล เข้าสู่ระบบได้ทันทีโดยไม่ต้องรอลิงก์ทางอีเมล" : "เลือกงานที่คุณชอบ แล้วดำเนินการต่อในฐานะผู้เยี่ยมชม"}</p>
                  {isSupabaseConfigured && <form className="login-form" onSubmit={(event) => void handleLoginSubmit(event)}>
                    <label htmlFor="email">อีเมล</label>
                    <input id="email" name="email" type="email" autoComplete="username" placeholder="you@example.com" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} required />
                    <label htmlFor="password">รหัสผ่าน</label>
                    <input id="password" name="password" type="password" autoComplete="current-password" placeholder="รหัสผ่านบัญชีทดสอบ" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} required />
                    {loginError && <p className="form-error" role="alert">{loginError}</p>}
                    {!online && <p className="muted-copy">กรุณาเชื่อมต่ออินเทอร์เน็ตเพื่อเข้าสู่ระบบ</p>}
                    <button className="button button-primary button-wide" type="submit" disabled={working || !online}>{working ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}<Icon name="arrow" size={16} /></button>
                  </form>}
                  {isSupabaseConfigured && <div className="divider"><span>หรือดำเนินการต่อในฐานะผู้เยี่ยมชม</span></div>}
                  <button className={`button ${isSupabaseConfigured ? "button-secondary" : "button-primary demo-start"} button-wide`} onClick={() => void handleStartDemo()}><Icon name="ticket" size={17} /> ดำเนินการต่อในฐานะผู้เยี่ยมชม</button>
                </>
            </div>
            <aside className="login-aside">
              <span className="aside-label">ตั๋วพร้อมในกระเป๋าคุณ</span>
              <div className="aside-qr"><Icon name="qr" size={42} /></div>
              <h3>เตรียมตั๋วไว้<br />ก่อนออกเดินทาง</h3>
              <p>เลือกงานที่ชอบ ซื้อตั๋ว แล้วเตรียมตัวไปพบประสบการณ์ใหม่ ๆ</p>
            </aside>
          </section>
        )}

        {route === "tickets" && (
          <section className="content-stack">
            <div className="list-intro"><p className="muted-copy">{profile ? `ตั๋วของ ${isDemoSession() ? "ผู้เยี่ยมชม" : profile.displayName}` : "เข้าสู่ระบบเพื่อดูตั๋วและรายการจองของคุณ"}</p><span className="saved-chip"><span className="saved-dot" /> {tickets.length} ใบ</span></div>
            {!profile && <div className="empty-state panel"><div className="empty-icon"><Icon name="ticket" size={23} /></div><h2>เข้าสู่ระบบเพื่อดูตั๋ว</h2><p>พบตั๋วและรายละเอียดงานทั้งหมดของคุณได้ที่นี่</p><button className="button button-primary" onClick={() => navigate("/login")}>เข้าสู่ระบบ <Icon name="arrow" size={16} /></button></div>}
            {profile && tickets.length === 0 && <div className="empty-state panel"><div className="empty-icon"><Icon name="ticket" size={23} /></div><h2>ยังไม่มีตั๋ว</h2><p>ค้นหางานที่คุณชอบ แล้วซื้อตั๋วเพื่อร่วมสนุกไปด้วยกัน</p><button className="button button-primary" onClick={() => navigate("/")}>เลือกงาน <Icon name="arrow" size={16} /></button></div>}
            {tickets.map((ticket) => <button className="ticket-list-card" key={ticket.id} onClick={() => navigate(`/tickets/${ticket.id}`)}>
              <span className="ticket-list-art"><span>PW</span><i /></span>
              <span className="ticket-list-main"><span className="section-kicker">{formatDate(ticket.eventStartsAt, { day: "numeric", month: "short", year: "numeric" })}</span><strong>{ticket.eventName}</strong><small>{isDemoSession() ? "ผู้เยี่ยมชม" : ticket.holderName} · {ticket.ticketNumber}</small></span>
              <span className="ticket-list-status"><span className="status-dot" />{statusLabel(ticket.status)}<span className="ticket-chevron"><Icon name="arrow" size={17} /></span></span>
            </button>)}
          </section>
        )}

        {route === "ticket-detail" && (
          ticketDetail ? (
            <section className="ticket-detail-layout">
              <button className="back-button" onClick={() => navigate("/my-tickets")}>← กลับไปดูตั๋วของฉัน</button>
              <article className="ticket-pass">
                <div className="pass-top">
                  <div className="pass-brand"><span className="brand-mark">PW</span><span><strong>PWA Ticket</strong><small>บัตรเข้างานทั่วไป</small></span></div>
                  <span className="pass-status"><span className="status-dot" />{statusLabel(ticketDetail.status)}</span>
                </div>
                <div className="pass-event"><span className="section-kicker">ตั๋วของคุณ · {formatDate(ticketDetail.eventStartsAt, { day: "numeric", month: "short", year: "numeric" })}</span><h2>{ticketDetail.eventName}</h2><p><Icon name="pin" size={16} /> {ticketDetail.venue}</p></div>
                <div className="pass-perforation"><span /><i /><span /></div>
                <div className="pass-qr-wrap"><div className="pass-qr"><QRCodeSVG value={ticketDetail.qrPayload} size={204} level="M" marginSize={2} title={`QR สำหรับตั๋ว ${ticketDetail.ticketNumber}`} /></div><span className="qr-caption">QR ประจำตั๋ว</span></div>
                <div className="pass-fields"><div><span>ผู้ถือบัตร</span><strong>{isDemoSession() ? "ผู้เยี่ยมชม" : ticketDetail.holderName}</strong></div><div><span>วันและเวลา</span><strong>{formatDate(ticketDetail.eventStartsAt, { day: "numeric", month: "short" })} · {formatTime(ticketDetail.eventStartsAt)}</strong></div><div><span>เลขที่ตั๋ว</span><strong className="mono">{ticketDetail.ticketNumber}</strong></div></div>
                <div className="pass-bottom"><span>PWA TICKET</span><span>ตั๋วอิเล็กทรอนิกส์</span></div>
              </article>
            </section>
          ) : (
            <section className="empty-state panel"><div className="empty-icon"><Icon name="ticket" size={23} /></div><h2>ไม่พบตั๋วนี้</h2><p>กรุณาเข้าสู่ระบบหรือกลับไปที่ตั๋วของฉัน</p><button className="button button-primary" onClick={() => navigate("/my-tickets")}>ดูตั๋วของฉัน <Icon name="arrow" size={16} /></button></section>
          )
        )}

        {route === "orders" && (
          <section className="content-stack">
            <div className="list-intro"><p className="muted-copy">รายการจองทั้งหมดของคุณ</p><span className="saved-chip"><span className="saved-dot" /> {orders.length} รายการ</span></div>
            {!orders.length ? <div className="empty-state panel"><div className="empty-icon"><Icon name="receipt" size={23} /></div><h2>ยังไม่มีรายการจอง</h2><p>เมื่อซื้อตั๋ว รายละเอียดการจองจะแสดงที่นี่</p><button className="button button-secondary" onClick={() => navigate("/login")}>เข้าสู่ระบบ</button></div> : orders.map((order) => <article className="order-card panel" key={order.id}><div className="order-icon"><Icon name="receipt" size={20} /></div><div className="order-description"><span className="section-kicker">{formatDate(order.createdAt, { month: "short", day: "numeric", year: "numeric" })}</span><strong>{order.eventName}</strong><small>{formatDate(order.eventStartsAt, { weekday: "short", month: "short", day: "numeric" })} · {order.venue}</small></div><div className="order-total"><span className="paid-chip">{statusLabel(order.status)}</span><strong>{formatMoney(order.totalAmount)}</strong></div></article>)}
          </section>
        )}

        {route === "account" && (
          <section className="account-layout">
            <div className="account-card panel">
              <div className="account-profile"><span className="avatar-large">{profile?.displayName.slice(0, 1).toUpperCase() ?? "?"}</span><div><span className="section-kicker">ผู้ถือบัตร</span><h2>{isDemoSession() ? "ผู้เยี่ยมชม" : profile?.displayName ?? "ยังไม่ได้เข้าสู่ระบบ"}</h2><p>{isDemoSession() ? "ผู้เยี่ยมชม" : profile?.email ?? "เข้าสู่ระบบเพื่อดูบัญชีของคุณ"}</p></div></div>
              <div className="account-divider" />
              <div className="account-data-row"><div><span className="section-kicker">ตั๋วและรายการจอง</span><strong>ตั๋ว {tickets.length} ใบ · การจอง {orders.length} รายการ</strong></div><span className="saved-chip"><span className="saved-dot" /> ยืนยันแล้ว</span></div>
              <div className="account-actions"><button className="button button-secondary" onClick={() => navigate("/my-tickets")}>ดูตั๋วของฉัน <Icon name="arrow" size={15} /></button><button className="quiet-button" onClick={() => void handleSignOut()}>ออกจากระบบ</button></div>
            </div>
            <aside className="account-note panel"><span className="note-mark"><Icon name="ticket" size={18} /></span><h3>ทุกงานที่คุณอยากไป</h3><p>เลือกงานที่ชอบ แล้วพบกันในประสบการณ์ครั้งต่อไป</p><button className="text-button" onClick={() => navigate("/")}>ค้นหางาน <Icon name="arrow" size={15} /></button></aside>
          </section>
        )}

        {route === "debug" && (
          <section className="debug-layout">
            <div className="debug-status panel">
              <div className="debug-header"><div><span className="section-kicker">สถานะอุปกรณ์นี้</span><h2>พร้อมเปิดดูแบบออฟไลน์หรือยัง</h2></div><span className={`debug-state ${online ? "online-state" : "offline-state"}`}><span className="connection-dot" />{online ? "เชื่อมต่อแล้ว" : "ออฟไลน์"}</span></div>
              <div className="debug-grid">
                <div className="debug-metric"><span>อินเทอร์เน็ต</span><strong><i className={`status-dot ${online ? "" : "status-offline"}`} />{online ? "ออนไลน์" : "ออฟไลน์"}</strong></div>
                <div className="debug-metric"><span>ระบบเปิดแอปออฟไลน์</span><strong><i className={`status-dot ${serviceWorkerReady ? "" : "status-muted"}`} />{serviceWorkerReady ? "พร้อม" : "กำลังเตรียม"}</strong></div>
                <div className="debug-metric"><span>ไฟล์แอปที่บันทึกไว้</span><strong><i className={`status-dot ${appCacheCount ? "" : "status-muted"}`} />{appCacheCount ? "พร้อม" : "ยังไม่พร้อม"}</strong></div>
                <div className="debug-metric"><span>ตั๋วในเครื่อง</span><strong><i className={`status-dot ${tickets.length ? "" : "status-muted"}`} />{tickets.length} ใบ · {orders.length} รายการจอง</strong></div>
                <div className="debug-metric"><span>อัปเดตล่าสุด</span><strong>{prettySyncTime(lastSync)}</strong></div>
                <div className="debug-metric"><span>พื้นที่ที่ใช้</span><strong>{storageUse}</strong></div>
              </div>
              <div className="debug-actions"><button className="button button-primary" onClick={() => void runSync()} disabled={!online || syncState === "syncing"}><Icon name="refresh" size={16} /> {syncState === "syncing" ? "กำลังอัปเดต…" : "อัปเดตข้อมูล"}</button><span className="debug-sync-note">{syncState === "failed" ? "อัปเดตไม่สำเร็จ ยังเปิดดูข้อมูลเดิมได้" : syncState === "offline" ? "ไม่มีเน็ต กำลังแสดงข้อมูลที่บันทึกไว้" : syncState === "synced" ? "อัปเดตข้อมูลแล้ว" : "ดาวน์โหลดข้อมูลบัญชี รายการจอง และตั๋วล่าสุด"}</span></div>
            </div>
            <div className="debug-controls panel"><div><span className="section-kicker">เครื่องมือทดสอบ</span><h2>ทดลองเมื่อระบบขัดข้อง</h2><p>จำลองระบบขัดข้องขณะมีอินเทอร์เน็ต หรือทดสอบลบข้อมูลที่บันทึกไว้</p></div>
              <div className="toggle-row"><div><strong>จำลองระบบเชื่อมต่อขัดข้อง</strong><small>อัปเดตข้อมูลและสร้างตั๋วไม่ได้ แต่ยังเปิดดูตั๋วเดิมได้</small></div><button role="switch" aria-label="จำลองระบบเชื่อมต่อขัดข้อง" aria-checked={apiFailure} className={`switch ${apiFailure ? "switch-on" : ""}`} onClick={toggleApiFailure}><span /></button></div>
              <div className="debug-danger-actions"><button className="quiet-button" onClick={() => void handleClearOfflineData()}><Icon name="close" size={15} /> ลบข้อมูลที่บันทึกไว้</button><button className="quiet-button" onClick={() => void handleClearAppCache()}><Icon name="close" size={15} /> ลบไฟล์แอป</button></div>
            </div>
            <p className="debug-footnote">ระบบทดลอง · ข้อมูลในเครื่องแก้ไขได้ และ QR ยังไม่มีลายเซ็นดิจิทัล จึงไม่ใช้ยืนยันสิทธิ์เข้างานจริง</p>
          </section>
        )}

        {route === "offline" && (
          <section className="empty-state panel"><div className="empty-icon"><Icon name="wifi" size={23} /></div><span className="section-kicker">การเชื่อมต่อขัดข้อง</span><h2>ไม่สามารถเปิดหน้านี้ได้</h2><p>กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองอีกครั้ง</p><button className="button button-primary" onClick={() => online ? navigate("/my-tickets") : navigate("/")}>{online ? "ดูตั๋วของฉัน" : "กลับหน้าหลัก"}<Icon name="arrow" size={16} /></button></section>
        )}

        {route === "not-found" && <section className="empty-state panel"><div className="empty-icon"><Icon name="close" size={23} /></div><h2>ไม่พบหน้านี้</h2><button className="button button-primary" onClick={() => navigate("/")}>กลับหน้าหลัก</button></section>}
      </main>

      <footer className="site-footer"><span>PWA Ticket</span><span>ทุกงานที่คุณอยากไป</span><span>© 2026 PWA Ticket</span></footer>


    </div>
  );
}
