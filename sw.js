// sw.js — Verity Service Worker
// Nerima push notification dari server & nampilin ke user
// Taruh di ROOT folder (sama level dengan index.html)

const CACHE_NAME = 'verity-v1';

// =====================
// INSTALL & ACTIVATE
// =====================
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

// =====================
// PUSH — Nerima notif dari server
// =====================
self.addEventListener('push', (e) => {
  if (!e.data) return;

  let data;
  try {
    data = e.data.json();
  } catch {
    data = { title: 'Verity', body: e.data.text() };
  }

  const { title, body, icon, phase, isMidnight } = data;

  // Opsi notif — beda per fase
  const options = {
    body: body || '...',
    icon: icon || '/icons/verity-icon.png',
    badge: '/icons/verity-badge.png',
    silent: false,
    vibrate: _getVibrate(phase),
    data: { phase, isMidnight, url: '/' },
    tag: isMidnight ? 'verity-midnight' : `verity-phase-${phase}`,
    renotify: true,
  };

  e.waitUntil(
    self.registration.showNotification(title || 'Verity', options)
  );
});

// Pola getar beda per fase
function _getVibrate(phase) {
  switch (phase) {
    case 1: return [200];                          // 1x pendek, friendly
    case 2: return [200, 100, 200];                // 2x, mulai aneh
    case 3: return [300, 100, 300, 100, 600];      // panjang, disturbing
    case 4: return [100, 50, 100, 50, 100, 50,
                    500, 50, 100, 50, 100];         // glitch pattern
    default: return [200];
  }
}

// =====================
// NOTIFICATION CLICK — Buka app saat notif diklik
// =====================
self.addEventListener('notificationclick', (e) => {
  e.notification.close();

  const targetUrl = e.notification.data?.url || '/';

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Kalau tab Verity udah kebuka, fokus ke sana
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Kalau belum ada, buka tab baru
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// =====================
// PUSH SUBSCRIPTION CHANGE
// Auto re-subscribe kalau subscription expired
// =====================
self.addEventListener('pushsubscriptionchange', (e) => {
  e.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: e.oldSubscription?.options?.applicationServerKey,
    }).then((newSubscription) => {
      // Kirim subscription baru ke server
      return fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: newSubscription }),
      });
    })
  );
});
