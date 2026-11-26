import { corsHeaders, json, sendToSubscriptions } from './_shared.js';

export function onRequestOptions() { return new Response(null, { status: 204, headers: corsHeaders }); }

const stockPayload = (product) => {
  const quantity = Math.max(0, Number(product.quantity) || 0);
  const isOut = quantity === 0;
  const name = product.name || 'منتج';
  return {
    type: isOut ? 'stock-out' : 'stock-low',
    title: isOut ? 'نفذ المخزون ⛔️' : 'مخزون منخفض ⚠️',
    body: isOut ? `${name} — الكمية المتبقية: 0` : `${name} — الكمية المتبقية: ${quantity}`,
    productId: product.productId || '',
    productName: name,
    quantity,
    stockStatus: isOut ? 'out' : 'low',
    image: product.image || '',
    icon: product.image || '/admin-icon-192.png',
    tag: `milano-stock-${product.productId || name}`,
    url: '/milano-dashboard-vault-77?view=inventory'
  };
};

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  let payload;
  if (body?.type === 'message') {
    const message = body.message || {};
    if (!message.id) return json({ error: 'Message id is required' }, 400);
    payload = {
      type: 'new-message',
      title: 'رسالة جديدة من العميل 💬',
      body: `${message.name || 'عميل'} — ${message.subject || 'رسالة جديدة'}`,
      messageId: message.id,
      image: message.image || '',
      icon: '/admin-icon-192.png',
      tag: `milano-message-${message.id}`,
      url: `/milano-dashboard-vault-77?view=inbox&message=${encodeURIComponent(message.id)}`
    };
  } else if (body?.type === 'inventory') {
    if (!body.product?.id && !body.product?.productId) return json({ error: 'Product id is required' }, 400);
    const quantity = Number(body.product.quantity);
    if (body.product.quantity == null || String(body.product.quantity).trim() === '' || !Number.isFinite(quantity) || quantity < 0) {
      return json({ error: 'A valid non-negative stock quantity is required' }, 400);
    }
    if (quantity > 4) return json({ ok: true, skipped: true }, 200);
    payload = stockPayload({ ...body.product, productId: body.product.productId || body.product.id });
  } else {
    return json({ error: 'Unsupported push event' }, 400);
  }

  try {
    const result = await sendToSubscriptions(payload, env);
    return json({ ok: true, ...result });
  } catch (error) {
    console.error('Web Push event failed', error);
    return json({ error: 'Push delivery failed' }, 502);
  }
}
