function resolveAppUrl(value) {
  const rawValue = typeof value === 'string' ? value.trim() : '';
  if (/^https?:\/\//i.test(rawValue)) {
    return new URL(rawValue).href;
  }

  const relativePath = rawValue.replace(/^\/+/, '');
  return new URL(relativePath || '.', self.registration.scope).href;
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { body: event.data.text() };
    }
  }

  const iconUrl = resolveAppUrl(data.icon || 'icon-192.png');
  const options = {
    body: data.body || '',
    icon: iconUrl,
    badge: resolveAppUrl(data.badge || 'icon-192.png'),
    actions: Array.isArray(data.actions) ? data.actions : [],
    data: { url: resolveAppUrl(data.url || '.') },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'JSC Payroll Management System', options),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = resolveAppUrl(event.notification.data?.url || '.');

  event.waitUntil((async () => {
    const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const appClient = windowClients.find((client) => new URL(client.url).origin === new URL(targetUrl).origin);
    if (appClient) {
      if (appClient.url !== targetUrl && 'navigate' in appClient) {
        await appClient.navigate(targetUrl);
      }
      return appClient.focus();
    }

    return self.clients.openWindow(targetUrl);
  })());
});
