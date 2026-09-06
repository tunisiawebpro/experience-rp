self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();
    event.waitUntil(
        self.registration.showNotification(data.title || 'Experience RP', {
            body: data.body || 'A creator is live now.',
            icon: '/images/logoex.png',
            badge: '/images/logoex.png',
            tag: data.tag || 'experience-rp-creator-live',
            renotify: true,
            data: { url: data.url || '/' }
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            const existingClient = clientList.find((client) => 'focus' in client);
            if (existingClient) {
                existingClient.navigate(targetUrl);
                return existingClient.focus();
            }
            return clients.openWindow(targetUrl);
        })
    );
});
