// Cloudflare Pages Function - Check if email is premium/whitelisted
export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const body = await request.json();
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    
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
    
    const isPremium = PREMIUM_WHITELIST.includes(email);
    
    return new Response(JSON.stringify({ 
      email,
      isPremium: isPremium 
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
