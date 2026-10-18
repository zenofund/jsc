import { notificationAPI } from "./api-client";
import {
  getPushSupportMessage,
  isPushNotificationsSupported,
  registerAppServiceWorker,
} from "./pwa-service-worker";

function decodeApplicationServerKey(key: string): ArrayBuffer {
  const normalizedKey = key.trim().replace(/-/g, "+").replace(/_/g, "/");
  const paddedKey = normalizedKey + "=".repeat((4 - (normalizedKey.length % 4)) % 4);
  const decodedKey = window.atob(paddedKey);
  const result = Uint8Array.from(decodedKey, (character) => character.charCodeAt(0));

  if (result.length !== 65 || result[0] !== 4) {
    throw new Error("The push notification application server key is invalid.");
  }

  return result.buffer.slice(
    result.byteOffset,
    result.byteOffset + result.byteLength,
  ) as ArrayBuffer;
}

export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushNotificationsSupported()) {
    throw new Error(getPushSupportMessage());
  }

  const registration = await registerAppServiceWorker();
  return registration.pushManager.getSubscription();
}

export async function enableBrowserPushNotifications(): Promise<void> {
  if (!isPushNotificationsSupported()) {
    throw new Error(getPushSupportMessage());
  }

  // Ask before the first network wait so this call remains within the user's click gesture.
  const permission = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(permission === "denied"
      ? "Notifications are blocked in browser settings. Allow them for this site and try again."
      : "Notification permission was not granted.");
  }

  const { publicKey: applicationServerKey } = await notificationAPI.getPushPublicKey();
  if (!applicationServerKey) {
    throw new Error("The server did not provide a push notification key.");
  }

  const registration = await registerAppServiceWorker();
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeApplicationServerKey(applicationServerKey),
    });
  }

  const subscriptionJson = subscription.toJSON();
  const endpoint = subscriptionJson.endpoint || subscription.endpoint;
  const p256dh = subscriptionJson.keys?.p256dh;
  const auth = subscriptionJson.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    throw new Error("The browser returned an incomplete push subscription.");
  }

  // Re-register even an existing browser subscription so it is associated with the active account.
  await notificationAPI.subscribe({ endpoint, p256dh, auth });
}

export async function disableBrowserPushNotifications(): Promise<void> {
  if (!isPushNotificationsSupported()) {
    throw new Error("Push notifications are not available in this browser.");
  }

  const registration = await registerAppServiceWorker();
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await notificationAPI.unsubscribe({ endpoint: subscription.endpoint });
    await subscription.unsubscribe();
    return;
  }

  await notificationAPI.unsubscribe({});
}
