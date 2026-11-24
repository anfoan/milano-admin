import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from './firebase';

const PUSH_CONFIG_URL = '/api/push/config';
const PUSH_SUBSCRIBE_URL = '/api/push/subscribe';

const subscriptionDocumentId = async (endpoint) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
};

const removeSubscriptionRecords = async (endpoint) => {
  if (!endpoint) return;
  const snapshot = await getDocs(query(collection(db, 'push_subscriptions'), where('endpoint', '==', endpoint)));
  await Promise.all(snapshot.docs.map(item => deleteDoc(item.ref)));
};

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
  try { await registration.update(); } catch (_) { /* the active worker can still be used */ }
  const configResponse = await fetch(PUSH_CONFIG_URL, { cache: 'no-store' });
  if (!configResponse.ok) throw new Error('push-config-failed');
  const { publicKey } = await configResponse.json();
  if (!publicKey) throw new Error('push-config-missing');
  let subscription = await registration.pushManager.getSubscription();
  // Recreate the subscription after a PWA/Service Worker update so iOS does not
  // keep routing pushes through a stale Apple endpoint.
  if (subscription) {
    const oldEndpoint = subscription.endpoint;
    try { await subscription.unsubscribe(); } catch (_) { /* continue with a fresh subscription */ }
    await removeSubscriptionRecords(oldEndpoint);
  }
  subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeVapidKey(publicKey) });
  const subscriptionJson = subscription.toJSON();
  if (!subscriptionJson.endpoint || !subscriptionJson.keys?.p256dh || !subscriptionJson.keys?.auth) {
    throw new Error('push-subscription-incomplete');
  }
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
  const recordId = await subscriptionDocumentId(subscriptionJson.endpoint);
  await setDoc(doc(db, 'push_subscriptions', recordId), record);
  const serverResponse = await fetch(PUSH_SUBSCRIBE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: subscriptionJson })
  });
  if (!serverResponse.ok) throw new Error('push-subscription-server-rejected');
  return subscription;
};

export const getAdminPushState = async () => {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return { supported: false, enabled: false, permission: 'unsupported' };
  const registration = await getAdminPushRegistration();
  const subscription = await registration.pushManager.getSubscription();
  return { supported: true, enabled: Boolean(subscription), permission: Notification.permission, subscription };
};

export const disableAdminPush = async () => {
  if (!('serviceWorker' in navigator)) return;
  const registration = await getAdminPushRegistration();
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await removeSubscriptionRecords(endpoint);
  }
};
