/**
 * Cloudflare Worker for BitFabric Payment Processing
 * Deploy to handle Stripe payments and subscription management
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Payment checkout endpoint
    if (url.pathname === '/api/checkout' && request.method === 'POST') {
      return handleCheckout(request, env);
    }
    
    // Webhook for Stripe events
    if (url.pathname === '/webhooks/stripe' && request.method === 'POST') {
      return handleWebhook(request, env);
    }
    
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
};

async function handleCheckout(request, env) {
  try {
    const { paymentMethodId, email, plan, amount } = await request.json();
    
    if (!paymentMethodId || !email || !plan) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Create payment intent with Stripe
    const paymentIntent = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        amount,
        currency: 'usd',
        payment_method: paymentMethodId,
        confirm: 'true',
        metadata: {
          plan,
          email
        }
      })
    }).then(r => r.json());
    
    if (paymentIntent.status === 'succeeded') {
      // Generate API key
      const apiKey = generateUUID();
      
      // Store in D1 database
      await env.DB.prepare(
        'INSERT INTO api_keys (api_key, user_email, plan, created_at) VALUES (?, ?, ?, ?)'
      ).bind(apiKey, email, plan, Date.now()).run();
      
      // Store payment info
      await env.DB.prepare(
        'INSERT INTO payments (stripe_id, api_key, amount, plan, status) VALUES (?, ?, ?, ?, ?)'
      ).bind(paymentIntent.id, apiKey, amount, plan, 'succeeded').run();
      
      return Response.json({
        success: true,
        apiKey,
        plan
      });
    } else if (paymentIntent.status === 'requires_action') {
      // 3D Secure or other authentication required
      return Response.json({
        success: false,
        requiresAction: true,
        clientSecret: paymentIntent.client_secret
      });
    } else {
      return Response.json({
        success: false,
        error: paymentIntent.error?.message || 'Payment failed'
      }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Checkout error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

async function handleWebhook(request, env) {
  const sig = request.headers.get('stripe-signature');
  const body = await request.text();
  
  // Verify webhook signature
  const event = JSON.parse(body);
  
  // Handle subscription events
  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object;
    // Update subscription status in database
    // await env.DB.prepare(...)
  }
  
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    // Mark subscription as cancelled
    // await env.DB.prepare(...)
  }
  
  return Response.json({ received: true });
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
