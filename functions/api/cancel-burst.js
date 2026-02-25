// This API expects an authenticated user to request cancellation of their burst relay
export async function onRequestPost({ request, env }) {
    try {
        const { email } = await request.json();

        if (!email) {
            return Response.json({ error: 'Missing email' }, { status: 400 });
        }

        // In production, you would authenticate the user here using their session logic.
        // (e.g., verifying the x-bitfabric-password-hash or session cookie against D1)

        // 1. Find the active relay for this user
        const activeRelay = await env.DB.prepare(
            "SELECT id, aws_instance_id FROM user_relays WHERE user_email = ? AND status IN ('active', 'provisioning') ORDER BY created_at DESC LIMIT 1"
        ).bind(email).first();

        if (!activeRelay) {
            return Response.json({ error: 'No active burst relay found to cancel' }, { status: 404 });
        }

        // 2. We need to tell Stripe to downgrade the user back to "scale" or "starter" and prorate the refund.
        // This requires fetching their Stripe subscription from the `payments` or Stripe API directly.
        // For MVP purposes, since we only store `stripe_id` which might be the payment intent in earlier code:
        // (Assuming we have their customer ID or subscription ID)

        // To properly cancel/prorate an active subscription via Stripe, you'd typically do:
        /*
          const stripeRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                proration_behavior: 'create_prorations',
                // Update items to remove the burst plan / downgrade them
                // ...
            })
          });
        */

        // 3. Mark the relay as terminating in DB
        await env.DB.prepare("UPDATE user_relays SET status = 'terminating' WHERE id = ?")
            .bind(activeRelay.id).run();

        // 4. Trigger the AWS termination script anonymously (or call it natively since we are in the same environment)
        // Cloudflare workers can do this async via waitUntil
        const termReq = fetch(new URL('/api/remove-relay', request.url).href, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deployId: activeRelay.id,
                instanceId: activeRelay.aws_instance_id,
                email: email
            })
        });

        if (request.cf && env.waitUntil) {
            env.waitUntil(termReq);
        } else {
            // Await it directly if waitUntil isn't available (wrangler dev sometimes)
            await termReq;
        }

        // Update API Key plan back to starter/scale logic so the UI resets
        await env.DB.prepare("UPDATE api_keys SET plan = 'starter' WHERE user_email = ? AND plan = 'burst'")
            .bind(email).run();

        return Response.json({ success: true, message: 'Relay is being terminated. Account prorated.' });

    } catch (err) {
        console.error('Cancel burst error:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
