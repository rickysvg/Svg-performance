self.addEventListener("push", (event) => {
  const fallback = {
    title: "SVG Performance",
    body: "Weekly check-in due",
    url: "/checkin",
  };
  let data = fallback;
  try {
    if (event.data) {
      const parsed = event.data.json();
      data = {
        title: typeof parsed.title === "string" ? parsed.title : fallback.title,
        body: typeof parsed.body === "string" ? parsed.body : fallback.body,
        url: typeof parsed.url === "string" ? parsed.url : fallback.url,
      };
    }
  } catch {
    data = fallback;
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/favicon-64.png",
      badge: "/favicon-64.png",
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data && event.notification.data.url ? event.notification.data.url : "/checkin";
  const url = new URL(path, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
      return undefined;
    }),
  );
});
