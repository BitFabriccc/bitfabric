# Cloudflare API Key Management

## Overview
Use Cloudflare Workers + D1 (SQLite) or KV to manage API keys for your BitFabric pubsub.

## Option 1: Cloudflare Workers + D1 (Recommended)

### 1. Create D1 Database
```bash
npx wrangler d1 create bitfabric-api-keys
```

### 2. Create Schema
```sql
-- Run this in D1 console or via wrangler
CREATE TABLE api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_key TEXT UNIQUE NOT NULL,
  user_email TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  is_active INTEGER DEFAULT 1
);

CREATE INDEX idx_api_key ON api_keys(api_key);
CREATE INDEX idx_user_email ON api_keys(user_email);
```

### 3. Worker Code (`worker.js`)
```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Generate new API key
    if (url.pathname === '/api/keys/generate' && request.method === 'POST') {
      const { email } = await request.json();
      
      // Generate random API key
      const apiKey = crypto.randomUUID();
      
      await env.DB.prepare(
        'INSERT INTO api_keys (api_key, user_email, created_at) VALUES (?, ?, ?)'
      ).bind(apiKey, email, Date.now()).run();
      
      return Response.json({ apiKey });
    }
    
    // Validate API key
    if (url.pathname === '/api/keys/validate' && request.method === 'POST') {
      const { apiKey } = await request.json();
      
      const result = await env.DB.prepare(
        'SELECT * FROM api_keys WHERE api_key = ? AND is_active = 1'
      ).bind(apiKey).first();
      
      if (!result) {
        return Response.json({ valid: false }, { status: 401 });
      }
      
      // Check expiration
      if (result.expires_at && result.expires_at < Date.now()) {
        return Response.json({ valid: false, reason: 'expired' }, { status: 401 });
      }
      
      return Response.json({ valid: true, email: result.user_email });
    }
    
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
};
```

### 4. Update `wrangler.toml`
```toml
name = "bitfabric-api-keys"
main = "worker.js"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "bitfabric-api-keys"
database_id = "your-database-id-here"
```

### 5. Deploy
```bash
npx wrangler deploy
```

## Option 2: Cloudflare Workers KV (Simpler)

### 1. Create KV Namespace
```bash
npx wrangler kv:namespace create "API_KEYS"
```

### 2. Worker Code
```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Generate API key
    if (url.pathname === '/api/keys/generate' && request.method === 'POST') {
      const { email } = await request.json();
      const apiKey = crypto.randomUUID();
      
      await env.API_KEYS.put(apiKey, JSON.stringify({
        email,
        createdAt: Date.now(),
        active: true
      }));
      
      return Response.json({ apiKey });
    }
    
    // Validate API key
    if (url.pathname === '/api/keys/validate' && request.method === 'POST') {
      const { apiKey } = await request.json();
      const data = await env.API_KEYS.get(apiKey);
      
      if (!data) {
        return Response.json({ valid: false }, { status: 401 });
      }
      
      const keyData = JSON.parse(data);
      return Response.json({ valid: keyData.active, email: keyData.email });
    }
    
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
};
```

## Integration with BitFabric Client

### Update your app to validate on connect:

```javascript
async function connect() {
  const apiKey = roomId.value.trim();
  
  // Validate with Cloudflare Worker
  const response = await fetch('https://your-worker.workers.dev/api/keys/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey })
  });
  
  const result = await response.json();
  
  if (!result.valid) {
    pushLog('Invalid API key');
    status.value = 'error';
    return;
  }
  
  // Continue with normal connection...
  fabric = new PubSubFabric({
    roomId: apiKey,
    nostrRelays
  });
  
  await fabric.init();
  // ...
}
```

## Simple Signup Page (HTML)

```html
<!DOCTYPE html>
<html>
<head>
  <title>Get API Key</title>
</head>
<body>
  <h1>Get Your BitFabric API Key</h1>
  <input type="email" id="email" placeholder="your@email.com">
  <button onclick="generateKey()">Generate API Key</button>
  <div id="result"></div>
  
  <script>
    async function generateKey() {
      const email = document.getElementById('email').value;
      const response = await fetch('https://your-worker.workers.dev/api/keys/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      document.getElementById('result').innerHTML = 
        `<strong>Your API Key:</strong> ${data.apiKey}`;
    }
  </script>
</body>
</html>
```

## Security Best Practices

1. **Rate Limiting**: Add rate limiting to prevent abuse
2. **CORS**: Configure proper CORS headers
3. **Encryption**: Store sensitive data encrypted
4. **Audit Logs**: Track API key usage
5. **Revocation**: Allow users to revoke keys

## Next Steps

1. Deploy the Cloudflare Worker
2. Create a signup page
3. Update BitFabric app to validate API keys before connecting
4. Add key management UI (list, revoke, regenerate)
