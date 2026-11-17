// Appli Origami : la page s'ouvre même sans réseau (dernière version gardée) ; avec réseau, toujours la version en ligne.
var CACHE = "origami-appli-1";
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", function (e) {
  var r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== self.location.origin || r.url.indexOf(self.registration.scope) !== 0) return;
  e.respondWith(fetch(r).then(function (rep) {
    if (rep && rep.ok) { var copie = rep.clone(); caches.open(CACHE).then(function (c) { c.put(r, copie); }); }
    return rep;
  }).catch(function () { return caches.match(r, { ignoreSearch: true }).then(function (m) { return m || Response.error(); }); }));
});
