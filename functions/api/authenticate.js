// Cloudflare Pages Function - Server-side authentication for whitelisted users
export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const body = await request.json();
    const { email } = body;
    
    if (!email) {
      return new Response(JSON.stringify({ error: 'Missing email' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Server-side premium whitelist (source of truth)
    const PREMIUM_WHITELIST = [
      'draeder@gmail.com',
      'daniel@bitfabric.cc'
    ];
    
    const normalizedEmail = email.toLowerCase();
    const isPremium = PREMIUM_WHITELIST.includes(normalizedEmail);
    
    if (!isPremium) {
      return new Response(JSON.stringify({ 
        error: 'Not whitelisted',
        authenticated: false
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const encoder = new TextEncoder();

    // Generate immutable account ID (stable)
    const accountData = encoder.encode(`bitfabric-account-${normalizedEmail}-premium`);
    const accountHashBuffer = await crypto.subtle.digest('SHA-256', accountData);
    const accountHashArray = Array.from(new Uint8Array(accountHashBuffer));
    const accountHash = accountHashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const accountId = `${accountHash.substr(0,8)}-${accountHash.substr(8,4)}-${accountHash.substr(12,4)}-${accountHash.substr(16,4)}-${accountHash.substr(20,12)}`;

    // DB-backed default key (create once, then reuse forever)
    const randomHex = (bytes) => {
      const arr = new Uint8Array(bytes);
      crypto.getRandomValues(arr);
      return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
    };

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
      isPremium: true,
      email: normalizedEmail,
      sessionKey,
      accountId: accountId,
      plan: 'enterprise',
      defaultKey: {
        id: 'default',
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
