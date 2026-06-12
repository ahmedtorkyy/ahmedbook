// Cloudflare Pages Function: /api/verify-payment
// Confirms a Kashier payment session was actually PAID before the download is shown.
// Env vars: KASHIER_SECRET, KASHIER_API_KEY, KASHIER_MODE (test|live)

const PAID_STATUSES = [
  'PAID', 'SUCCESS', 'SUCCESSFUL', 'CAPTURED', 'COMPLETED', 'COMPLETE',
  'APPROVED', 'AUTHORISED', 'AUTHORIZED', 'SETTLED'
];
const FAILED_STATUSES = [
  'FAILED', 'FAILURE', 'DECLINED', 'CANCELLED', 'CANCELED',
  'EXPIRED', 'ERROR', 'REJECTED', 'VOIDED'
];

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

export async function onRequestOptions() {
  return new Response('', { status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' } });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let sid;
  try { ({ sid } = await request.json()); }
  catch (e) { return json({ ok: true, paid: false, error: 'Invalid request' }, 400); }
  if (!sid || !/^[A-Za-z0-9_-]+$/.test(sid)) {
    return json({ ok: true, paid: false, error: 'Invalid session id' }, 400);
  }

  const SECRET = env.KASHIER_SECRET;
  const APIKEY = env.KASHIER_API_KEY;
  const MODE   = env.KASHIER_MODE || 'test';
  if (!SECRET) return json({ ok: false, paid: false, error: 'Server not configured' }, 500);

  const apiBase = MODE === 'live' ? 'https://api.kashier.io' : 'https://test-api.kashier.io';

  try {
    const res = await fetch(apiBase + '/v3/payment/sessions/' + encodeURIComponent(sid) + '/payment', {
      method: 'GET',
      headers: { 'Authorization': SECRET, 'api-key': APIKEY || '', 'Content-Type': 'application/json' }
    });
    const data = await res.json().catch(() => ({}));
    const d = (data && data.data) ? data.data : data;
    const status = String(
      (d && (d.status || d.paymentStatus)) ||
      (d && d.payment && d.payment.status) ||
      (data && data.status) || ''
    ).toUpperCase();

    const authCode = String((d && d.issuerAuthorizationCode) || '').toUpperCase();
    const hasAuth = authCode && authCode !== 'NA';
    const isExplicitFail = FAILED_STATUSES.indexOf(status) !== -1;

    let paid = PAID_STATUSES.indexOf(status) !== -1;
    if (!paid && !isExplicitFail && hasAuth) paid = true;
    if (isExplicitFail) paid = false;

    return json({ ok: res.ok, paid, status }, 200);
  } catch (err) {
    return json({ ok: false, paid: false, error: 'verify failed' }, 200);
  }
}
