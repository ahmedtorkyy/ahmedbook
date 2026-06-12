// Cloudflare Pages Function: /api/create-session
// Creates a Kashier Payment Session and returns the hosted checkout URL + session id.
// Env vars (Cloudflare Pages > Settings > Environment variables):
//   KASHIER_SECRET, KASHIER_API_KEY, KASHIER_MERCHANT_ID, KASHIER_MODE (test|live), SITE_URL

const PRICE = '109';
const CURRENCY = 'EGP';

function b64url(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

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

  let email, lang;
  try { ({ email, lang } = await request.json()); }
  catch (e) { return json({ error: 'Invalid request' }, 400); }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Invalid email address' }, 400);
  }

  const SECRET = env.KASHIER_SECRET;
  const APIKEY = env.KASHIER_API_KEY;
  const MID    = env.KASHIER_MERCHANT_ID;
  const MODE   = env.KASHIER_MODE || 'test';
  const SITE   = (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
  if (!SECRET || !APIKEY || !MID) return json({ error: 'Server not configured' }, 500);

  const apiBase = MODE === 'live' ? 'https://api.kashier.io' : 'https://test-api.kashier.io';
  const order = 'RTN.' + b64url(email) + '.' + Date.now();
  const expireAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const payload = {
    expireAt,
    maxFailureAttempts: 3,
    failureRedirect: true,
    paymentType: 'credit',
    amount: PRICE,
    currency: CURRENCY,
    order,
    merchantId: MID,
    type: 'one-time',
    display: (lang === 'en' ? 'en' : 'ar'),
    allowedMethods: 'card,wallet',
    merchantRedirect: SITE + '/success',
    redirectMethod: 'get',
    customer: { email: email, reference: order },
    description: 'Raise Them Normal / Rabbohom Beshakl Tabiei - both editions'
  };

  try {
    const res = await fetch(apiBase + '/v3/payment/sessions', {
      method: 'POST',
      headers: { 'Authorization': SECRET, 'api-key': APIKEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    const url = data.sessionUrl || (data.paymentParams && data.paymentParams.sessionUrl);
    if (!res.ok || !url) {
      return json({ error: 'Could not start checkout', detail: (data && data.message) || null }, 502);
    }
    const sid = (data && (data._id || data.sessionId)) || (url && (url.match(/\/session\/([^/?#]+)/) || [])[1]) || '';
    return json({ url, sid }, 200);
  } catch (err) {
    return json({ error: 'Checkout failed' }, 500);
  }
}
