// Cloudflare Pages Function - API endpoint for managing keys
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const accountId = url.searchParams.get('account_id');
  
  if (!accountId) {
    return new Response(JSON.stringify({ error: 'Missing account_id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Fetch keys from D1 by account_id only (immutable per account)
    const results = await env.DB.prepare(
      'SELECT * FROM api_keys WHERE account_id = ?'
    ).bind(accountId).all();
    
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
  const { account_id, keyName, keyDescription, keyValue } = body;
  
  if (!account_id || !keyName || !keyValue) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Insert key into D1
    await env.DB.prepare(
      'INSERT INTO api_keys (account_id, key_id, name, description, value, created_at, permanent) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      account_id,
      keyName === 'Default' ? 'default' : crypto.randomUUID(),
      keyName,
      keyDescription || '',
      keyValue,
      Date.now(),
      keyName === 'Default' ? 1 : 0
    ).run();
    
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

export async function onRequestDelete(context) {
  const { request, env } = context;
  const body = await request.json();
  const { account_id, keyId } = body;
  
  if (!account_id || !keyId || keyId === 'default') {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    await env.DB.prepare(
      'DELETE FROM api_keys WHERE account_id = ? AND key_id = ?'
    ).bind(account_id, keyId).run();
    
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
