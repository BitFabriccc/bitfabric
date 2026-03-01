// Admin-only endpoint to clean up duplicate default keys
// Keeps the oldest key per account and deletes newer duplicates

function isSuperAdmin(email) {
  const SUPER_ADMIN_EMAILS = ['draeder@gmail.com', 'daniel@bitfabric.cc'];
  return SUPER_ADMIN_EMAILS.includes(email?.trim().toLowerCase());
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json();
  const { email, passwordHash } = body;

  if (!isSuperAdmin(email)) {
    return new Response(JSON.stringify({ error: 'Unauthorized - admin only' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Verify admin credentials
  const account = await env.DB.prepare(
    'SELECT password_hash FROM accounts WHERE email = ? LIMIT 1'
  ).bind(email).first();

  if (!account || (account.password_hash || '').toLowerCase() !== passwordHash?.toLowerCase()) {
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Find all accounts with multiple default keys
    const duplicates = await env.DB.prepare(`
      SELECT account_id, COUNT(*) as count
      FROM api_keys
      WHERE key_id = 'default'
      GROUP BY account_id
      HAVING COUNT(*) > 1
    `).all();

    const results = [];
    
    for (const dup of duplicates.results || []) {
      const accountId = dup.account_id;
      
      // Get all default keys for this account, ordered by creation date
      const keys = await env.DB.prepare(
        'SELECT * FROM api_keys WHERE account_id = ? AND key_id = ? ORDER BY created_at ASC'
      ).bind(accountId, 'default').all();

      if (keys.results && keys.results.length > 1) {
        const keepKey = keys.results[0]; // Keep the oldest
        const deleteKeys = keys.results.slice(1); // Delete newer ones

        for (const key of deleteKeys) {
          await env.DB.prepare(
            'DELETE FROM api_keys WHERE account_id = ? AND key_id = ? AND value = ?'
          ).bind(accountId, 'default', key.value).run();
        }

        results.push({
          account_id: accountId,
          kept: keepKey.value,
          deleted: deleteKeys.map(k => k.value)
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      cleaned: results.length,
      details: results
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
