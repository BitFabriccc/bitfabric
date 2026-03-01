function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function sha256Hex(text) {
  const enc = new TextEncoder();
  const buf = enc.encode(String(text || ''));
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomHex(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sendViaMailChannels({ fromEmail, fromName, toEmail, subject, text }) {
  const resp = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: toEmail }] }],
      from: { email: fromEmail, name: fromName || 'BitFabric' },
      subject,
      content: [{ type: 'text/plain', value: text }]
    })
  });

  if (!resp.ok) {
    const details = await resp.text().catch(() => '');
    throw new Error(`Email send failed (${resp.status}): ${details || 'unknown error'}`);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env?.DB) {
    return json({ error: 'Missing DB binding' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const email = normalizeEmail(body?.email);
  if (!email) return json({ error: 'Missing email' }, 400);

  const now = Date.now();
  const ttlMs = Number(env.VERIFICATION_TTL_MS || 15 * 60 * 1000);
  const cooldownMs = Number(env.VERIFICATION_COOLDOWN_MS || 60 * 1000);

  // Simple per-email cooldown
  try {
    const row = await env.DB.prepare(
      'SELECT last_sent_at, send_count, verified_at FROM email_verifications WHERE email = ? LIMIT 1'
    ).bind(email).first();

    if (row?.verified_at) {
      return json({ sent: false, error: 'Email already verified' }, 409);
    }

    if (row?.last_sent_at && now - Number(row.last_sent_at) < cooldownMs) {
      return json({ sent: false, error: 'Please wait before requesting another verification email' }, 429);
    }
  } catch (err) {
    return json({ error: `DB error: ${err?.message || err}` }, 500);
  }

  const token = randomHex(32);
  const tokenHash = await sha256Hex(token);
  const expiresAt = now + ttlMs;

  try {
    await env.DB.prepare(
      `INSERT INTO email_verifications (email, token_hash, created_at, last_sent_at, expires_at, verified_at, send_count)
       VALUES (?, ?, ?, ?, ?, NULL, 1)
       ON CONFLICT(email) DO UPDATE SET
         token_hash = excluded.token_hash,
         last_sent_at = excluded.last_sent_at,
         expires_at = excluded.expires_at,
         verified_at = NULL,
         send_count = email_verifications.send_count + 1`
    ).bind(email, tokenHash, now, now, expiresAt).run();
  } catch (err) {
    return json({ error: `DB error: ${err?.message || err}` }, 500);
  }

  const origin = env.PUBLIC_ORIGIN || request.headers.get('origin') || 'https://bitfabric.cc';
  const verifyUrl = `${origin.replace(/\/$/, '')}/api/verify-email?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;

  const emailMode = String(env.EMAIL_MODE || 'mailchannels');
  if (emailMode === 'log') {
    console.log(`[verification] ${email} verifyUrl=${verifyUrl}`);
  } else {
    const fromEmail = env.MAIL_FROM;
    if (!fromEmail) {
      return json({ error: 'Missing MAIL_FROM env var (or set EMAIL_MODE=log)' }, 500);
    }

    try {
      await sendViaMailChannels({
        fromEmail,
        fromName: env.MAIL_FROM_NAME || 'BitFabric',
        toEmail: email,
        subject: 'Verify your email',
        text: `Verify your email by opening:\n\n${verifyUrl}\n\nThis link expires in ${Math.round(ttlMs / 60000)} minutes.`
      });
    } catch (err) {
      return json({ sent: false, error: err?.message || String(err) }, 502);
    }
  }

  const debug = String(env.VERIFICATION_DEBUG || '').toLowerCase() === 'true';
  return json({
    sent: true,
    expiresAt,
    ...(debug ? { debugToken: token, debugVerifyUrl: verifyUrl } : {})
  });
}
