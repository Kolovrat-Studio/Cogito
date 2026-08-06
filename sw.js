const CACHE_NAME = "cogito-cache-v1";
const urlsToCache = [
  "./index.html",
  "./style.css",
  "./manifest.json",
  "./CogitoBaner.jpg",
];

// Instalacija Service Worker-a i keširanje fajlova
self.addEventListener("install", (event) => {
  console.log("Service Worker installing.");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Opened cache");
      return cache.addAll(urlsToCache);
    }),
  );
  self.skipWaiting();
});

// Aktiviranje i čišćenje starih keš memorija ako se pojavi nova verzija
self.addEventListener("activate", (event) => {
  console.log("Service Worker activating.");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );
  event.waitUntil(clients.claim());
});

// Presretanje mrežnih zahteva (Network first, pa fallback na keš)
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Ako je internet dostupan, vrati mrežni odgovor
        return response;
      })
      .catch(() => {
        // Ako nema interneta, povuci sačuvane fajlove iz keša
        return caches.match(event.request);
      }),
  );
});
