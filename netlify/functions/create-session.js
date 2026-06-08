// Netlify Function: create-session.js
// Creates a Kashier Payment Session and returns the hosted checkout URL.
// The buyer's email is encoded into the order id so the webhook can recover it.
//
// Required Netlify environment variables (Site settings > Environment variables):
//   KASHIER_SECRET       = your Secret key      (Kashier dashboard > Integrations)
//   KASHIER_API_KEY      = your Payment API key (Kashier dashboard > Integrations)
//   KASHIER_MERCHANT_ID  = MID-46401-696
//   KASHIER_MODE         = test        (change to "live" when activated)
//   SITE_URL             = https://ahmedtorkyy.netlify.app

const PRICE = '109';
const CURRENCY = 'EGP';

function b64url(s) {
  return Buffer.from(s, 'utf8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  let email;
  try { ({ email } = JSON.parse(event.body)); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request' }) }; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid email address' }) };
  }

  const SECRET = process.env.KASHIER_SECRET;
  const APIKEY = process.env.KASHIER_API_KEY;
  const MID    = process.env.KASHIER_MERCHANT_ID;
  const MODE   = process.env.KASHIER_MODE || 'test';
  const SITE   = (process.env.SITE_URL || ('https://' + (event.headers.host || ''))).replace(/\/$/, '');
  if (!SECRET || !APIKEY || !MID) {
    console.error('Missing Kashier env vars');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server not configured' }) };
  }

  const apiBase = MODE === 'live' ? 'https://api.kashier.io' : 'https://test-api.kashier.io';
  const order = 'RTN.' + b64url(email) + '.' + Date.now(); // email encoded for the webhook to recover
  const expireAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const payload = {
    expireAt,
    maxFailureAttempts: 3,
    paymentType: 'credit',
    amount: PRICE,
    currency: CURRENCY,
    order,
    merchantId: MID,
    type: 'one-time',
    display: 'ar',
    allowedMethods: 'card,wallet',
    merchantRedirect: SITE + '/success?e=' + b64url(email),
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
      console.error('Kashier session error', res.status, JSON.stringify(data));
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Could not start checkout', detail: (data && data.message) || null }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify({ url }) };
  } catch (err) {
    console.error('create-session error', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Checkout failed' }) };
  }
};
