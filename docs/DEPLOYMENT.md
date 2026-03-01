# BitFabric Deployment Guide

Deploy BitFabric to Cloudflare Workers & Pages.

## Prerequisites

- Cloudflare account
- `wrangler` CLI installed: `npm install -g wrangler`
- Git repository

## Quick Deploy

```bash
# Build the project
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name=bitfabric --commit-dirty=true
```

## Full Setup

### 1. Configure Wrangler

Edit `wrangler.toml`:

```toml
name = "bitfabric"
compatibility_date = "2024-01-01"

# Pages configuration
pages_build_output_dir = "dist"

# D1 Database binding (if using)
[[d1_databases]]
binding = "DB"
database_name = "bitfabric-db"
database_id = "your-database-id"
```

### 2. Environment Variables

Create `.env.local` or set in Cloudflare dashboard:

```bash
VITE_API_URL=https://bitfabric.example.com
VITE_NOSTR_RELAYS=wss://nos.lol,wss://relay.damus.io
```

### 3. Build & Deploy

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Preview locally
npm run preview

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name=bitfabric
```

## GitHub Actions CI/CD

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build
        run: npm run build
      
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          projectName: bitfabric
```

## Firewall Rules

Recommended Cloudflare Security settings:

```
Security Level: High
HTTPS Redirect: Enabled
Automatic HTTPS Rewrites: Enabled
Bot Management: Enabled (optional)
```

## Custom Domain

1. Point DNS to Cloudflare nameservers
2. Add CNAME: `bitfabric.pages.dev` → your domain
3. Enable SSL/TLS in Cloudflare dashboard

## Database (D1)

### Create Database

```bash
npx wrangler d1 create bitfabric-db
```

### Run Migrations

```bash
npx wrangler d1 execute bitfabric-db --file schema.sql
```

### Email verification (backend)

This repo includes Cloudflare Pages Function endpoints:

- `POST /api/send-verification`
- `GET|POST /api/verify-email`

They require:
- D1 binding named `DB`
- Email delivery config:
  - Production: set `MAIL_FROM` (MailChannels) and optionally `MAIL_FROM_NAME`
  - Dev: set `EMAIL_MODE=log` to avoid sending real email

### Fix: one account, many keys

If your existing `api_keys` table was created with `account_id` as a unique/primary key, you effectively only allowed **one key per account**.
The correct shape is a composite primary key: `PRIMARY KEY (account_id, key_id)`.

To migrate an existing D1 database safely:

1) Inspect the current table:

```bash
npx wrangler d1 execute bitfabric-db --command "PRAGMA table_info(api_keys);"
```

2) If `account_id` is the only primary key / unique constraint, run a one-time migration like:

```sql
-- WARNING: back up first if this is production.

ALTER TABLE api_keys RENAME TO api_keys_old;

-- Recreate api_keys with composite PK (account_id, key_id) and UNIQUE(value)
CREATE TABLE api_keys (
  account_id TEXT NOT NULL,
  key_id TEXT NOT NULL,
  name TEXT,
  description TEXT,
  value TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  permanent INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, key_id),
  UNIQUE (value)
);

-- If your old table did not have key_id, generate one during copy.
-- D1/SQLite doesn't have uuid() built-in, so we use a deterministic default per row.
INSERT INTO api_keys (account_id, key_id, name, description, value, created_at, permanent)
SELECT
  account_id,
  COALESCE(key_id, 'default') as key_id,
  name,
  description,
  value,
  created_at,
  permanent
FROM api_keys_old;

DROP TABLE api_keys_old;
```

Then re-run `schema.sql` to ensure indexes exist.

### Query from Worker

```javascript
export default {
  async fetch(request, env) {
    const { results } = await env.DB.prepare(
      'SELECT * FROM users LIMIT 10'
    ).all();
    
    return Response.json(results);
  }
};
```

## Monitoring

Monitor deployment via:

1. **Cloudflare Dashboard** - Real-time metrics
2. **Analytics** - Request/error rates
3. **Logs** - Access logs and errors

## Troubleshooting

### Build Failures

```bash
# Clear cache and rebuild
rm -rf dist node_modules package-lock.json
npm install
npm run build
```

### Deployment Errors

```bash
# Check deployment status
npx wrangler pages project list

# View deployment logs
npx wrangler tail --service bitfabric
```

### CORS Issues

Add to `wrangler.toml`:

```toml
[[env.production.routes]]
pattern = "*"
zone_name = "example.com"

[env.production.analytics]
enabled = true
```

## Performance Tips

1. **Enable Brotli compression** - Cloudflare default
2. **Set cache TTL** - Static assets: 1 month
3. **Use Cloudflare Analytics** - Monitor performance
4. **Enable HTTP/2** - Push enabled by default

## See Also

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
