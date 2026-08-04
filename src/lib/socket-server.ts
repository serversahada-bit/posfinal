import 'server-only';

const normalizeServerSocketUrl = (rawUrl: string): string => {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (trimmed.startsWith('ws://')) {
    return `http://${trimmed.slice(5)}`;
  }

  if (trimmed.startsWith('wss://')) {
    return `https://${trimmed.slice(6)}`;
  }

  return trimmed;
};

const getServerSocketUrl = (): string | null => {
  if (process.env.WS_URL) {
    return normalizeServerSocketUrl(process.env.WS_URL);
  }

  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:3001';
  }

  return null;
};

export const emitEvent = async (eventName: string, payload?: unknown): Promise<boolean> => {
  try {
    const socketServerUrl = getServerSocketUrl();
    if (!socketServerUrl) {
      console.warn(`Socket server URL tidak dikonfigurasi. Event "${eventName}" tidak dikirim.`);
      return false;
    }

    const eventSecret = process.env.WS_EVENT_SECRET;
    if (!eventSecret) {
      console.warn(`WS_EVENT_SECRET tidak dikonfigurasi. Event "${eventName}" tidak dikirim.`);
      return false;
    }

    const response = await fetch(`${socketServerUrl}/emit`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${eventSecret}`,
      },
      body: JSON.stringify({ eventName, payload }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gagal mengirim event "${eventName}" ke WebSocket server: ${response.status} ${response.statusText} - ${errorText}`);
      return false;
    }

    return true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Gagal mengirim event WebSocket via HTTP:', message);
    return false;
  }
};
