import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

const PUSH_CONFIG_URL = '/api/push/config';
const PUSH_SUBSCRIBE_URL = '/api/push/subscribe';

const decodeVapidKey = (value) => {
  const normalized = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  const binary = window.atob(normalized);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
};

export const getAdminPushRegistration = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    throw new Error('unsupported');
  }
  return navigator.serviceWorker.ready;
};

export const enableAdminPush = async () => {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('permission-denied');
  const registration = await getAdminPushRegistration();
  const configResponse = await fetch(PUSH_CONFIG_URL, { cache: 'no-store' });
  if (!configResponse.ok) throw new Error('push-config-failed');
  const { publicKey } = await configResponse.json();
  if (!publicKey) throw new Error('push-config-missing');
  let subscription = await registration.pushManager.getSubscription();
  // Recreate the subscription after a PWA/Service Worker update so iOS does not
  // keep routing pushes through a stale Apple endpoint.
  if (subscription) {
    try { await subscription.unsubscribe(); } catch (_) { /* continue with a fresh subscription */ }
  }
  subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeVapidKey(publicKey) });
  const subscriptionJson = subscription.toJSON();
  const record = {
    endpoint: subscriptionJson.endpoint,
    p256dh: subscriptionJson.keys?.p256dh || '',
    auth: subscriptionJson.keys?.auth || '',
    platform: navigator.platform || '',
    userAgent: navigator.userAgent || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    enabled: true
  };
  await addDoc(collection(db, 'push_subscriptions'), record);
  await fetch(PUSH_SUBSCRIBE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: subscriptionJson })
  }).catch(() => {});
  return subscription;
};

export const getAdminPushState = async () => {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return { supported: false, enabled: false, permission: 'unsupported' };
  const registration = await getAdminPushRegistration();
  const subscription = await registration.pushManager.getSubscription();
  return { supported: true, enabled: Boolean(subscription), permission: Notification.permission, subscription };
};
