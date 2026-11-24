import { corsHeaders, json, sendToSubscriptions } from './_shared.js';

export function onRequestOptions() { return new Response(null, { status: 204, headers: corsHeaders }); }
export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const order = body?.order || {};
  if (!order.id && !order.orderId) return json({ error: 'Order id is required' }, 400);
  try {
    const result = await sendToSubscriptions({
      type: 'new-order',
      title: order.isPOS ? 'طلب جديد من نقطة البيع' : 'طلب جديد من المتجر',
      body: `${order.formData?.name || 'عميل'} — ${order.orderId || order.id || ''}`,
      orderId: order.orderId || order.id || '',
      url: '/milano-dashboard-vault-77?view=orders'
    }, env);
    return json({ ok: true, ...result });
  } catch (error) {
    console.error('Web Push send failed', error);
    return json({ error: 'Push delivery failed' }, 502);
  }
}
