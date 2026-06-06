// Netlify Function: send-book.js
// Sends both book editions via Gmail SMTP using nodemailer
// Required env variables in Netlify:
//   GMAIL_APP_PASSWORD  → 16-char app password from myaccount.google.com

const nodemailer = require('nodemailer');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  // Parse request
  let email, txId;
  try {
    ({ email, txId } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid email address' }) };
  }

  const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
  const GMAIL_USER = 'ahmedassem.eltorky@gmail.com';

  if (!GMAIL_APP_PASSWORD) {
    console.error('GMAIL_APP_PASSWORD not set');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  // Fetch both book files from the live site
  const BASE_URL = 'https://ahmedtorkyy.netlify.app';
  let arabicBuffer, englishBuffer;

  try {
    const [arabicRes, englishRes] = await Promise.all([
      fetch(`${BASE_URL}/books/Raise_Them_Normal_Arabic-final.docx`),
      fetch(`${BASE_URL}/books/Raise_Them_Normal_Final.docx`)
    ]);

    if (!arabicRes.ok || !englishRes.ok) throw new Error('Failed to fetch book files');

    const [arabicAB, englishAB] = await Promise.all([
      arabicRes.arrayBuffer(),
      englishRes.arrayBuffer()
    ]);

    arabicBuffer  = Buffer.from(arabicAB);
    englishBuffer = Buffer.from(englishAB);
  } catch (err) {
    console.error('File fetch error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Could not prepare book files' }) };
  }

  // Email HTML template
  const emailHtml = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font-family: Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 24px 16px; }
  .wrap { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e0e4ea; }
  .header { background: #1A4E7A; padding: 32px 36px; text-align: center; }
  .header-title { color: #D4AF37; font-size: 1.5rem; font-weight: bold; margin: 0 0 4px; }
  .header-sub { color: rgba(255,255,255,0.7); font-size: 0.85rem; margin: 0; }
  .body { padding: 36px; color: #1a1a2e; font-size: 0.95rem; line-height: 1.8; }
  .salutation { font-size: 1rem; font-weight: bold; margin-bottom: 16px; color: #1A4E7A; }
  .paragraph { margin-bottom: 16px; }
  .attachments { background: #f8f9fb; border: 1px solid #e0e4ea; border-radius: 8px; padding: 20px 24px; margin: 24px 0; }
  .attachments-title { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; color: #6b7a8d; margin-bottom: 12px; font-weight: bold; }
  .attachment-item { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid #e8eaed; font-size: 0.88rem; color: #1a1a2e; font-weight: bold; }
  .attachment-item:last-child { border-bottom: none; padding-bottom: 0; }
  .help { background: #fdfaf0; border-right: 3px solid #D4AF37; padding: 14px 18px; border-radius: 6px; font-size: 0.84rem; color: #4a3c00; line-height: 1.7; margin: 24px 0; }
  .divider { border: none; border-top: 1px solid #e8eaed; margin: 28px 0; }
  .en-section { direction: ltr; text-align: left; color: #3a3a4a; font-size: 0.9rem; line-height: 1.8; }
  .signature { margin-top: 24px; font-size: 0.88rem; color: #3a3a4a; }
  .signature-name { font-weight: bold; color: #1A4E7A; font-size: 1rem; }
  .footer { background: #f0f2f5; border-top: 1px solid #e0e4ea; padding: 18px 36px; text-align: center; font-size: 0.75rem; color: #8a94a0; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <p class="header-title">ربيهم عادي — Raise Them Normal</p>
    <p class="header-sub">أحمد تركي · Ahmed Torky</p>
  </div>
  <div class="body">
    <p class="salutation">السادة الكرام،</p>
    <p class="paragraph">نشكركم على اقتنائكم كتاب <strong>ربيهم عادي</strong>. يسعدنا إرسال نسختَي الكتاب مرفقتَين بهذا البريد الإلكتروني، وهما النسخة العربية والنسخة الإنجليزية.</p>
    <p class="paragraph">يمكن فتح الملفات باستخدام Microsoft Word أو Google Docs على أي جهاز، وهي متوافقة تمامًا مع برامج قراءة الشاشة كـ NVDA وVoiceOver وTalkBack.</p>
    <div class="attachments">
      <p class="attachments-title">الملفات المرفقة</p>
      <div class="attachment-item"><span>📘</span><span>ربيهم_عادي_أحمد_تركي.docx — النسخة العربية</span></div>
      <div class="attachment-item"><span>📗</span><span>Raise_Them_Normal_Ahmed_Torky.docx — النسخة الإنجليزية</span></div>
    </div>
    <div class="help">في حال وجود أي استفسار أو مشكلة تقنية، يُرجى التواصل عبر البريد الإلكتروني: ahmedassem.eltorky@gmail.com</div>
    <p class="paragraph">نتمنى لكم قراءة مثمرة ونافعة.</p>
    <div class="signature">
      <p>مع خالص التقدير،</p>
      <p class="signature-name">أحمد تركي</p>
      <p style="color:#6b7a8d;font-size:0.82rem;">مؤلف كتاب ربيهم عادي</p>
    </div>
    <hr class="divider" />
    <div class="en-section">
      <p class="salutation">Dear Reader,</p>
      <p class="paragraph">Thank you for purchasing <strong>Raise Them Normal</strong>. Both editions are attached to this email — the Arabic edition and the English edition.</p>
      <p class="paragraph">Open with Microsoft Word or Google Docs on any device. Fully compatible with NVDA, VoiceOver, and TalkBack.</p>
      <div class="attachments">
        <p class="attachments-title">Attached Files</p>
        <div class="attachment-item"><span>📘</span><span>ربيهم_عادي_أحمد_تركي.docx — Arabic Edition</span></div>
        <div class="attachment-item"><span>📗</span><span>Raise_Them_Normal_Ahmed_Torky.docx — English Edition</span></div>
      </div>
      <div class="help" style="border-right:none;border-left:3px solid #D4AF37;">For any questions: ahmedassem.eltorky@gmail.com</div>
      <p class="paragraph">We hope this book serves you and your family well.</p>
      <div class="signature">
        <p>With warm regards,</p>
        <p class="signature-name">Ahmed Torky</p>
        <p style="color:#6b7a8d;font-size:0.82rem;">Author, Raise Them Normal</p>
      </div>
    </div>
  </div>
  <div class="footer">© 2026 Ahmed Torky · ahmedassem.eltorky@gmail.com</div>
</div>
</body>
</html>`;

  // Send via Gmail SMTP
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD }
    });

    await transporter.sendMail({
      from: `"أحمد تركي | ربيهم عادي" <${GMAIL_USER}>`,
      to: email,
      subject: 'ربيهم عادي — Raise Them Normal | كتابك بالمرفقات',
      html: emailHtml,
      attachments: [
        {
          filename: 'ربيهم_عادي_أحمد_تركي.docx',
          content: arabicBuffer,
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        },
        {
          filename: 'Raise_Them_Normal_Ahmed_Torky.docx',
          content: englishBuffer,
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        }
      ]
    });

    console.log(`Email sent to ${email}${txId ? ` | tx: ${txId}` : ''}`);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };

  } catch (err) {
    console.error('Send error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to send email' }) };
  }
};
