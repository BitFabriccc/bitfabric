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
