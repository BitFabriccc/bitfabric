// Admin endpoint for managing users

function isSuperAdmin(email) {
  const SUPER_ADMINS = [
    'draeder@gmail.com',
    'danraeder@gmail.com',
    'daniel@bitfabric.cc'
  ];
  return SUPER_ADMINS.includes(email?.toLowerCase?.());
}

async function requireAdminAuth({ env, email, passwordHash }) {
  if (!email || !passwordHash) {
    return { ok: false, status: 400, error: 'Missing email or password' };
  }

  try {
    const result = await env.DB.prepare(
      'SELECT account_id, password_hash, email FROM accounts WHERE email = ? AND deleted_at IS NULL'
    ).bind(email.toLowerCase()).first();

    if (!result) {
      return { ok: false, status: 401, error: 'Invalid email or password' };
    }

    const storedHash = result.password_hash.toLowerCase();
    if (passwordHash.toLowerCase() !== storedHash) {
      return { ok: false, status: 401, error: 'Invalid email or password' };
    }

    if (!isSuperAdmin(email)) {
      return { ok: false, status: 403, error: 'Super admin access required' };
    }

    return { ok: true, email, accountId: result.account_id };
  } catch (error) {
    return { ok: false, status: 500, error: 'Auth error: ' + error.message };
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const email = url.searchParams.get('email');
  const passwordHash = request.headers.get('x-bitfabric-password-hash');

  const auth = await requireAdminAuth({ env, email, passwordHash });
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const action = body.action;
    const targetEmail = body.targetEmail?.toLowerCase();

    if (!action || !targetEmail) {
      return new Response(JSON.stringify({ error: 'Missing action or targetEmail' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (action === 'ban') {
      // Soft delete the user
      await env.DB.prepare(
        'UPDATE accounts SET deleted_at = CURRENT_TIMESTAMP WHERE email = ?'
      ).bind(targetEmail).run();
      return new Response(JSON.stringify({ success: true, message: `User ${targetEmail} banned` }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else if (action === 'restore') {
      // Restore the user
      await env.DB.prepare(
        'UPDATE accounts SET deleted_at = NULL WHERE email = ?'
      ).bind(targetEmail).run();
      return new Response(JSON.stringify({ success: true, message: `User ${targetEmail} restored` }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else if (action === 'revoke-keys') {
      // Delete all keys for a user
      const userResult = await env.DB.prepare(
        'SELECT account_id FROM accounts WHERE email = ?'
      ).bind(targetEmail).first();

      if (!userResult) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const deleted = await env.DB.prepare(
        'UPDATE api_keys SET deleted_at = CURRENT_TIMESTAMP WHERE account_id = ? AND deleted_at IS NULL'
      ).bind(userResult.account_id).run();

      return new Response(JSON.stringify({ 
        success: true, 
        message: `Revoked ${deleted.meta.duration} keys for ${targetEmail}` 
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ error: 'Unknown action' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Admin user action error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
