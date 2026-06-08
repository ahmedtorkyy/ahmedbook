// Netlify Function: verify-payment.js
// Confirms a Kashier payment session was actually PAID before the book is delivered.
// The success page calls this with the session id; the book is sent only if Kashier says "paid".
//
// Required env: KASHIER_SECRET, KASHIER_API_KEY, KASHIER_MODE (test|live)

const PAID_STATUSES = [
  'PAID', 'SUCCESS', 'SUCCESSFUL', 'CAPTURED', 'COMPLETED', 'COMPLETE',
  'APPROVED', 'AUTHORISED', 'AUTHORIZED', 'SETTLED'
];
const FAILED_STATUSES = [
  'FAILED', 'FAILURE', 'DECLINED', 'CANCELLED', 'CANCELED',
  'EXPIRED', 'ERROR', 'REJECTED', 'VOIDED'
];

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ ok: false, paid: false, error: 'Method not allowed' }) };

  let sid;
  try { ({ sid } = JSON.parse(event.body)); }
  catch (e) { return { statusCode: 400, headers, body: JSON.stringify({ ok: true, paid: false, error: 'Invalid request' }) }; }
  if (!sid || !/^[A-Za-z0-9_-]+$/.test(sid)) {
    return { statusCode: 400, headers, body: JSON.stringify({ ok: true, paid: false, error: 'Invalid session id' }) };
  }

  const SECRET = process.env.KASHIER_SECRET;
  const APIKEY = process.env.KASHIER_API_KEY;
  const MODE   = process.env.KASHIER_MODE || 'test';
  if (!SECRET) { console.error('KASHIER_SECRET not set'); return { statusCode: 500, headers, body: JSON.stringify({ ok: false, paid: false, error: 'Server not configured' }) }; }

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

    // Paid when the status says so, OR when the issuer returned a real authorization
    // code (only happens on a genuine successful charge). Never paid on an explicit failure.
    let paid = PAID_STATUSES.indexOf(status) !== -1;
    if (!paid && !isExplicitFail && hasAuth) paid = true;
    if (isExplicitFail) paid = false;

    console.log('verify-payment', sid, 'http=' + res.status, 'status=' + status, 'authCode=' + authCode, 'paid=' + paid);

    // ok:false only when we genuinely could not determine the result (network/HTTP failure),
    // so the success page can fall back to the manual form for a real buyer.
    return { statusCode: 200, headers, body: JSON.stringify({ ok: res.ok, paid, status }) };
  } catch (err) {
    console.error('verify-payment error', err);
    return { statusCode: 200, headers, body: JSON.stringify({ ok: false, paid: false, error: 'verify failed' }) };
  }
};
