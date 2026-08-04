const DEFAULT_SCALEV_BASE_URL = 'https://api.scalev.com/v3';

async function parseScalevResponse(response: Response) {
  const rawText = await response.text();

  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText) as unknown;
  } catch {
    return {
      raw: rawText,
    };
  }
}

export function getScalevBaseUrl(url?: string | null) {
  const candidate = (url || '').trim();

  if (!candidate) {
    return DEFAULT_SCALEV_BASE_URL;
  }

  return candidate.replace(/\/+$/, '');
}

export function getScalevErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const error = 'error' in payload && typeof payload.error === 'string' ? payload.error : null;
  const message = 'message' in payload && typeof payload.message === 'string' ? payload.message : null;
  const raw = 'raw' in payload && typeof payload.raw === 'string' ? payload.raw : null;
  const baseErrors =
    'errors' in payload &&
    payload.errors &&
    typeof payload.errors === 'object' &&
    'base' in payload.errors &&
    Array.isArray(payload.errors.base)
      ? payload.errors.base.filter((item): item is string => typeof item === 'string')
      : [];
  const firstBaseError = baseErrors[0] || null;

  return error || message || firstBaseError || raw || fallback;
}

export async function changeScalevOrderStatus(params: {
  apiKey: string;
  baseUrl: string;
  orderIds: string[];
  status: string;
}) {
  const response = await fetch(`${params.baseUrl}/orders/change-status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      ids: params.orderIds,
      status: params.status,
    }),
  });

  const data = await parseScalevResponse(response);

  return {
    ok: response.ok,
    statusCode: response.status,
    data,
    message: getScalevErrorMessage(data, `Gagal mengubah status di Scalev (HTTP ${response.status})`),
  };
}

export async function getScalevOrderStatus(params: {
  apiKey: string;
  baseUrl: string;
  orderId: string;
}) {
  const url = new URL(`${params.baseUrl}/orders`);
  url.searchParams.set('order_id', params.orderId);
  url.searchParams.set('columns', 'order_id,status');
  url.searchParams.set('page_size', '1');

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
    },
  });

  const data = await parseScalevResponse(response);

  if (!response.ok) {
    return {
      ok: false,
      statusCode: response.status,
      data,
      orderStatus: null as string | null,
      message: getScalevErrorMessage(data, `Gagal mengambil status order Scalev (HTTP ${response.status})`),
    };
  }

  const rows =
    data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)
      ? data.data
      : [];

  const firstRow = rows[0];
  const orderStatus =
    firstRow && typeof firstRow === 'object' && 'status' in firstRow && typeof firstRow.status === 'string'
      ? firstRow.status
      : null;

  return {
    ok: true,
    statusCode: response.status,
    data,
    orderStatus,
    message: orderStatus ? 'Status order berhasil diambil.' : 'Order ditemukan, tetapi status tidak tersedia.',
  };
}
