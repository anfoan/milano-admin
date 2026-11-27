import { corsHeaders, json, sendToSubscriptions } from './_shared.js';

export function onRequestOptions() { return new Response(null, { status: 204, headers: corsHeaders }); }
export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const order = body?.order || {};
  if (!order.id && !order.orderId) return json({ error: 'Order id is required' }, 400);
  const firstItem = Array.isArray(order.cartItems) ? order.cartItems.find((item) => item?.image || item?.imageUrl || item?.productImage) : null;
  const firstImage = firstItem?.image || firstItem?.imageUrl || firstItem?.productImage || '';
  const currencyCode = String(order.currency || 'YER').trim().toUpperCase();
  const currencyLabel = { YER: 'ريال يمني', SAR: 'ريال سعودي', USD: 'دولار أمريكي' }[currencyCode] || currencyCode;
  const total = order.total == null || order.total === '' ? NaN : Number(order.total);
  // Storefront totals stay in YER; POS/external totals already use the invoice currency.
  const isStorefront = !order.isPOS && !order.isExternal && order.source !== 'pos' && order.source !== 'external';
  const invoiceTotal = isStorefront && currencyCode === 'SAR' ? total / 140 : total;
  const amount = Number.isFinite(invoiceTotal) ? `${Math.round(invoiceTotal).toLocaleString('en-US')} ${currencyLabel}` : 'غير متوفر';
  try {
    const result = await sendToSubscriptions({
      type: 'new-order',
      title: order.isPOS ? 'طلب جديد من نقطة البيع 🛍️' : order.isExternal || order.source === 'external' ? 'طلب جديد خارجي 🛍️' : 'طلب جديد من المتجر 🛍️',
      body: `${order.formData?.name || 'عميل'} — ${order.orderId || order.id || ''}\nمبلغ الطلب : ${amount}`,
      orderId: order.orderId || order.id || '',
      image: firstImage,
      icon: firstImage || '/admin-icon-192.png',
      url: '/milano-dashboard-vault-77?view=orders'
    }, env);
    return json({ ok: true, ...result });
  } catch (error) {
    console.error('Web Push send failed', error);
    return json({ error: 'Push delivery failed' }, 502);
  }
}
