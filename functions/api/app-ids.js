// Cloudflare Pages Function - API endpoint for managing public App IDs

function normalizeEmail(email) {
    if (typeof email !== 'string') return '';
    return email.trim().toLowerCase();
}

function normalizePasswordHash(passwordHash) {
    if (typeof passwordHash !== 'string') return '';
    return passwordHash.trim().toLowerCase();
}

function isPremiumEmail(email) {
    const PREMIUM_WHITELIST = [
        'draeder@gmail.com',
        'daniel@bitfabric.cc'
    ];
    return PREMIUM_WHITELIST.includes(email);
}

function getMaxAppIds({ plan }) {
    // App IDs are only for paid users (or whitelisted premium). Allow up to 20.
    if (plan === 'premium' || plan === 'pro' || plan === 'enterprise') return 20;
    return 0; // Free accounts do not get App IDs
}

async function requireAccountAuth({ env, email, passwordHash }) {
    const normalizedEmail = normalizeEmail(email);
    const normalizedPasswordHash = normalizePasswordHash(passwordHash);
    if (!normalizedEmail) return { ok: false, status: 400, error: 'Missing email' };
    if (!normalizedPasswordHash) return { ok: false, status: 400, error: 'Missing passwordHash' };

    const account = await env.DB.prepare(
        'SELECT email, password_hash, plan, account_id FROM accounts WHERE email = ? LIMIT 1'
    ).bind(normalizedEmail).first();

    if (!account) {
        return { ok: false, status: 401, error: 'Account not found' };
    }

    if ((account.password_hash || '').toLowerCase() !== normalizedPasswordHash) {
        return { ok: false, status: 401, error: 'Invalid email or password' };
    }

    const shouldBePremium = isPremiumEmail(normalizedEmail);
    if (shouldBePremium && account.plan !== 'premium') {
        await env.DB.prepare('UPDATE accounts SET plan = ?, updated_at = ? WHERE email = ?')
            .bind('premium', Date.now(), normalizedEmail)
            .run();
        account.plan = 'premium';
    }

    return { ok: true, email: normalizedEmail, accountId: account.account_id, plan: account.plan };
}

function randomAppId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = 'app_';
    for (let i = 0; i < 16; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
}

export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    const passwordHash = request.headers.get('x-bitfabric-password-hash');

    const auth = await requireAccountAuth({ env, email, passwordHash });
    if (!auth.ok) {
        return new Response(JSON.stringify({ error: auth.error }), {
            status: auth.status,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const results = await env.DB.prepare(
            'SELECT id, app_id, name, created_at FROM app_ids WHERE account_id = ? ORDER BY created_at DESC'
        ).bind(auth.accountId).all();

        return new Response(JSON.stringify({ appIds: results.results || [] }), {
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
    const { email, passwordHash, appName } = body;

    if (!appName) {
        return new Response(JSON.stringify({ error: 'Missing appName' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const auth = await requireAccountAuth({ env, email, passwordHash });
    if (!auth.ok) {
        return new Response(JSON.stringify({ error: auth.error }), {
            status: auth.status,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const maxAppIds = getMaxAppIds({ plan: auth.plan });
    if (maxAppIds <= 0) {
        return new Response(JSON.stringify({ error: 'App IDs require a paid subscription.' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const countRow = await env.DB.prepare(
            'SELECT COUNT(*) as cnt FROM app_ids WHERE account_id = ?'
        ).bind(auth.accountId).first();

        if (Number(countRow?.cnt || 0) >= maxAppIds) {
            return new Response(JSON.stringify({ error: `Limit of ${maxAppIds} App IDs reached.` }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const newAppId = randomAppId();
        const createdAt = Date.now();

        await env.DB.prepare(
            'INSERT INTO app_ids (account_id, app_id, name, created_at) VALUES (?, ?, ?, ?)'
        ).bind(
            auth.accountId,
            newAppId,
            appName,
            createdAt
        ).run();

        return new Response(JSON.stringify({
            success: true,
            appId: {
                app_id: newAppId,
                name: appName,
                created_at: createdAt
            }
        }), {
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
    const { email, passwordHash, appId } = body;

    if (!appId) {
        return new Response(JSON.stringify({ error: 'Missing appId' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const auth = await requireAccountAuth({ env, email, passwordHash });
    if (!auth.ok) {
        return new Response(JSON.stringify({ error: auth.error }), {
            status: auth.status,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        await env.DB.prepare(
            'DELETE FROM app_ids WHERE account_id = ? AND app_id = ?'
        ).bind(auth.accountId, appId).run();

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
