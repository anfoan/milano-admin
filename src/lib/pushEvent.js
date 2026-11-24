const ADMIN_PUSH_EVENT_ENDPOINT = '/api/push/event';

const send = (payload) => fetch(ADMIN_PUSH_EVENT_ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
  keepalive: true
}).catch(() => undefined);

export const notifyAdminOfInventoryChanges = (changes = [], source = 'inventory') => {
  const events = changes
    .filter(change => change?.id && Number.isFinite(Number(change.quantity)) && Number(change.quantity) >= 0)
    .filter(change => Number(change.quantity) <= 3)
    .map(change => send({
      type: 'inventory',
      source,
      product: {
        id: change.id,
        name: change.name,
        quantity: Number(change.quantity),
        image: change.image || change.mainImage || ''
      }
    }));
  return Promise.allSettled(events);
};

export const notifyAdminOfNewMessage = (message) => {
  if (!message?.id) return Promise.resolve();
  return send({
    type: 'message',
    message: {
      id: message.id,
      name: message.name,
      subject: message.subject
    }
  });
};
