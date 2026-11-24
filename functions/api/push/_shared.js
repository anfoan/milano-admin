import { buildPushPayload } from '@block65/webcrypto-web-push';

export const PROJECT_ID = 'milano-anfoan-store-2026';
export const FIREBASE_API_KEY = 'AIzaSyBg8X5nruSDOHbirXjbFMqEQ2bSh9nr4qw';
export const VAPID_SUBJECT = 'mailto:milano@milano-store.com';
export const VAPID_PUBLIC_KEY = 'BCbMrtbwLqp8m1tvNmhGddnaYe4HfMwueh9af98rqnJG1J09tqsDCKIQxxglpwNSPME69IluL6iPo6KzwrUwjhs';
export const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Content-Type': 'application/json; charset=utf-8' };
export const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });
export const firestoreUrl = (path = '') => `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}?key=${FIREBASE_API_KEY}`;
export const fromFirestoreValue = (value) => {
  if (!value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  return null;
};
const readFields = (fields = {}) => Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, fromFirestoreValue(value)]));
export const subscriptionId = async (endpoint) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
};
export const sendToSubscriptions = async (payload, env) => {
  if (!env?.VAPID_PRIVATE_KEY) throw new Error('VAPID_PRIVATE_KEY is not configured');
  const response = await fetch(firestoreUrl('push_subscriptions'));
  if (!response.ok) throw new Error(`Firestore subscription read failed: ${response.status}`);
  const data = await response.json();
  const subscriptions = (data.documents || []).map(document => ({ id: document.name.split('/').pop(), ...readFields(document.fields) })).filter(item => item.endpoint && item.p256dh && item.auth);
  const vapid = { subject: VAPID_SUBJECT, publicKey: VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
  const results = await Promise.allSettled(subscriptions.map(async (subscription) => {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      expirationTime: null,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth }
    };
    const request = await buildPushPayload({ data: JSON.stringify(payload), options: { ttl: 60, urgency: 'high' } }, pushSubscription, vapid);
    const response = await fetch(subscription.endpoint, request);
    if (!response.ok) {
      const body = await response.text();
      const error = new Error(body || `Push service returned ${response.status}`);
      error.statusCode = response.status;
      error.body = body;
      throw error;
    }
    return response;
  }));
  return {
    sent: results.filter(result => result.status === 'fulfilled').length,
    attempted: results.length,
    failed: results.filter(result => result.status === 'rejected').map(result => ({
      statusCode: result.reason?.statusCode || null,
      body: result.reason?.body || null,
      message: result.reason?.message || String(result.reason || 'Unknown push error')
    }))
  };
};
