// Cloudflare Pages Function - API endpoint for managing keys

function normalizeEmail(email) {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

function normalizePasswordHash(passwordHash) {
  if (typeof passwordHash !== 'string') return '';
  return passwordHash.trim().toLowerCase();
}

function isPremiumEmail(email) {
  // Server-side premium whitelist (source of truth)
  const PREMIUM_WHITELIST = [
    'draeder@gmail.com',
    'daniel@bitfabric.cc'
  ];
  return PREMIUM_WHITELIST.includes(email);
}

function getMaxKeysForPlan({ plan }) {
  // Free: default only (1 total)
  // Premium: default + 5 custom (6 total)
  if (plan === 'premium') return 6;
  return 1;
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

async function requireAccountAuth({ env, email, passwordHash }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPasswordHash = normalizePasswordHash(passwordHash);
  if (!normalizedEmail) return { ok: false, status: 400, error: 'Missing email' };
  if (!normalizedPasswordHash) return { ok: false, status: 400, error: 'Missing passwordHash' };

  const account = await env.DB.prepare(
    'SELECT email, password_hash, plan, account_id FROM accounts WHERE email = ? LIMIT 1'
  ).bind(normalizedEmail).first();

  if (!account) {
    return { ok: false, status: 401, error: 'Account not found' };
  }

  if ((account.password_hash || '').toLowerCase() !== normalizedPasswordHash) {
    return { ok: false, status: 401, error: 'Invalid email or password' };
  }

  // Keep premium accounts premium if whitelisted
  const shouldBePremium = isPremiumEmail(normalizedEmail);
  if (shouldBePremium && account.plan !== 'enterprise') {
    await env.DB.prepare('UPDATE accounts SET plan = ?, updated_at = ? WHERE email = ?')
      .bind('enterprise', Date.now(), normalizedEmail)
      .run();
    account.plan = 'enterprise';
  }

  return { ok: true, email: normalizedEmail, accountId: account.account_id, plan: account.plan };
}

function randomHex(bytes) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const email = url.searchParams.get('email');

  // Avoid putting passwordHash in URL: accept it via header for GET
  const passwordHash = request.headers.get('x-bitfabric-password-hash');

  const auth = await requireAccountAuth({ env, email, passwordHash });
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Fetch keys from D1 by account_id only (immutable per account)
    const results = await env.DB.prepare(
      'SELECT account_id, key_id, name, description, value, created_at, permanent FROM api_keys WHERE account_id = ?'
    ).bind(auth.accountId).all();

    return new Response(JSON.stringify({ keys: results.results || [] }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json();
  const { email, passwordHash, keyName, keyDescription } = body;

  if (!keyName) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const auth = await requireAccountAuth({ env, email, passwordHash });
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Enforce plan limits server-side
  const maxKeys = getMaxKeysForPlan({ plan: auth.plan });
  try {
    const countRow = await env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM api_keys WHERE account_id = ?'
    ).bind(auth.accountId).first();
    const currentCount = Number(countRow?.cnt || 0);

    if (currentCount >= maxKeys) {
      return new Response(JSON.stringify({
        error: auth.plan === 'premium'
          ? 'Key limit reached (premium: 5 custom + default)'
          : 'Key limit reached (free: default only)'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const newKeyId = crypto.randomUUID();
    const newKeyValue = randomHex(32); // 64 hex chars

    // Insert key into D1 (server-generated value)
    await env.DB.prepare(
      'INSERT INTO api_keys (account_id, key_id, name, description, value, created_at, permanent) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      auth.accountId,
      newKeyId,
      keyName,
      keyDescription || '',
      newKeyValue,
      Date.now(),
      0
    ).run();

    return new Response(JSON.stringify({
      success: true,
      key: {
        key_id: newKeyId,
        name: keyName,
        description: keyDescription || '',
        value: newKeyValue,
        created_at: Date.now(),
        permanent: false
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const body = await request.json();
  const { email, passwordHash, keyId } = body;

  if (!keyId || keyId === 'default') {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const auth = await requireAccountAuth({ env, email, passwordHash });
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    await env.DB.prepare(
      'DELETE FROM api_keys WHERE account_id = ? AND key_id = ?'
    ).bind(auth.accountId, keyId).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
