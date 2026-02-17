function normalizeToken(token) {
  if (typeof token !== 'string') return '';
  return token.trim();
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const token = normalizeToken(url.searchParams.get('token'));

  if (!token) {
    return new Response('Missing token', { status: 400 });
  }

  const account = await env.DB.prepare(
    'SELECT email, email_verified, verification_expires_at FROM accounts WHERE verification_token = ? LIMIT 1'
  ).bind(token).first();

  if (!account) {
    return new Response('Invalid token', { status: 400 });
  }

  if (Number(account.email_verified || 0) === 1) {
    return new Response('Email already verified', { status: 200 });
  }

  const expiresAt = Number(account.verification_expires_at || 0);
  if (expiresAt && Date.now() > expiresAt) {
    return new Response('Token expired', { status: 400 });
  }

  await env.DB.prepare(
    'UPDATE accounts SET email_verified = 1, verification_token = NULL, verification_expires_at = NULL, updated_at = ? WHERE verification_token = ?'
  ).bind(Date.now(), token).run();

  return new Response('Email verified. You can close this tab.', { status: 200 });
}
