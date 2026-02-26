// Cloudflare Pages Function - Server-side authentication for users (email + password hash)

import { createVerificationToken, getVerificationExpiryMs, sendVerificationEmail } from './_email.js';

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

async function computeAccountId(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return '';
  const suffix = isPremiumEmail(normalizedEmail) ? 'enterprise' : 'free';
  const encoder = new TextEncoder();
  const accountData = encoder.encode(`bitfabric-account-${normalizedEmail}-${suffix}`);
  const accountHashBuffer = await crypto.subtle.digest('SHA-256', accountData);
  const accountHashArray = Array.from(new Uint8Array(accountHashBuffer));
  const accountHash = accountHashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `${accountHash.substr(0, 8)}-${accountHash.substr(8, 4)}-${accountHash.substr(12, 4)}-${accountHash.substr(16, 4)}-${accountHash.substr(20, 12)}`;
}

function randomHex(bytes) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
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

    const isPremium = isPremiumEmail(email);
    const plan = isPremium ? 'enterprise' : 'starter';

    let emailVerified = false;
    let verificationSent = false;

    const accountId = await computeAccountId(email);
    if (!accountId) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Account record: create on first signup, else validate password
    try {
      const existingAccount = await env.DB.prepare(
        'SELECT email, password_hash, plan, account_id, email_verified FROM accounts WHERE email = ? LIMIT 1'
      ).bind(email).first();

      if (!existingAccount) {
        const token = createVerificationToken();
        const expiresAt = Date.now() + getVerificationExpiryMs();

        await env.DB.prepare(
          'INSERT INTO accounts (email, password_hash, plan, account_id, created_at, updated_at, email_verified, verification_token, verification_expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(email, passwordHash, plan, accountId, Date.now(), Date.now(), 0, token, expiresAt).run();

        const origin = new URL(request.url).origin;
        const verifyUrl = `${origin}/api/verify-email?token=${encodeURIComponent(token)}`;
        const sendRes = await sendVerificationEmail({ env, toEmail: email, verifyUrl });
        verificationSent = !!sendRes?.ok;
        emailVerified = false;
      } else {
        emailVerified = Number(existingAccount.email_verified || 0) === 1;

        if ((existingAccount.password_hash || '').toLowerCase() !== passwordHash) {
          return new Response(JSON.stringify({ error: 'Invalid email or password', authenticated: false }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // If whitelisted email is premium, keep plan upgraded
        if (isPremium && existingAccount.plan !== 'enterprise') {
          await env.DB.prepare(
            'UPDATE accounts SET plan = ?, updated_at = ? WHERE email = ?'
          ).bind('enterprise', Date.now(), email).run();
        }
      }
    } catch (dbError) {
      return new Response(JSON.stringify({ error: dbError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // DB-backed default key (create once, then reuse forever)
    let sessionKey = null;
    let defaultKeyRow = null;

    try {
      const existing = await env.DB.prepare(
        'SELECT * FROM api_keys WHERE account_id = ? AND key_id = ? LIMIT 1'
      ).bind(accountId, 'default').first();

      if (existing && existing.value) {
        defaultKeyRow = existing;
        sessionKey = existing.value;
      } else {
        const newKey = randomHex(32); // 64 hex chars
        await env.DB.prepare(
          'INSERT INTO api_keys (account_id, key_id, name, description, value, created_at, permanent) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          accountId,
          'default',
          'Default',
          'Your default API key',
          newKey,
          Date.now(),
          1
        ).run();
        sessionKey = newKey;
        defaultKeyRow = {
          key_id: 'default',
          name: 'Default',
          description: 'Your default API key',
          value: newKey,
          permanent: 1
        };
      }
    } catch (dbError) {
      console.error('Error managing default key:', dbError);
      // Fallback: still return a key, but DB might not persist it
      sessionKey = sessionKey || randomHex(32);
    }

    return new Response(JSON.stringify({
      authenticated: true,
      isPremium,
      email,
      sessionKey,
      accountId: accountId,
      plan: isPremium ? 'enterprise' : 'starter',
      emailVerified,
      verificationSent,
      defaultKey: {
        key_id: 'default',
        name: 'Default',
        description: 'Your default API key',
        value: sessionKey,
        permanent: true
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
