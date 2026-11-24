import { corsHeaders, json, subscriptionId } from './_shared.js';

export function onRequestOptions() { return new Response(null, { status: 204, headers: corsHeaders }); }
export async function onRequestPost({ request }) {
  const body = await request.json().catch(() => null);
  const subscription = body?.subscription;
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) return json({ error: 'Invalid subscription' }, 400);
  return json({ ok: true, id: await subscriptionId(subscription.endpoint) });
}
