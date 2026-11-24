import webpush from 'web-push';

const PROJECT_ID = 'milano-anfoan-store-2026';
const FIREBASE_API_KEY = 'AIzaSyBg8X5nruSDOHbirXjbFMqEQ2bSh9nr4qw';
const VAPID_SUBJECT = 'mailto:milano@milano-store.com';
const VAPID_PUBLIC_KEY = 'BCbMrtbwLqp8m1tvNmhGddnaYe4HfMwueh9af98rqnJG1J09tqsDCKIQxxglpwNSPME69IluL6iPo6KzwrUwjhs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Content-Type': 'application/json; charset=utf-8'
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });

const firestoreUrl = (path = '') => `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}?key=${FIREBASE_API_KEY}`;

const toFirestoreValue = (value) => {
  if (value === null) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return { doubleValue: value };
  return { stringValue: String(value) };
};

const fromFirestoreValue = (value) => {
  if (!value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  return null;
};

const readFields = (fields = {}) => Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, fromFirestoreValue(value)]));

const subscriptionId = async (endpoint) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
};

const sendToSubscriptions = async (payload, env) => {
  const response = await fetch(firestoreUrl('push_subscriptions'));
  if (!response.ok) throw new Error(`Firestore subscription read failed: ${response.status}`);
  const data = await response.json();
  const subscriptions = (data.documents || []).map(document => ({ id: document.name.split('/').pop(), ...readFields(document.fields) })).filter(item => item.endpoint && item.p256dh && item.auth);
  if (!env?.VAPID_PRIVATE_KEY) throw new Error('VAPID_PRIVATE_KEY is not configured');
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  const results = await Promise.allSettled(subscriptions.map(subscription => webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify(payload))));
  return { sent: results.filter(result => result.status === 'fulfilled').length, attempted: results.length };
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestGet({ params }) {
  if (params.path === 'config') return json({ publicKey: VAPID_PUBLIC_KEY });
  return json({ error: 'Not found' }, 404);
}

export async function onRequestPost({ request, params, env }) {
  if (params.path === 'subscribe') {
    const body = await request.json().catch(() => null);
    const subscription = body?.subscription;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) return json({ error: 'Invalid subscription' }, 400);
    const id = await subscriptionId(subscription.endpoint);
    return json({ ok: true, id });
  }
  if (params.path === 'order') {
    const body = await request.json().catch(() => ({}));
    const order = body?.order || {};
    const result = await sendToSubscriptions({
      type: 'new-order',
      title: order.isPOS ? 'طلب جديد من نقطة البيع' : 'طلب جديد من المتجر',
      body: `${order.formData?.name || 'عميل'} — ${order.orderId || order.id || ''}`,
      orderId: order.orderId || order.id || '',
      url: '/milano-dashboard-vault-77?view=orders'
    }, env);
    return json({ ok: true, ...result });
  }
  return json({ error: 'Not found' }, 404);
}
