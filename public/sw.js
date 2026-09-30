const SHELL_CACHE = "field-notes-shell-v2";
const ASSET_CACHE = "field-notes-assets-v2";
const OPTIONAL_SHELL_URLS = ["/offline.html", "/icon.svg", "/manifest.webmanifest"];

async function cacheShellPage(request, response) {
  if (!response.ok) throw new Error("The app shell could not be loaded.");

  const html = await response.clone().text();
  const assetUrls = [...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => new URL(match[1], self.location.origin))
    .filter((url) => url.origin === self.location.origin && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/fonts/")))
    .map((url) => url.href);
  const assets = [...new Set(assetUrls)];
  if (assets.length === 0) throw new Error("The app shell did not list its static assets.");

  const assetCache = await caches.open(ASSET_CACHE);
  await Promise.all(assets.map(async (url) => {
    const assetResponse = await fetch(new Request(url, { cache: "reload" }));
    if (!assetResponse.ok) throw new Error(`Unable to cache ${url}`);
    await assetCache.put(url, assetResponse);
  }));

  const shellCache = await caches.open(SHELL_CACHE);
  await shellCache.put(request, response.clone());
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shellResponse = await fetch(new Request("/", { cache: "reload" }));
      await cacheShellPage("/", shellResponse);
      const shellCache = await caches.open(SHELL_CACHE);
      await Promise.all(OPTIONAL_SHELL_URLS.map(async (url) => {
        try {
          await shellCache.add(new Request(url, { cache: "reload" }));
        } catch {
          // These assets are optional; the app shell and its scripts are required.
        }
      }));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("field-notes-") && ![SHELL_CACHE, ASSET_CACHE].includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;
  if (request.headers.get("accept")?.includes("text/x-component")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            try {
              await cacheShellPage(request, response);
            } catch (error) {
              console.warn("The latest app shell could not be saved for offline use.", error);
            }
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(SHELL_CACHE);
          return (
            (await cache.match(request, { ignoreSearch: true })) ??
            (await cache.match("/")) ??
            (await cache.match("/offline.html")) ??
            Response.error()
          );
        }),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/fonts/")) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  if (url.pathname === "/icon.svg" || url.pathname === "/manifest.webmanifest") {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      }),
    );
  }
});
