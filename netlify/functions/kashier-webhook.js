// Netlify Function: kashier-webhook.js
// Kashier calls this (server-to-server) after a payment. On a successful payment
// it verifies the signature, recovers the buyer's email, and emails both books.
//
// Required Netlify environment variables:
//   KASHIER_API_KEY     = your Payment API key (same one used to create the session)
//   GMAIL_APP_PASSWORD  = your Gmail app password (already set for send-book)
//   SITE_URL            = https://ahmedtorkyy.netlify.app

const crypto = require('crypto');
const nodemailer = require('nodemailer');

const GMAIL_USER = 'ahmedassem.eltorky@gmail.com';

function b64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64').toString('utf8');
}

// Rebuild the signature payload exactly as Kashier documents it
function buildSignaturePayload(data) {
  const keys = [...(data.signatureKeys || [])].sort();
  return keys.map(k => k + '=' + encodeURIComponent(String(data[k]))).join('&');
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 200, body: 'ok' };

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 200, body: 'ignored' }; }
  const evt = body && body.event;
  const data = body && body.data;
  if (!data) return { statusCode: 200, body: 'no data' };

  // 1) Verify signature with the Payment API key
  try {
    const APIKEY = process.env.KASHIER_API_KEY || '';
    const expected = crypto.createHmac('sha256', APIKEY).update(buildSignaturePayload(data)).digest('hex');
    const got = event.headers['x-kashier-signature'] || event.headers['X-Kashier-Signature'] || '';
    if (!APIKEY || !got || got !== expected) {
      console.error('Webhook signature mismatch');
      return { statusCode: 200, body: 'bad signature' };
    }
  } catch (e) {
    console.error('signature error', e);
    return { statusCode: 200, body: 'sig error' };
  }

  // 2) Only act on a successful payment
  if (evt === 'pay' && String(data.status).toUpperCase() === 'SUCCESS') {
    let email = '';
    try {
      const ref = String(data.merchantOrderId || data.orderReference || '');
      const parts = ref.split('.');
      if (parts[0] === 'RTN' && parts[1]) email = b64urlDecode(parts[1]);
    } catch (e) { /* ignore */ }
    if (!email && data.customer && data.customer.email) email = data.customer.email;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.error('Webhook: could not determine buyer email', data.merchantOrderId);
      return { statusCode: 200, body: 'no email' };
    }

    try {
      await sendBooks(email, data.transactionId || '');
      console.log('Books emailed to', email, data.transactionId || '');
    } catch (e) {
      console.error('Webhook send failed', e);
    }
  }

  return { statusCode: 200, body: 'ok' };
};

async function sendBooks(email, txId) {
  const SITE = (process.env.SITE_URL || 'https://ahmedtorkyy.netlify.app').replace(/\/$/, '');
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!pass) throw new Error('GMAIL_APP_PASSWORD not set');

  const [arRes, enRes] = await Promise.all([
    fetch(SITE + '/books/Raise_Them_Normal_Arabic-final.docx'),
    fetch(SITE + '/books/Raise_Them_Normal_Final.docx')
  ]);
  if (!arRes.ok || !enRes.ok) throw new Error('Could not fetch book files');
  const [arBuf, enBuf] = await Promise.all([arRes.arrayBuffer(), enRes.arrayBuffer()]);

  const html = `
<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f0f2f5;margin:0;padding:24px 16px;">
  <div style="max-width:580px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e0e4ea;">
    <div style="background:#0d0d0d;padding:28px 36px;text-align:center;">
      <p style="color:#D4AF37;font-size:1.4rem;font-weight:bold;margin:0 0 4px;">ربّوهم بشكل طبيعي — Raise Them Normal</p>
      <p style="color:rgba(255,255,255,0.7);font-size:.85rem;margin:0;">أحمد تركي · Ahmed Torky</p>
    </div>
    <div style="padding:32px 36px;color:#1a1a2e;font-size:.95rem;line-height:1.8;">
      <p style="font-weight:bold;color:#0d0d0d;">السادة الكرام،</p>
      <p>نشكركم على اقتنائكم كتاب <strong>ربّوهم بشكل طبيعي</strong>. النسختان العربية والإنجليزية مرفقتان بهذا البريد.</p>
      <p>افتح الملفات باستخدام Microsoft Word أو Google Docs — متوافقة تمامًا مع قارئات الشاشة (NVDA, VoiceOver, TalkBack).</p>
      <hr style="border:none;border-top:1px solid #e8eaed;margin:24px 0;" />
      <div style="direction:ltr;text-align:left;color:#3a3a4a;">
        <p style="font-weight:bold;color:#0d0d0d;">Dear Reader,</p>
        <p>Thank you for purchasing <strong>Raise Them Normal</strong>. Both editions are attached to this email.</p>
        <p>For any help: ahmedassem.eltorky@gmail.com</p>
      </div>
    </div>
    <div style="background:#f0f2f5;border-top:1px solid #e0e4ea;padding:16px 36px;text-align:center;font-size:.75rem;color:#8a94a0;">© 2026 Ahmed Torky · ahmedassem.eltorky@gmail.com</div>
  </div>
</body></html>`;

  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: GMAIL_USER, pass } });
  await transporter.sendMail({
    from: '"أحمد تركي | ربّوهم بشكل طبيعي" <' + GMAIL_USER + '>',
    to: email,
    subject: 'ربّوهم بشكل طبيعي — Raise Them Normal | كتابك بالمرفقات',
    html,
    attachments: [
      { filename: 'ربّوهم_بشكل_طبيعي_أحمد_تركي.docx', content: Buffer.from(arBuf), contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      { filename: 'Raise_Them_Normal_Ahmed_Torky.docx', content: Buffer.from(enBuf), contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
    ]
  });
}
