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
    
    // Generate deterministic key for whitelisted user
    const encoder = new TextEncoder();
    const data = encoder.encode(`bitfabric-premium-${normalizedEmail}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const deterministicKey = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Generate immutable account ID
    const accountData = encoder.encode(`bitfabric-account-${normalizedEmail}-premium`);
    const accountHashBuffer = await crypto.subtle.digest('SHA-256', accountData);
    const accountHashArray = Array.from(new Uint8Array(accountHashBuffer));
    const accountHash = accountHashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const accountId = `${accountHash.substr(0,8)}-${accountHash.substr(8,4)}-${accountHash.substr(12,4)}-${accountHash.substr(16,4)}-${accountHash.substr(20,12)}`;
    
    // Check if default key already exists
    try {
      const existingKeys = await env.DB.prepare(
        'SELECT * FROM api_keys WHERE account_id = ? AND key_id = ?'
      ).bind(accountId, 'default').all();
      
      if (existingKeys.results.length === 0) {
        // Create default key
        await env.DB.prepare(
          'INSERT INTO api_keys (account_id, key_id, name, description, value, created_at, permanent) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          accountId,
          'default',
          'Default',
          'Your default API key',
          deterministicKey,
          Date.now(),
          1
        ).run();
      }
    } catch (dbError) {
      console.error('Error managing default key:', dbError);
      // Continue anyway - key still works
    }
    
    return new Response(JSON.stringify({ 
      authenticated: true,
      isPremium: true,
      email: normalizedEmail,
      sessionKey: deterministicKey,
      accountId: accountId,
      plan: 'enterprise',
      defaultKey: {
        id: 'default',
        name: 'Default',
        description: 'Your default API key',
        value: deterministicKey,
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
