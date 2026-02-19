// Cloudflare Pages Function - Validate an API key exists in D1 for the given email

function normalizeEmail(email) {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

function isPremiumEmail(email) {
  // Server-side premium whitelist (source of truth)
  const PREMIUM_WHITELIST = [
    'draeder@gmail.com',
    'daniel@bitfabric.cc'
  ];
  return PREMIUM_WHITELIST.includes(email);
}

async function computeAccountId(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return '';

  const suffix = isPremiumEmail(normalizedEmail) ? 'premium' : 'free';
  const encoder = new TextEncoder();
  const accountData = encoder.encode(`bitfabric-account-${normalizedEmail}-${suffix}`);
  const accountHashBuffer = await crypto.subtle.digest('SHA-256', accountData);
  const accountHashArray = Array.from(new Uint8Array(accountHashBuffer));
  const accountHash = accountHashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `${accountHash.substr(0, 8)}-${accountHash.substr(8, 4)}-${accountHash.substr(12, 4)}-${accountHash.substr(16, 4)}-${accountHash.substr(20, 12)}`;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const email = normalizeEmail(body?.email);
    const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';

    let row;
    if (email) {
      const accountId = await computeAccountId(email);
      if (!accountId) {
        return new Response(JSON.stringify({ error: 'Invalid email', valid: false }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      row = await env.DB.prepare(
        'SELECT key_id, name, description, value, created_at, permanent FROM api_keys WHERE account_id = ? AND value = ? LIMIT 1'
      ).bind(accountId, apiKey).first();
    } else {
      // Global lookup by value (for guests with manual keys)
      row = await env.DB.prepare(
        'SELECT key_id, name, description, value, created_at, permanent FROM api_keys WHERE value = ? LIMIT 1'
      ).bind(apiKey).first();
    }

    if (!row) {
      return new Response(JSON.stringify({ valid: false, error: 'API key not found' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      valid: true,
      email: email || null,
      key: row
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ valid: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
