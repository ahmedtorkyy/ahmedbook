// Netlify Function: send-book.js
// Emails both book editions. The email language follows the buyer's website language (lang: 'ar' | 'en').
// Required env: GMAIL_APP_PASSWORD

const nodemailer = require('nodemailer');

const GMAIL_USER = 'ahmedassem.eltorky@gmail.com';
const BASE_URL = 'https://ahmedtorkyy.netlify.app';

function buildHtml(isAr){
  var header = `
    <div style="background:#0d0d0d;padding:28px 36px;text-align:center;">
      <table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto 16px;"><tr>
        <td style="padding:0 7px;"><img src="${BASE_URL}/books/cover_arabic.png" width="100" alt="" style="display:block;border-radius:7px;box-shadow:0 8px 22px rgba(0,0,0,.5);"></td>
        <td style="padding:0 7px;"><img src="${BASE_URL}/books/cover_english.png" width="100" alt="" style="display:block;border-radius:7px;box-shadow:0 8px 22px rgba(0,0,0,.5);"></td>
      </tr></table>
      <p style="color:#D4AF37;font-size:1.4rem;font-weight:bold;margin:0 0 4px;">${isAr ? 'ربّوهم بشكل طبيعي' : 'Raise Them Normal'}</p>
      <p style="color:rgba(255,255,255,0.7);font-size:.85rem;margin:0;">${isAr ? 'أحمد تركي' : 'Ahmed Torky'}</p>
    </div>`;

  var bodyAr = `
    <div style="padding:32px 36px;color:#1a1a2e;font-size:.95rem;line-height:1.9;" dir="rtl">
      <p style="font-weight:bold;color:#0d0d0d;">السادة الكرام،</p>
      <p>نشكركم على اقتنائكم كتاب <strong>ربّوهم بشكل طبيعي</strong>. النسختان العربية والإنجليزية مرفقتان بهذا البريد.</p>
      <p>افتح الملفات باستخدام Microsoft Word أو Google Docs على أي جهاز — وهي متوافقة تمامًا مع قارئات الشاشة (NVDA, VoiceOver, TalkBack).</p>
      <div style="background:#f8f9fb;border:1px solid #e0e4ea;border-radius:8px;padding:18px 22px;margin:22px 0;">
        <div style="padding:8px 0;font-weight:bold;font-size:.88rem;">📘 ربّوهم_بشكل_طبيعي_أحمد_تركي.docx — النسخة العربية</div>
        <div style="padding:8px 0;font-weight:bold;font-size:.88rem;border-top:1px solid #e8eaed;">📗 Raise_Them_Normal_Ahmed_Torky.docx — النسخة الإنجليزية</div>
      </div>
      <p>لأي استفسار أو مشكلة تقنية: <a href="mailto:${GMAIL_USER}" style="color:#0d0d0d;font-weight:bold;">${GMAIL_USER}</a></p>
      <p style="margin-top:22px;">نتمنى لكم قراءة مثمرة ونافعة 🤍</p>
      <p style="font-weight:bold;color:#0d0d0d;margin-top:18px;">أحمد تركي</p>
      <p style="color:#6b7a8d;font-size:.82rem;">مؤلف كتاب ربّوهم بشكل طبيعي</p>
    </div>`;

  var bodyEn = `
    <div style="padding:32px 36px;color:#1a1a2e;font-size:.95rem;line-height:1.8;" dir="ltr">
      <p style="font-weight:bold;color:#0d0d0d;">Dear Reader,</p>
      <p>Thank you for purchasing <strong>Raise Them Normal</strong>. Both editions — Arabic and English — are attached to this email.</p>
      <p>Open the files with Microsoft Word or Google Docs on any device. Fully compatible with screen readers (NVDA, VoiceOver, TalkBack).</p>
      <div style="background:#f8f9fb;border:1px solid #e0e4ea;border-radius:8px;padding:18px 22px;margin:22px 0;">
        <div style="padding:8px 0;font-weight:bold;font-size:.88rem;">📗 Raise_Them_Normal_Ahmed_Torky.docx — English edition</div>
        <div style="padding:8px 0;font-weight:bold;font-size:.88rem;border-top:1px solid #e8eaed;">📘 ربّوهم_بشكل_طبيعي_أحمد_تركي.docx — Arabic edition</div>
      </div>
      <p>For any question or technical issue: <a href="mailto:${GMAIL_USER}" style="color:#0d0d0d;font-weight:bold;">${GMAIL_USER}</a></p>
      <p style="margin-top:22px;">We hope this book serves you and your family well 🤍</p>
      <p style="font-weight:bold;color:#0d0d0d;margin-top:18px;">Ahmed Torky</p>
      <p style="color:#6b7a8d;font-size:.82rem;">Author, Raise Them Normal</p>
    </div>`;

  return `<!DOCTYPE html><html dir="${isAr ? 'rtl' : 'ltr'}" lang="${isAr ? 'ar' : 'en'}"><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f0f2f5;margin:0;padding:24px 16px;">
  <div style="max-width:580px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e0e4ea;">
    ${header}
    ${isAr ? bodyAr : bodyEn}
    <div style="background:#f0f2f5;border-top:1px solid #e0e4ea;padding:16px 36px;text-align:center;font-size:.75rem;color:#8a94a0;">© 2026 Ahmed Torky · ${GMAIL_USER}</div>
  </div>
</body></html>`;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  let email, lang, txId;
  try { ({ email, lang, txId } = JSON.parse(event.body)); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request' }) }; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid email address' }) };
  }

  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!pass) { console.error('GMAIL_APP_PASSWORD not set'); return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error' }) }; }

  const isAr = (lang !== 'en'); // default Arabic

  let arabicBuffer, englishBuffer;
  try {
    const [ar, en] = await Promise.all([
      fetch(`${BASE_URL}/books/Raise_Them_Normal_Arabic-final.docx`),
      fetch(`${BASE_URL}/books/Raise_Them_Normal_Final.docx`)
    ]);
    if (!ar.ok || !en.ok) throw new Error('Failed to fetch book files');
    const [arAB, enAB] = await Promise.all([ar.arrayBuffer(), en.arrayBuffer()]);
    arabicBuffer = Buffer.from(arAB);
    englishBuffer = Buffer.from(enAB);
  } catch (err) {
    console.error('File fetch error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Could not prepare book files' }) };
  }

  try {
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: GMAIL_USER, pass } });
    await transporter.sendMail({
      from: `"${isAr ? 'أحمد تركي | ربّوهم بشكل طبيعي' : 'Ahmed Torky | Raise Them Normal'}" <${GMAIL_USER}>`,
      to: email,
      subject: isAr ? 'ربّوهم بشكل طبيعي — كتابك بالمرفقات' : 'Raise Them Normal — Your book is attached',
      html: buildHtml(isAr),
      attachments: [
        { filename: 'ربّوهم_بشكل_طبيعي_أحمد_تركي.docx', content: arabicBuffer, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
        { filename: 'Raise_Them_Normal_Ahmed_Torky.docx', content: englishBuffer, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
      ]
    });
    console.log(`Email (${isAr ? 'ar' : 'en'}) sent to ${email}${txId ? ' | tx: ' + txId : ''}`);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error('Send error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to send email' }) };
  }
};
