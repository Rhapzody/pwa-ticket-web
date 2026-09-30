import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PWA Ticket",
  description: "PWA Ticket — ค้นหางานที่คุณชอบและซื้อตั๋วได้ในที่เดียว",
  applicationName: "PWA Ticket",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "PWA Ticket",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#f5f3ed",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <head>
        <link rel="preload" href="/fonts/noto-sans-thai.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/noto-sans-thai-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
