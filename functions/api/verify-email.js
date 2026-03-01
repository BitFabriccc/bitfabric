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

async function verifyWithToken(env, email, token) {
  const row = await env.DB.prepare(
    'SELECT token_hash, expires_at, verified_at FROM email_verifications WHERE email = ? LIMIT 1'
  ).bind(email).first();

  if (!row) return { ok: false, status: 404, error: 'No verification request found' };
  if (row.verified_at) return { ok: true, status: 200, alreadyVerified: true };

  const now = Date.now();
  if (row.expires_at && now > Number(row.expires_at)) {
    return { ok: false, status: 410, error: 'Verification token expired' };
  }

  const tokenHash = await sha256Hex(token);
  if (tokenHash !== row.token_hash) {
    return { ok: false, status: 401, error: 'Invalid verification token' };
  }

  await env.DB.prepare(
    'UPDATE email_verifications SET verified_at = ?, token_hash = token_hash WHERE email = ?'
  ).bind(now, email).run();

  return { ok: true, status: 200, verifiedAt: now };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env?.DB) return json({ error: 'Missing DB binding' }, 500);

  const url = new URL(request.url);
  const email = normalizeEmail(url.searchParams.get('email'));
  const token = String(url.searchParams.get('token') || '').trim();

  if (!email || !token) return json({ error: 'Missing email or token' }, 400);

  try {
    const res = await verifyWithToken(env, email, token);
    if (!res.ok) return json({ verified: false, error: res.error }, res.status);
    return json({ verified: true, alreadyVerified: !!res.alreadyVerified, verifiedAt: res.verifiedAt || null });
  } catch (err) {
    return json({ error: err?.message || String(err) }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env?.DB) return json({ error: 'Missing DB binding' }, 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const email = normalizeEmail(body?.email);
  const token = String(body?.token || '').trim();
  if (!email || !token) return json({ error: 'Missing email or token' }, 400);

  try {
    const res = await verifyWithToken(env, email, token);
    if (!res.ok) return json({ verified: false, error: res.error }, res.status);
    return json({ verified: true, alreadyVerified: !!res.alreadyVerified, verifiedAt: res.verifiedAt || null });
  } catch (err) {
    return json({ error: err?.message || String(err) }, 500);
  }
}
