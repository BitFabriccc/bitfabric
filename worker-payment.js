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
    const { paymentMethodId, email: rawEmail, plan, amount } = await request.json();
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';

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

      // If the plan is "burst", trigger the AWS deployment logic asynchronously
      if (plan === 'burst') {
        // Create the deployment record first (so the UI can poll for it)
        const deployId = generateUUID();
        try {
          // We will store relay_url later once deployed
          await env.DB.prepare(
            'INSERT INTO user_relays (id, user_email, status, created_at) VALUES (?, ?, ?, ?)'
          ).bind(deployId, email, 'provisioning', Date.now()).run();

          // Fetch to our internal API to kick off deployment
          // We do not await this, letting it run in background/waitUntil
          const deployReq = fetch(new URL('/api/deploy-relay', request.url).href, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, deployId })
          });
          if (request.cf) {
            env.waitUntil?.(deployReq); // Use waitUntil if in full CF worker envelope
          }
        } catch (e) {
          console.error('Failed to trigger relay deployment:', e);
        }
      }

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
    // Handle changes like downgrading from burst to scale here if needed
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;

    // Find who this belongs to
    const payment = await env.DB.prepare(
      'SELECT api_key FROM payments WHERE stripe_id = ?'
    ).bind(subscription.id).first(); // assuming we used sub id for stripe_id, or we'd need customer ID search

    // In a real implementation we would look up the user by customer ID or subscription ID.
    // Since we lack a dedicated stripe_customers table in MVP, we will assume 
    // we query user by email from the metadata object of the subscription.
    const email = subscription.metadata?.email;

    if (email) {
      // Look up active relay
      const activeRelay = await env.DB.prepare(
        "SELECT id, aws_instance_id FROM user_relays WHERE user_email = ? AND status IN ('active', 'provisioning') ORDER BY created_at DESC LIMIT 1"
      ).bind(email).first();

      if (activeRelay) {
        // Mark as terminating
        await env.DB.prepare("UPDATE user_relays SET status = 'terminating' WHERE id = ?")
          .bind(activeRelay.id).run();

        // Trigger internal AWS termination
        const termReq = fetch(new URL('/api/remove-relay', request.url).href, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deployId: activeRelay.id,
            instanceId: activeRelay.aws_instance_id,
            email: email
          })
        });

        if (request.cf && env.waitUntil) env.waitUntil(termReq);
      }

      // Downgrade API Key plan
      await env.DB.prepare("UPDATE api_keys SET plan = 'starter' WHERE user_email = ?")
        .bind(email).run();
    }
  }

  return Response.json({ received: true });
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
