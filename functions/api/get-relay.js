export async function onRequestGet({ request, env }) {
    try {
        const url = new URL(request.url);
        const email = url.searchParams.get('email');

        // In production we would secure this with an auth token check
        // e.g. JWT or specific API key passed in headers

        if (!email) {
            return Response.json({ error: 'Missing email parameter' }, { status: 400 });
        }

        // Get the most recent deployment for this user
        const relayRecord = await env.DB.prepare(
            'SELECT id, status, relay_url, aws_instance_id, created_at FROM user_relays WHERE user_email = ? ORDER BY created_at DESC LIMIT 1'
        ).bind(email).first();

        if (!relayRecord) {
            return Response.json({ hasRelay: false });
        }

        return Response.json({
            hasRelay: true,
            relay: relayRecord
        });

    } catch (err) {
        console.error('get-relay error:', err);
        return Response.json({ error: 'Failed to fetch relay status' }, { status: 500 });
    }
}
