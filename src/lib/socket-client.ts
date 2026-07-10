export async function postToSocket(endpoint: string, body: any) {
  try {
    const socketUrl = process.env.SOCKET_URL || process.env.NEXT_PUBLIC_SOCKET_URL || (process.env.NODE_ENV !== 'production' ? 'http://localhost:4000' : '');
    if (!socketUrl) {
      try { console.warn('postToSocket skipped: SOCKET_URL/NEXT_PUBLIC_SOCKET_URL not set'); } catch {}
      return null;
    }
    const url = socketUrl.replace(/\/$/, '') + (endpoint.startsWith('/') ? endpoint : '/' + endpoint);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (process.env.SOCKET_SECRET) headers['x-socket-secret'] = process.env.SOCKET_SECRET;
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) {
      try {
        const text = await res.text();
        console.warn('postToSocket non-OK response', { url, status: res.status, text });
      } catch {
        console.warn('postToSocket non-OK response', { url, status: res.status });
      }
    }
    return res;
  } catch (e) {
    // surface a warning so server logs include socket POST failures
    try { console.warn('postToSocket failed', e); } catch {}
    return null;
  }
}
