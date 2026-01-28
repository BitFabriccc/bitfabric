# BitFabric Commercial Setup

## Stripe Integration

### 1. Get Stripe Keys
- Go to https://dashboard.stripe.com/apikeys
- Copy your **Publishable Key** and **Secret Key**

### 2. Update checkout.html
```html
<!-- Replace: -->
const stripe = Stripe('pk_test_YOUR_STRIPE_KEY');

<!-- With your actual key: -->
const stripe = Stripe('pk_live_YOUR_LIVE_KEY');
```

### 3. Deploy Cloudflare Worker
```bash
# Create worker for payment processing
npx wrangler publish worker-payment.js

# Create D1 database tables
npx wrangler d1 execute bitfabric-api-keys --remote << 'EOF'
CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_key TEXT UNIQUE NOT NULL,
  user_email TEXT NOT NULL,
  plan TEXT DEFAULT 'starter',
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stripe_id TEXT UNIQUE NOT NULL,
  api_key TEXT NOT NULL,
  amount INTEGER,
  plan TEXT,
  status TEXT,
  created_at INTEGER DEFAULT (cast(unixepoch() as int)),
  FOREIGN KEY (api_key) REFERENCES api_keys(api_key)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stripe_subscription_id TEXT UNIQUE,
  api_key TEXT NOT NULL,
  plan TEXT,
  status TEXT,
  current_period_start INTEGER,
  current_period_end INTEGER,
  FOREIGN KEY (api_key) REFERENCES api_keys(api_key)
);
EOF
```

### 4. Configure wrangler.toml
```toml
[[d1_databases]]
binding = "DB"
database_name = "bitfabric-api-keys"
database_id = "YOUR_DATABASE_ID"

[env.production]
vars = { STRIPE_SECRET_KEY = "sk_live_YOUR_KEY" }
```

## Encryption Setup

### 1. Add TweetNaCl.js to HTML
```html
<script src="https://tweetnacl.js.org/nacl.min.js"></script>
```

### 2. Use in App
```javascript
import { encryptMessage, decryptMessage } from './crypto-utils.js';

// Encrypt outgoing messages
const encrypted = await encryptMessage(data, encryptionKey);

// Decrypt incoming messages
const decrypted = await decryptMessage(encrypted, encryptionKey);
```

## Plans & Features

### Starter (Free)
- 100 messages/day
- 1 API key
- Public topics only
- Community support

### Professional ($29/mo)
- 1M messages/month
- 5 API keys
- Private + public topics
- Email support
- Advanced encryption
- Usage analytics

### Enterprise (Custom)
- Unlimited everything
- Priority support
- Custom encryption
- SLA guarantee
- Dedicated account

## Deployment Files

- `pricing.html` - Pricing page with plans
- `checkout.html` - Stripe checkout page
- `worker-payment.js` - Cloudflare Worker for payments
- `crypto-utils.js` - Encryption utilities

## Environment Variables Needed

```
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_SECRET_KEY=sk_live_xxx
D1_DATABASE_ID=xxx
```

## Testing

### Test Stripe Cards
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0025 0000 3155`

Expiry: Any future date (12/25)
CVC: Any 3 digits (123)
