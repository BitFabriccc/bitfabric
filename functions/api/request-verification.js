import { createVerificationToken, getVerificationExpiryMs, sendVerificationEmail } from './_email.js';

function normalizeEmail(email) {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

function normalizePasswordHash(passwordHash) {
  if (typeof passwordHash !== 'string') return '';
  return passwordHash.trim().toLowerCase();
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const email = normalizeEmail(body?.email);
    const passwordHash = normalizePasswordHash(body?.passwordHash);

    if (!email) {
      return new Response(JSON.stringify({ error: 'Missing email' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!passwordHash) {
      return new Response(JSON.stringify({ error: 'Missing passwordHash' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const account = await env.DB.prepare(
      'SELECT email, password_hash, email_verified FROM accounts WHERE email = ? LIMIT 1'
    ).bind(email).first();

    if (!account) {
      return new Response(JSON.stringify({ error: 'Account not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if ((account.password_hash || '').toLowerCase() !== passwordHash) {
      return new Response(JSON.stringify({ error: 'Invalid email or password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (Number(account.email_verified || 0) === 1) {
      return new Response(JSON.stringify({ ok: true, alreadyVerified: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = createVerificationToken();
    const expiresAt = Date.now() + getVerificationExpiryMs();

    await env.DB.prepare(
      'UPDATE accounts SET verification_token = ?, verification_expires_at = ?, updated_at = ? WHERE email = ?'
    ).bind(token, expiresAt, Date.now(), email).run();

    const origin = new URL(request.url).origin;
    const verifyUrl = `${origin}/api/verify-email?token=${encodeURIComponent(token)}`;

    const sendRes = await sendVerificationEmail({ env, toEmail: email, verifyUrl });

    return new Response(JSON.stringify({ ok: true, sent: sendRes.ok, skipped: sendRes.skipped || false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSONifyError(error), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function JSONifyError(error) {
  return JSON.stringify({ error: error?.message || String(error) });
}
