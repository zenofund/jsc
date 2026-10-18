function getAppBaseUrl(): URL {
  const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (manifest?.href) {
    return new URL(".", manifest.href);
  }

  return new URL(import.meta.env.BASE_URL, window.location.href);
}

function isInstalledAppleMobileApp(): boolean {
  const userAgent = navigator.userAgent;
  const isAppleMobile = /iPhone|iPad|iPod/i.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return isAppleMobile && isStandalone;
}

export function isPushNotificationsSupported(): boolean {
  const browserSupportsPush = (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
  if (!browserSupportsPush) return false;

  const isAppleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return !isAppleMobile || isInstalledAppleMobileApp();
}

export function getPushSupportMessage(): string {
  if (typeof window === "undefined" || !window.isSecureContext) {
    return "Push notifications require a secure HTTPS connection.";
  }

  const isAppleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isAppleMobile && !isInstalledAppleMobileApp()) {
    return "On iPhone or iPad, add JSC PMS to the Home Screen, then open it there to enable push notifications.";
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "This browser does not support web push notifications.";
  }

  return "Push notifications are unavailable in this browser.";
}

export async function registerAppServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("This browser does not support service workers.");
  }
  if (!window.isSecureContext) {
    throw new Error("Service workers and push notifications require HTTPS.");
  }

  const appBaseUrl = getAppBaseUrl();
  const serviceWorkerUrl = new URL("sw.js", appBaseUrl);
  const registration = await navigator.serviceWorker.register(serviceWorkerUrl, {
    scope: appBaseUrl.pathname,
    updateViaCache: "none",
  });

  if (registration.active?.state === "activated") {
    return registration;
  }

  const installingWorker = registration.installing ?? registration.waiting;
  if (!installingWorker) {
    throw new Error("The service worker registered without becoming active.");
  }

  await new Promise<void>((resolve, reject) => {
    const handleStateChange = () => {
      if (installingWorker.state === "activated" && registration.active) {
        installingWorker.removeEventListener("statechange", handleStateChange);
        resolve();
      } else if (installingWorker.state === "redundant") {
        installingWorker.removeEventListener("statechange", handleStateChange);
        reject(new Error("The service worker could not be activated."));
      }
    };
    installingWorker.addEventListener("statechange", handleStateChange);
    handleStateChange();
  });

  return registration;
}
