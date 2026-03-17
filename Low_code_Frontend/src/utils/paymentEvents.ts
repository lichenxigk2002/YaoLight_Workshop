export type PaymentEventStatus = 'pending' | 'paid' | 'cancelled' | 'failed';

export interface PaymentEventPayload {
  orderId: string;
  status: PaymentEventStatus;
  timestamp: number;
  source: 'callback';
}

const PAYMENT_EVENT_MESSAGE_TYPE = 'payment-callback';
const PAYMENT_EVENT_STORAGE_KEY = 'payment-callback-event';
const PAYMENT_EVENT_CHANNEL = 'payment-callback-channel';

function normalizePaymentStatus(status?: string | null): PaymentEventStatus {
  switch ((status || '').toLowerCase()) {
    case 'success':
    case 'paid':
      return 'paid';
    case 'cancelled':
      return 'cancelled';
    case 'failed':
    case 'error':
      return 'failed';
    default:
      return 'pending';
  }
}

function parsePayload(value: unknown): PaymentEventPayload | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const raw = value as Partial<PaymentEventPayload>;
  if (!raw.orderId || typeof raw.orderId !== 'string') {
    return null;
  }

  return {
    orderId: raw.orderId,
    status: normalizePaymentStatus(raw.status),
    timestamp: typeof raw.timestamp === 'number' ? raw.timestamp : Date.now(),
    source: 'callback',
  };
}

export function buildPaymentEvent(orderId: string, status?: string | null): PaymentEventPayload {
  return {
    orderId,
    status: normalizePaymentStatus(status),
    timestamp: Date.now(),
    source: 'callback',
  };
}

export function emitPaymentEvent(payload: PaymentEventPayload) {
  if (typeof window === 'undefined') {
    return;
  }

  const serialized = JSON.stringify(payload);

  try {
    localStorage.setItem(PAYMENT_EVENT_STORAGE_KEY, serialized);
  } catch {
    // ignore storage failures
  }

  try {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel(PAYMENT_EVENT_CHANNEL);
      channel.postMessage(payload);
      channel.close();
    }
  } catch {
    // ignore channel failures
  }

  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        {
          type: PAYMENT_EVENT_MESSAGE_TYPE,
          payload,
        },
        window.location.origin,
      );
    }
  } catch {
    // ignore cross-window failures
  }
}

export function subscribePaymentEvents(callback: (payload: PaymentEventPayload) => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handled = new Set<string>();
  let channel: BroadcastChannel | null = null;

  const forward = (payload: PaymentEventPayload | null) => {
    if (!payload) {
      return;
    }

    const key = `${payload.orderId}:${payload.status}:${payload.timestamp}`;
    if (handled.has(key)) {
      return;
    }

    handled.add(key);
    callback(payload);
  };

  const onMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) {
      return;
    }
    if (event.data?.type !== PAYMENT_EVENT_MESSAGE_TYPE) {
      return;
    }
    forward(parsePayload(event.data.payload));
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key !== PAYMENT_EVENT_STORAGE_KEY || !event.newValue) {
      return;
    }

    try {
      forward(parsePayload(JSON.parse(event.newValue)));
    } catch {
      // ignore malformed payloads
    }
  };

  window.addEventListener('message', onMessage);
  window.addEventListener('storage', onStorage);

  try {
    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel(PAYMENT_EVENT_CHANNEL);
      channel.onmessage = (event) => {
        forward(parsePayload(event.data));
      };
    }
  } catch {
    channel = null;
  }

  return () => {
    window.removeEventListener('message', onMessage);
    window.removeEventListener('storage', onStorage);
    channel?.close();
  };
}
