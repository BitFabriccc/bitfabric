function randomHex(bytes) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function createVerificationToken() {
  return randomHex(32);
}

export function getVerificationExpiryMs() {
  // 1 hour
  return 60 * 60 * 1000;
}

export async function sendVerificationEmail({ env, toEmail, verifyUrl }) {
  const resendKey = env?.RESEND_API_KEY;
  const from = env?.MAIL_FROM;

  if (!resendKey || !from) {
    if (env?.DEBUG_EMAIL === 'true') {
      console.log('[debug] verification email not sent; missing RESEND_API_KEY/MAIL_FROM', { toEmail, verifyUrl });
    }
    return { ok: false, skipped: true, provider: 'none' };
  }

  const subject = 'Verify your BitFabric email';
  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height:1.5">
      <h2 style="margin:0 0 12px">Verify your email</h2>
      <p style="margin:0 0 12px">Click the link below to verify your email address for BitFabric:</p>
      <p style="margin:0 0 12px"><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p style="margin:0;color:#666">If you didn’t request this, you can ignore this email.</p>
    </div>
  `;

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [toEmail],
      subject,
      html
    })
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    console.error('Failed to send verification email', resp.status, text);
    return { ok: false, status: resp.status };
  }

  return { ok: true, provider: 'resend' };
}
