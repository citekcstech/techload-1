import { NextRequest, NextResponse } from 'next/server';

const SAP_URL = 'https://citeks4.citek.vn:49999/sap/bc/ztask/assign?sap-client=999';

export async function POST(req: NextRequest) {
  const body = await req.json();
  console.log('[notify-task] payload:', body);

  try {
    const res = await fetch(SAP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    console.log('[notify-task] SAP status:', res.status, 'body:', text);

    if (!res.ok) {
      return NextResponse.json({ error: text || 'SAP error' }, { status: res.status });
    }
    return NextResponse.json({ ok: true, body: text });
  } catch (err) {
    console.error('[notify-task] fetch error:', err);
    const message = err instanceof Error ? err.message : 'Network error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
