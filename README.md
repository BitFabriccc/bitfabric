# bitfabric

BitFabric is a direct pub/sub system using Gun and Nostr for messaging. All application data flows through Gun and Nostr relays.

## Web Console (Vue + Vite)

Run the web console:

```bash
npm install
npm run dev
# open http://localhost:5173
```

Build for production:

```bash
npm run build
npm run preview
```

The console lets you join a room and publish/subscribe to topics using Gun + Nostr.

## Email Verification (Optional)

This project supports email verification links, but you must configure an email provider for emails to actually send.

- Endpoints:
	- `POST /api/request-verification` with `{ email, passwordHash }`
	- `GET /api/verify-email?token=...`
	- New accounts trigger a verification email send attempt in `POST /api/authenticate`.

- Provider (Resend): set the following environment variables on your Cloudflare Pages project:
	- `RESEND_API_KEY`
	- `MAIL_FROM` (example: `BitFabric <no-reply@yourdomain.com>`)

If `RESEND_API_KEY`/`MAIL_FROM` are not set, the API will return `sent:false, skipped:true` and no email will be delivered.

## Library

- Core pub/sub fabric lives in [src/fabric](src/fabric/README.md)
- Nostr helper lives in [src/nostr/nostrClient.js](src/nostr/nostrClient.js)

MIT licensed.
