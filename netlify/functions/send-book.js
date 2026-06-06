// Netlify Function: send-book.js
// Sends both book editions as email attachments via Resend
// API key must be set in Netlify: Site settings → Environment variables → RESEND_API_KEY

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Parse email from request
  let email;
  try {
    ({ email } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  // Basic email validation
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid email address' }) };
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not set');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  // Fetch both book files from the live site
  const BASE_URL = 'https://ahmedtorkyy.netlify.app';
  let arabicBase64, englishBase64;

  try {
    const [arabicRes, englishRes] = await Promise.all([
      fetch(`${BASE_URL}/books/Raise_Them_Normal_Arabic.docx`),
      fetch(`${BASE_URL}/books/Raise_Them_Normal_Final.docx`)
    ]);

    if (!arabicRes.ok || !englishRes.ok) throw new Error('Failed to fetch book files');

    const [arabicBuffer, englishBuffer] = await Promise.all([
      arabicRes.arrayBuffer(),
      englishRes.arrayBuffer()
    ]);

    arabicBase64  = Buffer.from(arabicBuffer).toString('base64');
    englishBase64 = Buffer.from(englishBuffer).toString('base64');
  } catch (err) {
    console.error('File fetch error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Could not prepare book files' }) };
  }

  // Build email HTML
  const emailHtml = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font-family: Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 24px 16px; }
  .wrap { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e0e4ea; }

  /* Header */
  .header { background: #1A4E7A; padding: 32px 36px; text-align: center; }
  .header-title { color: #D4AF37; font-size: 1.5rem; font-weight: bold; margin: 0 0 4px; letter-spacing: 0.5px; }
  .header-sub { color: rgba(255,255,255,0.7); font-size: 0.85rem; margin: 0; }

  /* Body */
  .body { padding: 36px; color: #1a1a2e; font-size: 0.95rem; line-height: 1.8; }
  .salutation { font-size: 1rem; font-weight: bold; margin-bottom: 16px; color: #1A4E7A; }
  .paragraph { margin-bottom: 16px; }

  /* Attachments box */
  .attachments { background: #f8f9fb; border: 1px solid #e0e4ea; border-radius: 8px; padding: 20px 24px; margin: 24px 0; }
  .attachments-title { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; color: #6b7a8d; margin-bottom: 12px; font-weight: bold; }
  .attachment-item { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid #e8eaed; font-size: 0.88rem; color: #1a1a2e; font-weight: bold; }
  .attachment-item:last-child { border-bottom: none; padding-bottom: 0; }
  .attachment-icon { font-size: 1.2rem; }

  /* Help note */
  .help { background: #fdfaf0; border-right: 3px solid #D4AF37; padding: 14px 18px; border-radius: 6px; font-size: 0.84rem; color: #4a3c00; line-height: 1.7; margin: 24px 0; }

  /* Divider */
  .divider { border: none; border-top: 1px solid #e8eaed; margin: 28px 0; }

  /* English section */
  .en-section { direction: ltr; text-align: left; color: #3a3a4a; font-size: 0.9rem; line-height: 1.8; }
  .en-section .salutation { color: #1A4E7A; }

  /* Signature */
  .signature { margin-top: 24px; font-size: 0.88rem; color: #3a3a4a; }
  .signature-name { font-weight: bold; color: #1A4E7A; font-size: 1rem; }

  /* Footer */
  .footer { background: #f0f2f5; border-top: 1px solid #e0e4ea; padding: 18px 36px; text-align: center; font-size: 0.75rem; color: #8a94a0; }
</style>
</head>
<body>
<div class="wrap">

  <!-- Header -->
  <div class="header">
    <p class="header-title">ربيهم عادي — Raise Them Normal</p>
    <p class="header-sub">أحمد تركي · Ahmed Torky</p>
  </div>

  <!-- Arabic section -->
  <div class="body">
    <p class="salutation">السادة الكرام،</p>

    <p class="paragraph">
      نشكركم على اقتنائكم كتاب <strong>ربيهم عادي</strong>. يسعدنا إرسال نسختَي الكتاب مرفقتَين بهذا البريد الإلكتروني، وهما النسخة العربية والنسخة الإنجليزية.
    </p>

    <p class="paragraph">
      يمكن فتح الملفات باستخدام Microsoft Word أو Google Docs على أي جهاز، وهي متوافقة تمامًا مع برامج قراءة الشاشة كـ NVDA وVoiceOver وTalkBack.
    </p>

    <!-- Attachments -->
    <div class="attachments">
      <p class="attachments-title">الملفات المرفقة</p>
      <div class="attachment-item">
        <span class="attachment-icon">📘</span>
        <span>ربيهم_عادي_أحمد_تركي.docx — النسخة العربية</span>
      </div>
      <div class="attachment-item">
        <span class="attachment-icon">📗</span>
        <span>Raise_Them_Normal_Ahmed_Torky.docx — النسخة الإنجليزية</span>
      </div>
    </div>

    <div class="help">
      في حال وجود أي استفسار أو مشكلة تقنية، يُرجى التواصل عبر البريد الإلكتروني:
      ahmedassem.eltorky@gmail.com
    </div>

    <p class="paragraph">نتمنى لكم قراءة مثمرة ونافعة.</p>

    <div class="signature">
      <p>مع خالص التقدير،</p>
      <p class="signature-name">أحمد تركي</p>
      <p style="color:#6b7a8d;font-size:0.82rem;">مؤلف كتاب ربيهم عادي</p>
    </div>

    <hr class="divider" />

    <!-- English section -->
    <div class="en-section">
      <p class="salutation">Dear Reader,</p>

      <p class="paragraph">
        Thank you for purchasing <strong>Raise Them Normal</strong>. Please find both editions of the book attached to this email — the Arabic edition and the English edition.
      </p>

      <p class="paragraph">
        The files can be opened with Microsoft Word or Google Docs on any device, and are fully compatible with screen readers including NVDA, VoiceOver, and TalkBack.
      </p>

      <!-- Attachments (repeated for English readers) -->
      <div class="attachments">
        <p class="attachments-title">Attached Files</p>
        <div class="attachment-item">
          <span class="attachment-icon">📘</span>
          <span>ربيهم_عادي_أحمد_تركي.docx — Arabic Edition</span>
        </div>
        <div class="attachment-item">
          <span class="attachment-icon">📗</span>
          <span>Raise_Them_Normal_Ahmed_Torky.docx — English Edition</span>
        </div>
      </div>

      <div class="help" style="border-right:none; border-left:3px solid #D4AF37;">
        For any questions or technical issues, please contact us at:
        ahmedassem.eltorky@gmail.com
      </div>

      <p class="paragraph">We hope this book serves you and your family well.</p>

      <div class="signature">
        <p>With warm regards,</p>
        <p class="signature-name">Ahmed Torky</p>
        <p style="color:#6b7a8d;font-size:0.82rem;">Author, Raise Them Normal</p>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    © 2026 Ahmed Torky · ahmedassem.eltorky@gmail.com
  </div>

</div>
</body>
</html>`;

  // Send via Resend
  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Ahmed Torky | ربيهم عادي <onboarding@resend.dev>',
        to: [email],
        subject: 'ربيهم عادي — Raise Them Normal | كتابك بالمرفقات',
        html: emailHtml,
        attachments: [
          {
            filename: 'ربيهم_عادي_أحمد_تركي.docx',
            content: arabicBase64
          },
          {
            filename: 'Raise_Them_Normal_Ahmed_Torky.docx',
            content: englishBase64
          }
        ]
      })
    });

    if (!resendRes.ok) {
      const err = await resendRes.json();
      console.error('Resend error:', err);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to send email' }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };

  } catch (err) {
    console.error('Send error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Unexpected error' }) };
  }
};
