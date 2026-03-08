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

export async function onRequestGet(context) {
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
    const users = await env.DB.prepare(`
      SELECT
        a.account_id,
        a.email,
        a.plan,
        a.created_at,
        a.deleted_at,
        COALESCE(k.key_count, 0) AS key_count,
        COALESCE(app.app_count, 0) AS app_count
      FROM accounts a
      LEFT JOIN (
        SELECT account_id, COUNT(*) AS key_count
        FROM api_keys
        WHERE deleted_at IS NULL
        GROUP BY account_id
      ) k ON k.account_id = a.account_id
      LEFT JOIN (
        SELECT account_id, COUNT(*) AS app_count
        FROM app_ids
        GROUP BY account_id
      ) app ON app.account_id = a.account_id
      ORDER BY a.created_at DESC
    `).all();

    return new Response(JSON.stringify({ users: users.results || [] }), {
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
  const url = new URL(request.url);
  const passwordHash = request.headers.get('x-bitfabric-password-hash');

  try {
    const body = await request.json();
    const adminEmail = body.adminEmail || url.searchParams.get('email');
    const action = body.action;
    const targetEmail = body.targetEmail?.toLowerCase();

    const auth = await requireAdminAuth({ env, email: adminEmail, passwordHash });
    if (!auth.ok) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

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
    } else if (action === 'delete') {
      const account = await env.DB.prepare(
        'SELECT account_id, deleted_at FROM accounts WHERE email = ?'
      ).bind(targetEmail).first();

      if (!account) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (!account.deleted_at) {
        return new Response(JSON.stringify({ error: 'User must be hidden before deletion' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      await env.DB.prepare('DELETE FROM api_keys WHERE account_id = ?').bind(account.account_id).run();
      await env.DB.prepare('DELETE FROM app_ids WHERE account_id = ?').bind(account.account_id).run();
      await env.DB.prepare('DELETE FROM user_relays WHERE user_email = ?').bind(targetEmail).run();
      await env.DB.prepare('DELETE FROM accounts WHERE email = ?').bind(targetEmail).run();

      return new Response(JSON.stringify({ success: true, message: `User ${targetEmail} permanently deleted` }), {
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

      const count = deleted.meta.changes || 0;
      return new Response(JSON.stringify({ 
        success: true, 
        message: `Revoked ${count} key(s) for ${targetEmail}` 
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
