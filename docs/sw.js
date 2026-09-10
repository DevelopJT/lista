"use strict";

// Työkalulistan offline-tuki: tallentaa sivun puhelimeen, jotta
// QR-koodin skannaus toimii ensimmäisen avauksen jälkeen ilman verkkoa.
// Sivu ei hae mitään ulkopuolisilta palvelimilta, joten välimuistissa
// on vain omat tiedostot.

// Nimi vaihtuu kun tallennettava sisältö muuttuu: vanha välimuisti
// siivotaan activate-vaiheessa.
const CACHE = "tyokalulista-v3";
const CORE = ["./index.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Verkossa haetaan aina tuorein versio ja pidetään kopio tallessa,
  // ilman verkkoa käytetään tallennettua kopiota.
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true })
          // Hakemisto-osoite ("/lista/") ei ole välimuistissa omalla
          // nimellään, joten viimeinen varasija on aina itse sivu.
          .then((hit) => hit || caches.match("./index.html"))
          .then((hit) => hit || new Response("Ei verkkoyhteyttä eikä tallennettua sivua.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          }))
      )
  );
});
