const ADMIN_PUSH_ENDPOINT = '/api/push/order';

export const notifyAdminOfNewOrder = (order, source = 'pos') => fetch(ADMIN_PUSH_ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ order: { ...order, source, id: order.id || order.orderId } }),
  keepalive: true
}).catch(() => undefined);
